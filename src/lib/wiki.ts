// src/lib/wiki.ts - Server-side data fetching

import { prisma } from '@/lib/prisma/client';
import { isValidTagPath } from '@/lib/tags';
import type { WikiPage } from '@/types';

export interface WikiPageWithRevisions extends WikiPage {
  revisions?: { id: string }[];
}

export interface ParsedPath {
  type: 'homepage' | 'category' | 'page' | 'history' | 'edit' | 'invalid';
  tagPath: string;
  slug: string;
  isEditMode: boolean;
  isHistoryMode: boolean;
}

export interface SiblingPages {
  prev: { title: string; href: string } | null;
  next: { title: string; href: string } | null;
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

export async function getHomepage(): Promise<WikiPageWithRevisions | null> {
  return prisma.page.findFirst({
    where: { tagPath: '', slug: '' },
    include: {
      author: { select: { id: true, displayName: true, radixAddress: true } },
      revisions: { select: { id: true } },
    },
  }) as Promise<WikiPageWithRevisions | null>;
}

export async function getPage(tagPath: string, slug: string): Promise<WikiPageWithRevisions | null> {
  return prisma.page.findFirst({
    where: { tagPath, slug },
    include: {
      author: { select: { id: true, displayName: true, radixAddress: true } },
      revisions: { select: { id: true } },
    },
  }) as Promise<WikiPageWithRevisions | null>;
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
    select: { id: true, title: true },
  });
  if (!page) return null;

  const revisions = await prisma.revision.findMany({
    where: { pageId: page.id },
    select: {
      id: true,
      title: true,
      message: true,
      createdAt: true,
      author: { select: { id: true, displayName: true, radixAddress: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return { page, revisions };
}

export async function getSiblingPages(tagPath: string, slug: string): Promise<SiblingPages> {
  const currentPage = await prisma.page.findFirst({
    where: { tagPath, slug },
    select: { title: true },
  });
  if (!currentPage) return { prev: null, next: null };

  const [prev, next] = await Promise.all([
    prisma.page.findFirst({
      where: { tagPath, title: { lt: currentPage.title } },
      orderBy: { title: 'desc' },
      select: { title: true, slug: true, tagPath: true },
    }),
    prisma.page.findFirst({
      where: { tagPath, title: { gt: currentPage.title } },
      orderBy: { title: 'asc' },
      select: { title: true, slug: true, tagPath: true },
    }),
  ]);

  return {
    prev: prev ? { title: prev.title, href: `/${prev.tagPath}/${prev.slug}` } : null,
    next: next ? { title: next.title, href: `/${next.tagPath}/${next.slug}` } : null,
  };
}