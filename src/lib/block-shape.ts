// src/lib/block-shape.ts – how a container block exposes and rebuilds its nested
// groups, for every walk over a page. Its own file because the content and
// markdown modules sit under client imports, and block-utils carries the
// editor's icon set.

import type { AtomicBlock, Block } from '@/types/blocks';

export const BLOCK_SHAPE = {
  containers: (block: Block) =>
    block.type === 'infobox' ? [block.blocks as Block[]]
    : block.type === 'columns' ? block.columns.map(col => col.blocks as Block[])
    : null,
  rebuild: (block: Block, groups: Block[][]): Block =>
    block.type === 'infobox' ? { ...block, blocks: groups[0] as AtomicBlock[] }
    : block.type === 'columns'
      ? { ...block, columns: block.columns.map((col, i) => ({ ...col, blocks: groups[i] as AtomicBlock[] })) }
      : block,
};

/** Every leaf in document order, with the containers flattened away. */
export const leafBlocks = (blocks: Block[]): AtomicBlock[] =>
  blocks.flatMap(block => BLOCK_SHAPE.containers(block)?.flatMap(leafBlocks) ?? [block as AtomicBlock]);
