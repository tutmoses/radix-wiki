// src/lib/wiki.ts - Server-side data fetching

import { prisma } from '@/lib/prisma/client';
import { isValidTagPath } from '@/lib/tags';
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

  const lastSegment = segments[segments.length - 1];
  const isEditMode = lastSegment === 'edit';
  const isHistoryMode = lastSegment === 'history';
  const pathSegments = (isEditMode || isHistoryMode) ? segments.slice(0, -1) : segments;

  if (isValidTagPath(pathSegments)) {
    return { type: 'category', tagPath: pathSegments.join('/'), slug: '', isEditMode, isHistoryMode };
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
export interface ApiParsedPath {
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

export async function getHomepage(): Promise<WikiPage | null> {
  return prisma.page.findFirst({
    where: { tagPath: '', slug: '' },
    include: {
      author: { select: { id: true, displayName: true, radixAddress: true } },
      revisions: { select: { id: true } },
    },
  }) as Promise<WikiPage | null>;
}

export async function getPage(tagPath: string, slug: string): Promise<WikiPage | null> {
  return prisma.page.findFirst({
    where: { tagPath, slug },
    include: {
      author: { select: { id: true, displayName: true, radixAddress: true } },
      revisions: { select: { id: true } },
    },
  }) as Promise<WikiPage | null>;
}

export async function getCategoryPages(tagPath: string, limit = 50) {
  return prisma.page.findMany({
    where: { tagPath: { startsWith: tagPath } },
    include: { author: { select: { id: true, displayName: true, radixAddress: true } } },
    orderBy: { title: 'asc' },
    take: limit,
  });
}

export async function getPageHistory(tagPath: string, slug: string) {
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
}

export async function getAdjacentPages(tagPath: string, title: string) {
  const [prev, next] = await Promise.all([
    prisma.page.findFirst({
      where: { tagPath, title: { lt: title } },
      orderBy: { title: 'desc' },
      select: { tagPath: true, slug: true, title: true },
    }),
    prisma.page.findFirst({
      where: { tagPath, title: { gt: title } },
      orderBy: { title: 'asc' },
      select: { tagPath: true, slug: true, title: true },
    }),
  ]);
  return { prev, next };
}