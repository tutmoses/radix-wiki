// src/lib/wiki.ts - Server-side data fetching

import { cache } from 'react';
import { prisma } from '@/lib/prisma/client';
import { isValidTagPath, getSortOrder, getMetadataKeys, type SortOrder } from '@/lib/tags';
import type { WikiPage } from '@/types';

export interface ParsedPath {
  type: 'homepage' | 'category' | 'page' | 'history' | 'edit' | 'list' | 'invalid';
  tagPath: string;
  slug: string;
  isEditMode: boolean;
  isHistoryMode: boolean;
}

export function parsePath(segments: string[] = []): ParsedPath {
  if (segments.length === 0) return { type: 'homepage', tagPath: '', slug: '', isEditMode: false, isHistoryMode: false };
  if (segments.length === 1 && segments[0] === 'edit') return { type: 'edit', tagPath: '', slug: '', isEditMode: true, isHistoryMode: false };
  if (segments.length === 1 && segments[0] === 'history') return { type: 'history', tagPath: '', slug: '', isEditMode: false, isHistoryMode: true };

  // Check full path as tag first (handles tags like 'history' that collide with suffixes)
  if (isValidTagPath(segments)) {
    return { type: 'category', tagPath: segments.join('/'), slug: '', isEditMode: false, isHistoryMode: false };
  }

  const lastSegment = segments[segments.length - 1];
  const isEditMode = lastSegment === 'edit';
  const isHistoryMode = lastSegment === 'history';
  const pathSegments = (isEditMode || isHistoryMode) ? segments.slice(0, -1) : segments;

  if (isValidTagPath(pathSegments)) {
    if (isEditMode) return { type: 'category', tagPath: pathSegments.join('/'), slug: '', isEditMode: true, isHistoryMode: false };
    if (isHistoryMode) return { type: 'category', tagPath: pathSegments.join('/'), slug: '', isEditMode: false, isHistoryMode: true };
  }

  const tagPathSegments = pathSegments.slice(0, -1);
  const slug = pathSegments[pathSegments.length - 1];
  const tagPath = tagPathSegments.join('/');

  if (!isValidTagPath(tagPathSegments)) {
    return { type: 'invalid', tagPath: '', slug: '', isEditMode: false, isHistoryMode: false };
  }

  if (isHistoryMode) return { type: 'history', tagPath, slug, isEditMode: false, isHistoryMode: true };
  if (isEditMode) return { type: 'edit', tagPath, slug, isEditMode: true, isHistoryMode: false };
  return { type: 'page', tagPath, slug, isEditMode: false, isHistoryMode: false };
}

// API-specific path parsing (excludes edit mode, simpler return type)
interface ApiParsedPath {
  type: 'homepage' | 'list' | 'page' | 'history' | 'mdx';
  tagPath: string;
  slug: string;
}

export function parseApiPath(segments: string[] = []): ApiParsedPath | null {
  if (segments.length === 0) return { type: 'homepage', tagPath: '', slug: '' };
  if (segments.length === 1 && segments[0] === 'history') return { type: 'history', tagPath: '', slug: '' };
  if (segments.length === 1 && segments[0] === 'mdx') return { type: 'mdx', tagPath: '', slug: '' };

  const lastSegment = segments[segments.length - 1];
  const isHistory = lastSegment === 'history';
  const isMdx = lastSegment === 'mdx';
  const pathSegments = (isHistory || isMdx) ? segments.slice(0, -1) : segments;

  if (pathSegments.length < 2) return null;

  const slug = pathSegments[pathSegments.length - 1];
  const tagPathSegments = pathSegments.slice(0, -1);

  if (!isValidTagPath(tagPathSegments)) return null;

  return {
    type: isHistory ? 'history' : isMdx ? 'mdx' : 'page',
    tagPath: tagPathSegments.join('/'),
    slug,
  };
}

export const getHomepage = cache(async (): Promise<WikiPage | null> => {
  return prisma.page.findFirst({
    where: { tagPath: '', slug: '' },
    include: {
      author: { select: { id: true, displayName: true, radixAddress: true } },
      _count: { select: { revisions: true } },
    },
  }) as Promise<WikiPage | null>;
});

export const getPage = cache(async (tagPath: string, slug: string): Promise<WikiPage | null> => {
  return prisma.page.findFirst({
    where: { tagPath, slug },
    include: {
      author: { select: { id: true, displayName: true, radixAddress: true } },
      _count: { select: { revisions: true } },
    },
  }) as Promise<WikiPage | null>;
});

const sortOrderBy: Record<SortOrder, object> = {
  title: { title: 'asc' as const },
  newest: { createdAt: 'desc' as const },
  oldest: { createdAt: 'asc' as const },
};

export const getCategoryPages = cache(async (tagPath: string, sort?: SortOrder, limit = 200): Promise<WikiPage[]> => {
  const resolvedSort = sort ?? getSortOrder(tagPath.split('/'));
  const hasDateMeta = resolvedSort !== 'title' && getMetadataKeys(tagPath.split('/')).some(k => k.key === 'date' && k.type === 'date');
  const pages = await prisma.page.findMany({
    where: { tagPath },
    include: { author: { select: { id: true, displayName: true, radixAddress: true } } },
    orderBy: sortOrderBy[resolvedSort],
    take: limit,
  }) as WikiPage[];
  if (!hasDateMeta) return pages;
  const dir = resolvedSort === 'oldest' ? 1 : -1;
  return pages.sort((a, b) => {
    const da = (a.metadata as Record<string, string> | null)?.date || '';
    const db = (b.metadata as Record<string, string> | null)?.date || '';
    return (da < db ? -1 : da > db ? 1 : 0) * dir;
  });
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
      id: true,
      title: true,
      version: true,
      changeType: true,
      changes: true,
      message: true,
      createdAt: true,
      author: { select: { id: true, displayName: true, radixAddress: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return { currentVersion: page.version, revisions };
});

export const getAdjacentPages = cache(async (tagPath: string, title: string, createdAt?: Date) => {
  const sort = getSortOrder(tagPath.split('/'));
  const select = { tagPath: true, slug: true, title: true, metadata: true } as const;
  const hasDateMeta = sort !== 'title' && getMetadataKeys(tagPath.split('/')).some(k => k.key === 'date' && k.type === 'date');

  if (hasDateMeta) {
    const pages = await prisma.page.findMany({ where: { tagPath }, select });
    const dir = sort === 'oldest' ? 1 : -1;
    const sorted = pages.sort((a, b) => {
      const da = (a.metadata as Record<string, string> | null)?.date || '';
      const db = (b.metadata as Record<string, string> | null)?.date || '';
      return (da < db ? -1 : da > db ? 1 : 0) * dir;
    });
    const currentDate = (sorted.find(p => p.title === title)?.metadata as Record<string, string> | null)?.date || '';
    const idx = sorted.findIndex(p => p.title === title && ((p.metadata as Record<string, string> | null)?.date || '') === currentDate);
    return { prev: idx > 0 ? sorted[idx - 1] : null, next: idx < sorted.length - 1 ? sorted[idx + 1] : null };
  }

  if (sort !== 'title' && createdAt) {
    const isNewest = sort === 'newest';
    const [prev, next] = await Promise.all([
      prisma.page.findFirst({
        where: { tagPath, createdAt: isNewest ? { gt: createdAt } : { lt: createdAt } },
        orderBy: { createdAt: isNewest ? 'asc' : 'desc' },
        select,
      }),
      prisma.page.findFirst({
        where: { tagPath, createdAt: isNewest ? { lt: createdAt } : { gt: createdAt } },
        orderBy: { createdAt: isNewest ? 'desc' : 'asc' },
        select,
      }),
    ]);
    return { prev, next };
  }

  const [prev, next] = await Promise.all([
    prisma.page.findFirst({
      where: { tagPath, title: { lt: title } },
      orderBy: { title: 'desc' },
      select,
    }),
    prisma.page.findFirst({
      where: { tagPath, title: { gt: title } },
      orderBy: { title: 'asc' },
      select,
    }),
  ]);
  return { prev, next };
});