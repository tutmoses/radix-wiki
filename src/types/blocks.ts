// src/types/blocks.ts - Shared block types

export type BlockType = 'content' | 'recentPages' | 'pageList' | 'columns' | 'assetPrice' | 'infobox' | 'rssFeed' | 'codeTabs';

interface BaseBlock { id: string; type: BlockType; }

export interface ContentBlock extends BaseBlock { type: 'content'; text: string; }
export interface RecentPagesBlock extends BaseBlock { type: 'recentPages'; tagPath?: string; limit: number; resolvedPages?: any[]; }
export interface PageListBlock extends BaseBlock { type: 'pageList'; pageIds: string[]; resolvedPages?: any[]; }
export interface AssetPriceBlock extends BaseBlock { type: 'assetPrice'; resourceAddress?: string; showChange?: boolean; }
export interface RssFeedBlock extends BaseBlock { type: 'rssFeed'; url: string; limit?: number; }
export interface CodeTab { label: string; language: string; code: string; }
export interface CodeTabsBlock extends BaseBlock { type: 'codeTabs'; tabs: CodeTab[]; }

// Atomic blocks that can be nested inside containers
export type AtomicBlock = ContentBlock | RecentPagesBlock | PageListBlock | AssetPriceBlock | RssFeedBlock | CodeTabsBlock;

export interface InfoboxBlock extends BaseBlock {
  type: 'infobox';
  blocks: AtomicBlock[];
}

export interface Column { id: string; blocks: AtomicBlock[]; }
export interface ColumnsBlock extends BaseBlock { type: 'columns'; columns: Column[]; gap?: 'sm' | 'md' | 'lg'; align?: 'start' | 'center' | 'end' | 'stretch'; }

export type Block = AtomicBlock | InfoboxBlock | ColumnsBlock;