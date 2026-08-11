// src/lib/llms.ts — shared machinery for the llms.txt family of plain-text
// exports (/llms.txt, /llms-index.txt, /llms-full.txt).
//
// Also owns the corpus-level cache validators: every export derives its ETag
// and Last-Modified from one cheap aggregate over the pages table, so a
// recrawling agent pays a 304 instead of re-downloading megabytes.

import { prisma } from '@/lib/prisma/client';
import { TAG_HIERARCHY, type TagNode } from '@/lib/tags';
import { BASE_URL, getContentSnippet, pagePath } from '@/lib/utils';

export function collectCategories(nodes: TagNode[], parent = ''): { path: string; name: string }[] {
  return nodes.filter(n => !n.hidden).flatMap(n => {
    const path = parent ? `${parent}/${n.slug}` : n.slug;
    return [{ path, name: n.name }, ...(n.children ? collectCategories(n.children, path) : [])];
  });
}

/** Display-name lookup from top-level TAG_HIERARCHY slugs (emoji prefix stripped) */
export const SECTION_NAMES = new Map(
  TAG_HIERARCHY.filter(n => !n.hidden && n.slug).map(n => [n.slug, n.name.replace(/^\S+\s/, '')]),
);

/** Strip URLs, parenthesised URLs, and clean up whitespace from snippets */
export function cleanSnippet(s: string): string {
  return s
    .replace(/\(https?:\/\/[^)]*\)/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 160);
}

/** One markdown bullet for a page: linked title plus cleaned excerpt */
export function pageLine(p: { title: string; tagPath: string | null; slug: string | null; content: unknown }): string {
  const e = cleanSnippet(getContentSnippet(p.content));
  return `- [${p.title}](${BASE_URL}${pagePath(p.tagPath ?? '', p.slug ?? '')})${e ? `: ${e}` : ''}`;
}

/** Corpus-wide ETag + Last-Modified from page count and newest update. */
export async function corpusValidators() {
  const agg = await prisma.page.aggregate({ _count: true, _max: { updatedAt: true } });
  const stamp = agg._max.updatedAt ?? new Date(0);
  return {
    etag: `W/"${agg._count}-${stamp.getTime()}"`,
    lastModified: stamp.toUTCString(),
  };
}

/** 304 response when the client already holds the current corpus revision. */
export function notModified(request: Request, etag: string, lastModified: string): Response | null {
  const inm = request.headers.get('if-none-match');
  const ims = request.headers.get('if-modified-since');
  const fresh = inm ? inm === etag : Boolean(ims && ims === lastModified);
  if (!fresh) return null;
  return new Response(null, { status: 304, headers: { ETag: etag, 'Last-Modified': lastModified } });
}

export function textHeaders(etag: string, lastModified: string): Record<string, string> {
  return {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    ETag: etag,
    'Last-Modified': lastModified,
  };
}
