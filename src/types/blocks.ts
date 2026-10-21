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
// Seven of the core blocks and the two containers are `wiki-formant/blocks`', the
// shape all three wikis store, so `wiki-formant/block-editor` can edit them.
// What stays here is what is this wiki's: the rows its list resolves to, which
// are its own page rows, and its native types.
import type {
  BannerBlock,
  CodeTabsBlock,
  ColumnsBlock as CoreColumnsBlock,
  ContentBlock,
  InfoboxBlock as CoreInfoboxBlock,
  LinkGridBlock,
  ListBlock as CoreListBlock,
  ReferencesBlock,
  StatsBlock,
  TestimonialBlock,
} from 'wiki-formant/blocks';
export type { CodeTabsBlock };
export type { BannerVariant } from 'wiki-formant/text';

export type BlockType = 'content' | 'list' | 'columns' | 'assetPrice' | 'networkChart' | 'infobox' | 'rssFeed' | 'codeTabs' | 'stats' | 'testimonial' | 'linkGrid' | 'tipJar' | 'references' | 'banner';

interface BaseBlock { id: string; type: BlockType; }

/** `under` is a tag path and `pages` page ids, in the order they are listed. */
export type ListBlock = CoreListBlock & { items?: WikiPage[] };
export interface AssetPriceBlock extends BaseBlock { type: 'assetPrice'; resourceAddress?: string; showChange?: boolean; showChart?: boolean; chartTimeframe?: ChartRange; }
/** Daily network activity, live: the /charts series for one metric, fetched on the reader's side. */
export interface NetworkChartBlock extends BaseBlock { type: 'networkChart'; metric: ActivityMetric; range?: ChartRange; }
export interface RssFeedBlock extends BaseBlock { type: 'rssFeed'; url: string; limit?: number; resolvedItems?: { title: string; link: string; image?: string; source: string; date?: string; description?: string }[]; }
export interface TipJarBlock extends BaseBlock { type: 'tipJar'; address: string; label?: string; message?: string; }

// Atomic blocks that can be nested inside containers
export type AtomicBlock = ContentBlock | ListBlock | AssetPriceBlock | NetworkChartBlock | RssFeedBlock | CodeTabsBlock | StatsBlock | TestimonialBlock | LinkGridBlock | TipJarBlock | ReferencesBlock | BannerBlock;

export type InfoboxBlock = CoreInfoboxBlock<AtomicBlock>;
export type ColumnsBlock = CoreColumnsBlock<AtomicBlock>;

export type Block = AtomicBlock | InfoboxBlock | ColumnsBlock;