// src/lib/wiki.ts - Server-side data fetching

import { cache } from 'react';
import { prisma } from '@/lib/prisma/client';
import { isValidTagPath, getSortOrder, getMetadataKeys, type SortOrder } from '@/lib/tags';
import type { WikiPage } from '@/types';

// ========== PRISMA QUERY FRAGMENTS ==========
export const AUTHOR_SELECT = { select: { id: true, displayName: true, radixAddress: true } } as const;
export const PAGE_INCLUDE = { author: AUTHOR_SELECT, _count: { select: { revisions: true } } } as const;

// ========== UNIFIED PATH PARSING ==========

const SUFFIXES = ['edit', 'history', 'mdx'] as const;
type Suffix = typeof SUFFIXES[number];

export interface ParsedPath {
  type: 'homepage' | 'category' | 'page' | 'history' | 'edit' | 'mdx' | 'invalid';
  tagPath: string;
  slug: string;
  suffix: Suffix | null;
}

export function parsePath(segments: string[] = [], mode: 'client' | 'api' = 'client'): ParsedPath {
  const base: ParsedPath = { type: 'homepage', tagPath: '', slug: '', suffix: null };
  if (segments.length === 0) return base;

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

  const slug = pathSegments[pathSegments.length - 1];
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

export const getHomepage = cache(async (): Promise<WikiPage | null> => {
  return prisma.page.findFirst({ where: { tagPath: '', slug: '' }, include: PAGE_INCLUDE }) as Promise<WikiPage | null>;
});

export const getPage = cache(async (tagPath: string, slug: string): Promise<WikiPage | null> => {
  return prisma.page.findFirst({ where: { tagPath, slug }, include: PAGE_INCLUDE }) as Promise<WikiPage | null>;
});

const sortOrderBy: Record<SortOrder, object> = {
  title: { title: 'asc' as const },
  newest: { createdAt: 'desc' as const },
  oldest: { createdAt: 'asc' as const },
  recent: { updatedAt: 'desc' as const },
};

function sortByDateMeta<T extends { metadata?: any }>(pages: T[], dir: number): T[] {
  return pages.sort((a, b) => {
    const da = (a.metadata as Record<string, string> | null)?.date || '';
    const db = (b.metadata as Record<string, string> | null)?.date || '';
    return (da < db ? -1 : da > db ? 1 : 0) * dir;
  });
}

export const getCategoryPages = cache(async (tagPath: string, sort?: SortOrder, limit = 200): Promise<WikiPage[]> => {
  const resolvedSort = sort ?? getSortOrder(tagPath.split('/'));
  const hasDateMeta = resolvedSort !== 'title' && getMetadataKeys(tagPath.split('/')).some(k => k.key === 'date' && k.type === 'date');
  const pages = await prisma.page.findMany({
    where: { tagPath },
    include: { author: AUTHOR_SELECT },
    orderBy: sortOrderBy[resolvedSort],
    take: limit,
  }) as WikiPage[];
  return hasDateMeta ? sortByDateMeta<WikiPage>(pages, resolvedSort === 'oldest' ? 1 : -1) : pages;
});

export const getPageHistory = cache(async (tagPath: string, slug: string) => {
  const page = await prisma.page.findFirst({
    where: { tagPath, slug },
    select: { id: true, title: true, version: true },
  });
  if (!page) return null;

  const revisions = await prisma.revision.findMany({
    where: { pageId: page.id },
    select: {
      id: true, title: true, version: true, changeType: true,
      changes: true, message: true, createdAt: true,
      author: AUTHOR_SELECT,
    },
    orderBy: { createdAt: 'desc' },
  });

  return { currentVersion: page.version, revisions };
});

export const getAdjacentPages = cache(async (tagPath: string, title: string, createdAt?: Date, updatedAt?: Date) => {
  const sort = getSortOrder(tagPath.split('/'));
  const select = { tagPath: true, slug: true, title: true, metadata: true } as const;
  const hasDateMeta = sort !== 'title' && sort !== 'recent' && getMetadataKeys(tagPath.split('/')).some(k => k.key === 'date' && k.type === 'date');

  // Date-metadata sort: fetch all and find neighbors in sorted array
  if (hasDateMeta) {
    const pages = await prisma.page.findMany({ where: { tagPath }, select });
    const sorted = sortByDateMeta(pages, sort === 'oldest' ? 1 : -1);
    const idx = sorted.findIndex(p => p.title === title);
    return { prev: idx > 0 ? sorted[idx - 1] : null, next: idx < sorted.length - 1 ? sorted[idx + 1] : null };
  }

  // Cursor-based: use DB ordering directly
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
});
