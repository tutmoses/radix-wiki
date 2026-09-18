// src/lib/block-shape.ts – how a container block exposes and rebuilds its nested
// groups, for every walk over a page. Its own file because the content and
// markdown modules sit under client imports, and block-utils carries the
// editor's icon set.
//
// The shape is `wiki-formant/blocks`: this wiki's two containers are the core
// two, stored the way all three wikis store them.

import { coreBlockShape, leafBlocks as leaves } from 'wiki-formant/blocks';
import type { AtomicBlock, Block } from '@/types/blocks';

export const BLOCK_SHAPE = coreBlockShape<Block>();

/** Every leaf in document order, with the containers flattened away. */
export const leafBlocks = (blocks: Block[]): AtomicBlock[] =>
  leaves(blocks, BLOCK_SHAPE.containers) as AtomicBlock[];
