// src/types/blocks.ts - Shared block types (12-type standard)

export type BlockType = 'content' | 'recentPages' | 'pageList' | 'columns' | 'assetPrice' | 'infobox' | 'rssFeed' | 'codeTabs' | 'store' | 'footer' | 'stats' | 'testimonial' | 'linkGrid';

interface BaseBlock { id: string; type: BlockType; }

export interface ContentBlock extends BaseBlock { type: 'content'; text: string; }
export interface RecentPagesBlock extends BaseBlock { type: 'recentPages'; tagPath?: string; limit: number; resolvedPages?: any[]; }
export interface PageListBlock extends BaseBlock { type: 'pageList'; pageIds: string[]; resolvedPages?: any[]; }
export interface AssetPriceBlock extends BaseBlock { type: 'assetPrice'; resourceAddress?: string; showChange?: boolean; showChart?: boolean; chartTimeframe?: '24h' | '7d' | '30d'; }
export interface RssFeedBlock extends BaseBlock { type: 'rssFeed'; url: string; limit?: number; }
export interface CodeTab { label: string; language: string; code: string; }
export interface CodeTabsBlock extends BaseBlock { type: 'codeTabs'; tabs: CodeTab[]; }
export interface StoreBlock extends BaseBlock { type: 'store'; columns: 2 | 3 | 4; showPrice: boolean; }
export interface FooterBlock extends BaseBlock { type: 'footer'; text?: string; showLinks?: boolean; }
export interface StatItem { id: string; value: string; label: string; suffix?: string; }
export interface StatsBlock extends BaseBlock { type: 'stats'; items: StatItem[]; columns: 2 | 3 | 4; }
export interface TestimonialBlock extends BaseBlock { type: 'testimonial'; quote: string; author: string; role?: string; avatarUrl?: string; }
export interface LinkGridLink { label: string; href: string; }
export interface LinkGridGroup { id: string; heading: string; description?: string; links: LinkGridLink[]; }
export interface LinkGridBlock extends BaseBlock { type: 'linkGrid'; intro?: string; groups: LinkGridGroup[]; }

// Atomic blocks that can be nested inside containers
export type AtomicBlock = ContentBlock | RecentPagesBlock | PageListBlock | AssetPriceBlock | RssFeedBlock | CodeTabsBlock | StoreBlock | FooterBlock | StatsBlock | TestimonialBlock | LinkGridBlock;

export interface InfoboxBlock extends BaseBlock {
  type: 'infobox';
  blocks: AtomicBlock[];
}

export interface Column { id: string; blocks: AtomicBlock[]; }
export interface ColumnsBlock extends BaseBlock { type: 'columns'; columns: Column[]; gap?: 'sm' | 'md' | 'lg'; align?: 'start' | 'center' | 'end' | 'stretch'; }

export type Block = AtomicBlock | InfoboxBlock | ColumnsBlock;