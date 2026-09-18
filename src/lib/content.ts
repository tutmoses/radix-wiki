// src/lib/content.ts — a page as plain prose, for LLM and MCP exports.
//
// stripHtml, the banner labels and the leaf bodies are `wiki-formant/text`,
// shared with the other two wikis. What stays here is the dispatch: a switch
// over this repo's block union, where a new block type is a compile error until
// it is handled.

import { renderBlockTree } from 'wiki-formant/blocks';
import {
  BANNER_LABELS,
  bannerToText,
  codeTabsToText,
  linkGridToText,
  pageListToText,
  referencesToText,
  statsToText,
  stripHtml,
} from 'wiki-formant/text';
import { BLOCK_SHAPE } from '@/lib/block-shape';
import type { Block, AtomicBlock } from '@/types/blocks';

export { decodeEntities } from 'wiki-formant';
export { stripHtml, BANNER_LABELS };

function atomicText(block: Block | AtomicBlock): string {
  switch (block.type) {
    case 'content': return stripHtml(block.text);
    case 'codeTabs': return codeTabsToText(block.tabs);
    case 'banner': return bannerToText(BANNER_LABELS[block.variant] ?? block.variant, block.text);
    case 'references': return referencesToText(block.items);
    case 'stats': return statsToText(block.items);
    case 'linkGrid': return linkGridToText(block.groups, block.intro);
    // Resolved server-side, so these read only after `resolveBlockData`; a raw
    // row has no `resolvedPages` and extracts to empty.
    case 'recentPages':
    case 'pageList': return pageListToText(block.resolvedPages ?? []);
    default: return '';
  }
}

/** The page as prose. Containers flatten in document order. */
export function extractText(blocks: Block[]): string {
  return renderBlockTree<Block>(blocks, {
    atomic: atomicText,
    containers: BLOCK_SHAPE.containers,
    // Prose, not typesetting: a single newline inside a container.
    groupSeparator: '\n',
  });
}
