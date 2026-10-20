// src/lib/content.ts — a page as plain prose, for LLM and MCP exports.
//
// The core leaf bodies are `wiki-formant/blocks`' `coreAtomicText`, shared with
// the other two wikis. What stays here is the dispatch: a switch
// over this repo's block union, where a new block type is a compile error until
// it is handled.

import { coreAtomicText, renderBlockTree } from 'wiki-formant/blocks';
import { BLOCK_SHAPE } from '@/lib/block-shape';
import { atomicToMarkdown } from '@/lib/markdown';
import type { Block, AtomicBlock } from '@/types/blocks';

function atomicText(block: Block | AtomicBlock): string {
  switch (block.type) {
    case 'content': case 'codeTabs': case 'banner': case 'references':
    case 'stats': case 'linkGrid': case 'testimonial':
      return coreAtomicText(block);
    // Page lists resolve server-side (`resolveBlockData`) and the rest are live
    // widgets, so a raw row reads as the `.md` twin's line for it: the live URL,
    // or the tip address, rather than nothing.
    case 'recentPages': case 'pageList':
      return block.resolvedPages?.length ? coreAtomicText(block) : atomicToMarkdown(block);
    case 'rssFeed': case 'assetPrice': case 'networkChart': case 'tipJar':
      return atomicToMarkdown(block);
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
