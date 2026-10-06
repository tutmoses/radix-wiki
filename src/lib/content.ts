// src/lib/content.ts — a page as plain prose, for LLM and MCP exports.
//
// The core leaf bodies are `wiki-formant/blocks`' `coreAtomicText`, shared with
// the other two wikis. What stays here is the dispatch: a switch
// over this repo's block union, where a new block type is a compile error until
// it is handled.

import { coreAtomicText, renderBlockTree } from 'wiki-formant/blocks';
import { BLOCK_SHAPE } from '@/lib/block-shape';
import type { Block, AtomicBlock } from '@/types/blocks';

export { decodeEntities } from 'wiki-formant/markdown';

function atomicText(block: Block | AtomicBlock): string {
  switch (block.type) {
    // Page lists are resolved server-side, so they read only after
    // `resolveBlockData`; a raw row has no `resolvedPages` and extracts to empty.
    case 'content': case 'codeTabs': case 'banner': case 'references':
    case 'stats': case 'linkGrid': case 'recentPages': case 'pageList':
      return coreAtomicText(block);
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
