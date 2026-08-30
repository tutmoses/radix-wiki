// src/lib/content.ts — a page as plain prose, for LLM and MCP exports.
//
// stripHtml, the banner labels and the leaf bodies are `wiki-formant/text`,
// shared with caper, which had the same ones character for character. What
// stays here is the dispatch: a switch over this repo's block union, where a
// new block type is a compile error until it is handled.

import { renderBlockTree } from 'wiki-formant/blocks';
import { bannerToText, codeTabsToText, referencesToText, stripHtml } from 'wiki-formant/text';
import type { Block, AtomicBlock } from '@/types/blocks';

export { decodeEntities } from 'wiki-formant';
export { stripHtml };
export { BANNER_LABELS } from 'wiki-formant/text';

import { BANNER_LABELS } from 'wiki-formant/text';

function atomicText(block: Block | AtomicBlock): string {
  switch (block.type) {
    case 'content': return stripHtml(block.text);
    case 'codeTabs': return codeTabsToText(block.tabs);
    case 'banner': return bannerToText(BANNER_LABELS[block.variant] ?? block.variant, block.text);
    case 'references': return referencesToText(block.items);
    default: return '';
  }
}

/** The page as prose. Containers flatten in document order. */
export function extractText(blocks: Block[]): string {
  return renderBlockTree<Block | AtomicBlock>(blocks, {
    atomic: atomicText,
    containers: b =>
      b.type === 'infobox' ? [b.blocks]
      : b.type === 'columns' ? b.columns.map(col => col.blocks)
      : null,
    // Prose, not typesetting: a single newline inside a container.
    groupSeparator: '\n',
  });
}
