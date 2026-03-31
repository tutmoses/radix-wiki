// src/lib/wiki.ts - Server-side data fetching

import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma/client';
import { isValidTagPath, getSortOrder, getMetadataKeys, type SortOrder } from '@/lib/tags';
import type { WikiPage, IdeasPage } from '@/types';
import type { Block, RecentPagesBlock, PageListBlock, ColumnsBlock } from '@/types/blocks';
import { computeRevisionDiff } from '@/lib/versioning';

// ========== PRISMA QUERY FRAGMENTS ==========
export const AUTHOR_SELECT = { select: { id: true, displayName: true, radixAddress: true, avatarUrl: true } } as const;
export const PAGE_INCLUDE = { author: AUTHOR_SELECT, _count: { select: { revisions: true } } } as const;
export const CATEGORY_SELECT = {
  id: true, slug: true, title: true, content: true, bannerImage: true,
  tagPath: true, metadata: true, version: true, createdAt: true, updatedAt: true,
  authorId: true, author: AUTHOR_SELECT,
} as const;
export const PAGE_LIST_SELECT = {
  ...CATEGORY_SELECT,
  _count: { select: { revisions: true } },
} as const;
const CACHE_OPTS = { tags: ['wiki'], revalidate: 60 };

/** Shorthand for cache(unstable_cache(fn, [key], CACHE_OPTS)) */
function cached<T extends (...args: any[]) => Promise<any>>(key: string, fn: T): T {
  return cache(unstable_cache(fn, [key], CACHE_OPTS)) as T;
}

// ========== UNIFIED PATH PARSING ==========

const SUFFIXES = ['edit', 'history', 'mdx'] as const;
type Suffix = typeof SUFFIXES[number];

export interface ParsedPath {
  type: 'homepage' | 'category' | 'page' | 'history' | 'edit' | 'mdx' | 'leaderboard' | 'welcome' | 'rewards' | 'invalid';
  tagPath: string;
  slug: string;
  suffix: Suffix | null;
}

export function parsePath(segments: string[] = [], mode: 'client' | 'api' = 'client'): ParsedPath {
  const base: ParsedPath = { type: 'homepage', tagPath: '', slug: '', suffix: null };
  if (segments.length === 0) return base;

  // Static pages
  if (segments.length === 1 && segments[0] === 'leaderboard') {
    return { ...base, type: 'leaderboard' };
  }
  if (segments.length === 1 && segments[0] === 'welcome') {
    return { ...base, type: 'welcome' };
  }
  if (segments.length === 1 && segments[0] === 'rewards') {
    return { ...base, type: 'rewards' };
  }

  // Single-segment suffix (e.g., /edit, /history, /mdx)
  if (segments.length === 1 && SUFFIXES.includes(segments[0] as Suffix)) {
    const suffix = segments[0] as Suffix;
    if (mode === 'api' && suffix === 'edit') return { ...base, type: 'invalid' };
    return { ...base, type: suffix, suffix };
  }

  // Check full path as tag (handles tags like 'history' that collide with suffixes)
  if (mode === 'client' && isValidTagPath(segments)) {
    return { ...base, type: 'category', tagPath: segments.join('/') };
  }

  const lastSegment = segments[segments.length - 1];
  const suffix = SUFFIXES.includes(lastSegment as Suffix) ? lastSegment as Suffix : null;
  const pathSegments = suffix ? segments.slice(0, -1) : segments;

  // Client: check if stripped path is a category
  if (mode === 'client' && suffix && isValidTagPath(pathSegments)) {
    return { ...base, type: suffix === 'edit' ? 'category' : suffix, tagPath: pathSegments.join('/'), suffix };
  }

  if (pathSegments.length < 2) {
    return mode === 'api' ? { ...base, type: 'invalid' } : { ...base, type: 'invalid' };
  }

  const slug = pathSegments[pathSegments.length - 1]!;
  const tagPathSegments = pathSegments.slice(0, -1);

  if (!isValidTagPath(tagPathSegments)) {
    return { ...base, type: 'invalid' };
  }

  const tagPath = tagPathSegments.join('/');
  const type = suffix ?? 'page';
  if (mode === 'api' && suffix === 'edit') return { ...base, type: 'invalid' };
  return { type, tagPath, slug, suffix };
}

// ========== DATA FETCHING ==========

export const getHomepage = cached('getHomepage',
  async (): Promise<WikiPage | null> => {
    return prisma.page.findUnique({ where: { tagPath_slug: { tagPath: '', slug: '' } }, include: PAGE_INCLUDE }) as Promise<WikiPage | null>;
  },
);

export const getPage = cached('getPage',
  async (tagPath: string, slug: string): Promise<WikiPage | null> => {
    return prisma.page.findUnique({ where: { tagPath_slug: { tagPath, slug } }, include: PAGE_INCLUDE }) as Promise<WikiPage | null>;
  },
);

const sortOrderBy: Record<SortOrder, object> = {
  title: { title: 'asc' as const },
  newest: { createdAt: 'desc' as const },
  oldest: { createdAt: 'asc' as const },
  recent: { updatedAt: 'desc' as const },
};

export const getCategoryPages = cached('getCategoryPages',
  async (tagPath: string, sort?: SortOrder, limit = 200): Promise<WikiPage[]> => {
    const resolvedSort = sort ?? getSortOrder(tagPath.split('/'));
    const hasDateMeta = resolvedSort !== 'title' && getMetadataKeys(tagPath.split('/')).some(k => k.key === 'date' && k.type === 'date');
    const pages = await prisma.page.findMany({
      where: { tagPath },
      select: CATEGORY_SELECT,
      orderBy: sortOrderBy[resolvedSort],
      take: limit,
    }) as unknown as WikiPage[];
    if (!hasDateMeta) return pages;
    const dir = resolvedSort === 'oldest' ? 1 : -1;
    return pages.sort((a, b) => {
      const da = (a.metadata as Record<string, string> | null)?.date || '';
      const db = (b.metadata as Record<string, string> | null)?.date || '';
      return (da < db ? -1 : da > db ? 1 : 0) * dir;
    });
  },
);

export function isIdeasPath(tagPath: string): boolean {
  return tagPath === 'ideas' || tagPath.startsWith('ideas/');
}

export const getIdeasPages = cached('getIdeasPages',
  async (tagPath: string, limit = 200): Promise<IdeasPage[]> => {
    const pages = await prisma.page.findMany({
      where: { tagPath: { startsWith: tagPath } },
      select: {
        ...CATEGORY_SELECT,
        _count: { select: { comments: true } },
        comments: { orderBy: { createdAt: 'desc' as const }, take: 1, select: { createdAt: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
    return pages.map(p => ({
      ...p,
      content: null,
      version: '',
      replyCount: p._count.comments,
      lastActivity: p.comments[0]?.createdAt ?? p.createdAt,
    })) as unknown as IdeasPage[];
  },
);

export const getPageHistory = cached('getPageHistory',
  async (tagPath: string, slug: string) => {
    const page = await prisma.page.findUnique({
      where: { tagPath_slug: { tagPath, slug } },
      select: { id: true, title: true, version: true },
    });
    if (!page) return null;

    const revisions = await prisma.revision.findMany({
      where: { pageId: page.id },
      select: {
        id: true, title: true, version: true, changeType: true,
        changes: true, content: true, message: true, createdAt: true,
        author: AUTHOR_SELECT,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Backfill changes for revisions that don't have stored diffs
    const backfilled = revisions.map((rev, i) => {
      if (rev.changes && Array.isArray(rev.changes) && (rev.changes as unknown[]).length > 0) {
        const { content: _, ...rest } = rev;
        return rest;
      }
      const next = revisions[i + 1];
      const newContent = (rev.content as unknown as Block[]) || [];
      const oldContent = next ? (next.content as unknown as Block[]) || [] : [];
      const diff = computeRevisionDiff(
        next?.version ?? null, oldContent, newContent,
        next?.title ?? '', rev.title, null, null,
      );
      const { content: _, ...rest } = rev;
      return { ...rest, changes: diff.changes, changeType: diff.changeType || rev.changeType };
    });

    return { currentVersion: page.version, revisions: backfilled };
  },
);

export const getAdjacentPages = cached('getAdjacentPages',
  async (tagPath: string, title: string, createdAt?: string, updatedAt?: string) => {
    const sort = getSortOrder(tagPath.split('/'));
    const select = { tagPath: true, slug: true, title: true, metadata: true } as const;
    const hasDateMeta = sort !== 'title' && sort !== 'recent' && getMetadataKeys(tagPath.split('/')).some(k => k.key === 'date' && k.type === 'date');

    if (hasDateMeta) {
      const pages = await prisma.page.findMany({ where: { tagPath }, select });
      const dir = sort === 'oldest' ? 1 : -1;
      const sorted = pages.sort((a, b) => {
        const da = (a.metadata as Record<string, string> | null)?.date || '';
        const db = (b.metadata as Record<string, string> | null)?.date || '';
        return (da < db ? -1 : da > db ? 1 : 0) * dir;
      });
      const idx = sorted.findIndex(p => p.title === title);
      return { prev: idx > 0 ? sorted[idx - 1] ?? null : null, next: idx < sorted.length - 1 ? sorted[idx + 1] ?? null : null };
    }

    const field = sort === 'recent' ? 'updatedAt' : sort !== 'title' && createdAt ? 'createdAt' : 'title';
    const cursor = sort === 'recent' ? updatedAt : field === 'createdAt' ? createdAt : title;
    const ascending = sort === 'oldest' || sort === 'title';

    const [prev, next] = await Promise.all([
      prisma.page.findFirst({
        where: { tagPath, [field]: { [ascending ? 'lt' : 'gt']: cursor } },
        orderBy: { [field]: ascending ? 'desc' : 'asc' },
        select,
      }),
      prisma.page.findFirst({
        where: { tagPath, [field]: { [ascending ? 'gt' : 'lt']: cursor } },
        orderBy: { [field]: ascending ? 'asc' : 'desc' },
        select,
      }),
    ]);
    return { prev, next };
  },
);

// ========== BLOCK DATA RESOLUTION ==========

const getRecentPages = unstable_cache(
  async (tagPath: string | undefined, limit: number) => prisma.page.findMany({
    where: tagPath ? { tagPath } : undefined,
    select: PAGE_LIST_SELECT,
    orderBy: { updatedAt: 'desc' },
    take: limit,
  }), ['getRecentPages'], CACHE_OPTS,
);

const getPagesByIds = unstable_cache(
  async (ids: string[]) => {
    if (!ids.length) return [];
    const pages = await prisma.page.findMany({ where: { id: { in: ids } }, select: PAGE_LIST_SELECT });
    const map = new Map(pages.map(p => [p.id, p]));
    return ids.map(id => map.get(id)).filter(Boolean);
  }, ['getPagesByIds'], CACHE_OPTS,
);

/** Pre-resolve recentPages and pageList blocks server-side to avoid client waterfalls. */
export async function resolveBlockData(blocks: Block[]): Promise<Block[]> {
  const recentPending: { block: RecentPagesBlock; promise: Promise<any[]> }[] = [];
  const listPending: { block: PageListBlock; promise: Promise<any[]> }[] = [];

  function collect(list: (Block | import('@/types/blocks').AtomicBlock)[]) {
    for (const b of list) {
      if (b.type === 'recentPages') recentPending.push({ block: b, promise: getRecentPages(b.tagPath, b.limit) });
      else if (b.type === 'pageList') listPending.push({ block: b as PageListBlock, promise: getPagesByIds((b as PageListBlock).pageIds) });
      else if (b.type === 'columns') for (const col of (b as ColumnsBlock).columns) collect(col.blocks);
      else if (b.type === 'infobox') collect((b as import('@/types/blocks').InfoboxBlock).blocks);
    }
  }

  collect(blocks);
  if (!recentPending.length && !listPending.length) return blocks;

  const [recentResults, listResults] = await Promise.all([
    Promise.all(recentPending.map(p => p.promise)),
    Promise.all(listPending.map(p => p.promise)),
  ]);
  recentPending.forEach((p, i) => { p.block.resolvedPages = recentResults[i]; });
  listPending.forEach((p, i) => { p.block.resolvedPages = listResults[i]; });
  return blocks;
}
