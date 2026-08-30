// src/lib/llms.ts — shared machinery for the llms.txt family of plain-text
// exports (/llms.txt, /llms-index.txt, /llms-full.txt).
//
// The conditional-GET plumbing (the corpus ETag, the 304, the text headers)
// and the excerpt/bullet formatting are `wiki-formant/http`, shared with the
// other wikis. What stays here is the part that is this wiki's: which
// aggregate defines a corpus revision, and how a page row becomes a bullet.

import { corpusEtag, notModified, textHeaders, cleanSnippet, pageLine as formantPageLine } from 'wiki-formant/http';
import { prisma } from '@/lib/prisma/client';
import { TAG_HIERARCHY, type TagNode } from '@/lib/tags';
import { getContentSnippet, pageUrl } from '@/lib/utils';

// Re-exported because the three llms routes reach for them through this module.
export { notModified, textHeaders, cleanSnippet };

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

/** One markdown bullet for a page: linked title plus cleaned excerpt. */
export function pageLine(p: { title: string; tagPath: string | null; slug: string | null; content: unknown }): string {
  return formantPageLine({
    title: p.title,
    url: pageUrl(p.tagPath ?? '', p.slug ?? ''),
    excerpt: getContentSnippet(p.content),
  });
}

/** Corpus-wide ETag + Last-Modified from page count and newest update. */
export async function corpusValidators() {
  const agg = await prisma.page.aggregate({ _count: true, _max: { updatedAt: true } });
  const stamp = agg._max.updatedAt ?? new Date(0);
  return {
    etag: corpusEtag([agg._count, stamp]),
    lastModified: stamp.toUTCString(),
  };
}
