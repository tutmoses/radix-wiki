// src/types/blocks.ts — this wiki's block union.
//
// The union is per-repo on purpose: a closed union is what makes every
// `switch (block.type)` exhaustive, so a new block type is a compile error
// rather than a silent blank. The core blocks it is built from are the shared
// part and come from `wiki-formant/blocks` — see the note below.

// A list's `items` are filled server-side by resolveBlockData() in lib/wiki.ts and
// read by PageCard, so they are full page rows, not narrowed refs.
import type { WikiPage } from '@/types';
import type { ChartRange } from 'wiki-formant/chart';
import type { ActivityMetric } from '@/lib/radix/metrics';

// ---- the shared core ---------------------------------------------------------
//
// The core leaves and the two containers are `wiki-formant/blocks`', the shape
// all four apps store, so `wiki-formant/block-editor` can edit them, and a leaf
// added there arrives here with the release. What stays here is what is this
// wiki's: the rows its list resolves to, which are its own page rows, and its
// native types.
import type {
  BlockTree,
  CodeTabsBlock,
  ColumnsBlock as CoreColumnsBlock,
  CoreLeafBlock,
  InfoboxBlock as CoreInfoboxBlock,
  ListBlock as CoreListBlock,
} from 'wiki-formant/blocks';
export type { CodeTabsBlock };
export type { BannerVariant } from 'wiki-formant/text';

interface BaseBlock { id: string; }

/** `under` is a tag path and `pages` page ids, in the order they are listed. */
export type ListBlock = CoreListBlock & { items?: WikiPage[] };
export interface AssetPriceBlock extends BaseBlock { type: 'assetPrice'; resourceAddress?: string; showChange?: boolean; showChart?: boolean; chartTimeframe?: ChartRange; }
/** Daily network activity, live: the /charts series for one metric, fetched on the reader's side. */
export interface NetworkChartBlock extends BaseBlock { type: 'networkChart'; metric: ActivityMetric; range?: ChartRange; }
export interface RssFeedBlock extends BaseBlock { type: 'rssFeed'; url: string; limit?: number; resolvedItems?: { title: string; link: string; image?: string; source: string; date?: string; description?: string }[]; }
export interface TipJarBlock extends BaseBlock { type: 'tipJar'; address: string; label?: string; message?: string; }

// Atomic blocks that can be nested inside containers
export type AtomicBlock = CoreLeafBlock | ListBlock | AssetPriceBlock | NetworkChartBlock | RssFeedBlock | TipJarBlock;

export type InfoboxBlock = CoreInfoboxBlock<AtomicBlock>;
export type ColumnsBlock = CoreColumnsBlock<AtomicBlock>;
export type Block = BlockTree<AtomicBlock>;
export type BlockType = Block['type'];