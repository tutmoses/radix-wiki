// src/types/blocks.ts - Shared block types

export type BlockType = 'content' | 'recentPages' | 'pageList' | 'columns' | 'assetPrice';

interface BaseBlock { id: string; type: BlockType; }

export interface ContentBlock extends BaseBlock { type: 'content'; text: string; }
export interface RecentPagesBlock extends BaseBlock { type: 'recentPages'; tagPath?: string; limit: number; }
export interface PageListBlock extends BaseBlock { type: 'pageList'; pageIds: string[]; }
export interface AssetPriceBlock extends BaseBlock { type: 'assetPrice'; resourceAddress?: string; showChange?: boolean; }
export interface Column { id: string; blocks: LeafBlock[]; }
export interface ColumnsBlock extends BaseBlock { type: 'columns'; columns: Column[]; gap?: 'sm' | 'md' | 'lg'; align?: 'start' | 'center' | 'end' | 'stretch'; }

export type LeafBlock = ContentBlock | RecentPagesBlock | PageListBlock | AssetPriceBlock;
export type Block = LeafBlock | ColumnsBlock;