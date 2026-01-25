// src/types/blocks.ts - Shared block types

export type BlockType = 'content' | 'recentPages' | 'pageList' | 'columns' | 'assetPrice' | 'toc';

interface BaseBlock { id: string; type: BlockType; }

export interface ContentBlock extends BaseBlock { type: 'content'; text: string; }
export interface RecentPagesBlock extends BaseBlock { type: 'recentPages'; tagPath?: string; limit: number; }
export interface PageListBlock extends BaseBlock { type: 'pageList'; pageIds: string[]; }
export interface AssetPriceBlock extends BaseBlock { type: 'assetPrice'; resourceAddress?: string; showChange?: boolean; }
export interface TocBlock extends BaseBlock { type: 'toc'; }
export interface Column { id: string; width?: 'auto' | '1/2' | '1/3' | '2/3' | '1/4' | '3/4'; blocks: LeafBlock[]; }
export interface ColumnsBlock extends BaseBlock { type: 'columns'; columns: Column[]; gap?: 'sm' | 'md' | 'lg'; align?: 'start' | 'center' | 'end' | 'stretch'; }

export type LeafBlock = ContentBlock | RecentPagesBlock | PageListBlock | AssetPriceBlock | TocBlock;
export type Block = LeafBlock | ColumnsBlock;