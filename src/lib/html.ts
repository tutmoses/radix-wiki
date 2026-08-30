// src/lib/html.ts — HTML post-processing for wiki content rendering.
//
// The two routines this used to spell out — heading ids and anchor
// normalisation — are `wiki-formant/headings` and `wiki-formant/links`, shared
// with caper, which had written out the same ones. What stays here is this
// wiki's own decisions: which slug rule its published anchors were minted
// under, its own host, and the h1 demotion.

import { injectHeadingIds } from 'wiki-formant/headings';
import { normaliseLinks } from 'wiki-formant/links';
import { slugify } from '@/lib/utils';
import type { Block, AtomicBlock } from '@/types/blocks';

/** Process HTML content for display: heading ids + anchors, link normalisation, alt attrs. */
export function processHtml(html: string, citedRefs?: Set<number>): string {
  if (!html.trim()) return html;

  // Demote h1 in content to h2 (the page title is the only h1), then ids and a
  // hover permalink anchor on what is left. `slugify` is passed rather than
  // defaulted because it is the rule this wiki's published anchors were minted
  // under, and an id is a URL.
  const withHeadings = injectHeadingIds(
    html.replace(/<h1(\s[^>]*)?>([\s\S]*?)<\/h1>/gi, '<h2$1>$2</h2>'),
    { slug: slugify },
  );

  const withAlts = withHeadings.replace(/<img\b([^>]*)>/gi, (match, attrs) =>
    /\salt\s*=/i.test(attrs) ? match : `<img${attrs} alt="">`,
  );

  return normaliseLinks(withAlts, { selfHost: 'radix.wiki', citedRefs });
}

/** Apply processHtml to every content block recursively (for SSR normalisation). */
export function processBlocks(blocks: Block[]): Block[] {
  // Shared across content blocks so citation `id="cite-n"` targets are unique
  // doc-wide.
  const citedRefs = new Set<number>();
  const mapAtomic = (b: AtomicBlock): AtomicBlock =>
    b.type === 'content' && typeof b.text === 'string' ? { ...b, text: processHtml(b.text, citedRefs) } : b;

  return blocks.map((block): Block => {
    if (block.type === 'content') return mapAtomic(block) as Block;
    if (block.type === 'infobox') return { ...block, blocks: block.blocks.map(mapAtomic) };
    if (block.type === 'columns') return { ...block, columns: block.columns.map(col => ({ ...col, blocks: col.blocks.map(mapAtomic) })) };
    return block;
  });
}
