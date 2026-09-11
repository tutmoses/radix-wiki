// src/types/blocks.ts — this wiki's block union.
//
// The union is per-repo on purpose: a closed union is what makes every
// `switch (block.type)` exhaustive, so a new block type is a compile error
// rather than a silent blank. The LEAF VALUE types are the shared part and come
// from `wiki-formant/blocks` — see the note above them.

// `resolvedPages` is filled server-side by resolveBlockData() in lib/wiki.ts and
// read by PageCard, so it is a full page row, not a narrowed ref. It was `any[]`,
// which cost markdown.ts a cast and BlockRenderer two `(p: any)` annotations.
import type { WikiPage } from '@/types';

// ---- the shared leaf types --------------------------------------------------
//
// `wiki-formant/blocks` owns these five, and the shared views in
// `wiki-formant/block-views` render them. This file used to REDECLARE four of
// them, with a comment explaining that the package's versions were not quite
// ours — `CodeTab.language` is optional there, `StatItem` carries no `id`. That
// reasoning is how a shared type stops being shared: two declarations of one
// shape, free to drift, with only prose holding them together.
//
// So they are DERIVED now. The intersection adds the identity an editor needs
// (a stable React key that is not the array index) and re-narrows the fields
// this wiki is stricter about. Every narrowing below is a deliberate difference
// from the package, stated once, in the place a reader looks for it — and a
// change to the package that contradicts one is a type error here rather than a
// silent divergence.
import type {
  CodeTab as SharedCodeTab,
  LinkGridGroup as SharedLinkGridGroup,
  ReferenceItem as SharedReferenceItem,
  StatItem as SharedStatItem,
} from 'wiki-formant/blocks';

export type { LinkGridLink } from 'wiki-formant/blocks';
import type { LinkGridLink } from 'wiki-formant/blocks';

/** Every tab here names its language; the package allows one to omit it. */
export type CodeTab = SharedCodeTab & { language: string };
/** A figure is authored as text, and carries an id so the editor can reorder it. */
export type StatItem = SharedStatItem & { id: string; value: string };
/** `url` is absent or a string, never null. */
export type ReferenceItem = SharedReferenceItem & { id: string; url?: string };
/** The editor mutates the link list in place, so it is not readonly. */
export type LinkGridGroup = SharedLinkGridGroup & { id: string; links: LinkGridLink[] };

export type BlockType = 'content' | 'recentPages' | 'pageList' | 'columns' | 'assetPrice' | 'infobox' | 'rssFeed' | 'codeTabs' | 'stats' | 'testimonial' | 'linkGrid' | 'tipJar' | 'references' | 'banner';

interface BaseBlock { id: string; type: BlockType; }

export interface ContentBlock extends BaseBlock { type: 'content'; text: string; }
export interface RecentPagesBlock extends BaseBlock { type: 'recentPages'; tagPath?: string; limit: number; resolvedPages?: WikiPage[]; }
export interface PageListBlock extends BaseBlock { type: 'pageList'; pageIds: string[]; resolvedPages?: WikiPage[]; }
export interface AssetPriceBlock extends BaseBlock { type: 'assetPrice'; resourceAddress?: string; showChange?: boolean; showChart?: boolean; chartTimeframe?: '24h' | '7d' | '30d'; }
export interface RssFeedBlock extends BaseBlock { type: 'rssFeed'; url: string; limit?: number; resolvedItems?: { title: string; link: string; image?: string; source: string; date?: string; description?: string }[]; }
export interface CodeTabsBlock extends BaseBlock { type: 'codeTabs'; tabs: CodeTab[]; }
export interface StatsBlock extends BaseBlock { type: 'stats'; items: StatItem[]; columns: 2 | 3 | 4; }
export interface TestimonialBlock extends BaseBlock { type: 'testimonial'; quote: string; author: string; role?: string; avatarUrl?: string; }
export interface LinkGridBlock extends BaseBlock { type: 'linkGrid'; intro?: string; groups: LinkGridGroup[]; }
export interface TipJarBlock extends BaseBlock { type: 'tipJar'; address: string; label?: string; message?: string; }
export interface ReferencesBlock extends BaseBlock { type: 'references'; title?: string; items: ReferenceItem[]; }
// Wikipedia-style top-of-article maintenance notices. `text` overrides the default message.
// The union is `wiki-formant/text`, which also owns BANNER_LABELS — the record
// this repo already imports to render them. Declared separately they can drift,
// and a variant with no label reads back as the raw key.
export type { BannerVariant } from 'wiki-formant/text';
import type { BannerVariant } from 'wiki-formant/text';
export interface BannerBlock extends BaseBlock { type: 'banner'; variant: BannerVariant; text?: string; }

// Atomic blocks that can be nested inside containers
export type AtomicBlock = ContentBlock | RecentPagesBlock | PageListBlock | AssetPriceBlock | RssFeedBlock | CodeTabsBlock | StatsBlock | TestimonialBlock | LinkGridBlock | TipJarBlock | ReferencesBlock | BannerBlock;

export interface InfoboxBlock extends BaseBlock {
  type: 'infobox';
  blocks: AtomicBlock[];
}

export interface Column { id: string; blocks: AtomicBlock[]; }
export interface ColumnsBlock extends BaseBlock { type: 'columns'; columns: Column[]; gap?: 'sm' | 'md' | 'lg'; align?: 'start' | 'center' | 'end' | 'stretch'; }

export type Block = AtomicBlock | InfoboxBlock | ColumnsBlock;