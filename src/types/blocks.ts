// src/types/blocks.ts - Shared block types

export type BlockType = 'content' | 'recentPages' | 'pageList' | 'columns' | 'assetPrice' | 'infobox';

interface BaseBlock { id: string; type: BlockType; }

export interface ContentBlock extends BaseBlock { type: 'content'; text: string; }
export interface RecentPagesBlock extends BaseBlock { type: 'recentPages'; tagPath?: string; limit: number; }
export interface PageListBlock extends BaseBlock { type: 'pageList'; pageIds: string[]; }
export interface AssetPriceBlock extends BaseBlock { type: 'assetPrice'; resourceAddress?: string; showChange?: boolean; }

// Atomic blocks that can be nested inside containers
export type AtomicBlock = ContentBlock | RecentPagesBlock | PageListBlock | AssetPriceBlock;

export interface InfoboxRow { label: string; value: string; }
export interface InfoboxBlock extends BaseBlock {
  type: 'infobox';
  title?: string;
  image?: string;
  caption?: string;
  rows: InfoboxRow[];
  mapUrl?: string;
  blocks: AtomicBlock[];
}

export interface Column { id: string; blocks: AtomicBlock[]; }
export interface ColumnsBlock extends BaseBlock { type: 'columns'; columns: Column[]; gap?: 'sm' | 'md' | 'lg'; align?: 'start' | 'center' | 'end' | 'stretch'; }

export type LeafBlock = AtomicBlock | InfoboxBlock;
export type Block = LeafBlock | ColumnsBlock;