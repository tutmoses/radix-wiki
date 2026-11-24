// src/lib/html.ts — HTML post-processing for wiki content rendering.
//
// Heading ids, table scroll boxes and anchor normalisation are
// `wiki-formant/headings`' `articleHtml`. What stays here is this wiki's own
// decisions: which slug rule its published anchors were minted under, its own
// host, the h1 demotion and the empty alts.

import { articleHtml, headingsFrom, referencesHeading, slugifyHeading, type Heading } from 'wiki-formant/headings';
import type { Block } from '@/types/blocks';
import { mapBlockTree } from 'wiki-formant/blocks';
import { BLOCK_SHAPE, leafBlocks } from '@/lib/block-utils';
import { SITE_URL } from '@/lib/site';

const SELF_HOST = new URL(SITE_URL).host;

/**
 * Process HTML content for display: alt attrs, heading ids + anchors, table scroll boxes, link normalisation.
 * `used` is the page's heading ids so far, shared across its blocks.
 */
export function processHtml(html: string, citedRefs?: Set<number>, used?: Set<string>): string {
  if (!html.trim()) return html;

  // Demote h1 in content to h2 (the page title is the only h1). The sanitiser
  // writes `<img … />`, so the alt goes before the slash.
  const prepared = html
    .replace(/<h1(\s[^>]*)?>([\s\S]*?)<\/h1>/gi, '<h2$1>$2</h2>')
    .replace(/<img\b([^>]*?)\s*\/?>/gi, (match, attrs) => (/\salt\s*=/i.test(attrs) ? match : `<img${attrs} alt="">`));

  // `slugifyHeading` is passed rather than defaulted because it is the rule this
  // wiki's published anchors were minted under, and an id is a URL.
  return articleHtml(prepared, { slug: slugifyHeading, used, links: { selfHost: SELF_HOST, citedRefs } });
}

/**
 * Apply processHtml to every content block recursively (for SSR normalisation).
 * `reserved` is the ids the page template renders itself, its `<h1>`'s among them.
 */
export function processBlocks(blocks: Block[], reserved: string[] = []): Block[] {
  // Shared across content blocks so citation `id="cite-n"` targets, and heading
  // ids, are unique doc-wide: two blocks with the same heading minted the same id.
  const citedRefs = new Set<number>();
  const used = new Set(reserved);
  // The container walk is `mapBlockTree` from `wiki-formant/blocks`. It was
  // written out here, and in four other files in this repo.
  return mapBlockTree(
    blocks,
    b => (b.type === 'content' && typeof b.text === 'string' ? { ...b, text: processHtml(b.text, citedRefs, used) } : b),
    BLOCK_SHAPE,
  );
}

/**
 * An article's "On this page": its title, then the h2s and h3s of its prose
 * (the infobox's left out), with the ids `processBlocks` gives them, and with
 * `references` the heading each references section the view draws, then
 * `after`, the headings the view draws below the blocks. Read from the blocks,
 * published or a draft, never from the DOM. None for an article without sections.
 */
export function pageHeadings(title: string, blocks: Block[], { references = false, after = [] }: { references?: boolean; after?: Heading[] } = {}): Heading[] {
  const titleId = slugifyHeading(title);
  const used = new Set([titleId]);
  const sections = [
    ...leafBlocks(blocks.filter(b => b.type !== 'infobox')).flatMap(b =>
      b.type === 'content' ? headingsFrom(processHtml(b.text ?? '', undefined, used)).filter(h => h.level <= 3)
      : b.type === 'references' && references && b.items?.length ? [referencesHeading(undefined, b.title || undefined)]
      : []),
    ...after,
  ];
  return sections.length ? [...(titleId ? [{ id: titleId, text: title, level: 1 }] : []), ...sections] : [];
}
