// src/lib/blocks.ts

export type BlockType =
  | 'text' | 'media' | 'callout' | 'divider'
  | 'code' | 'quote' | 'table' | 'toc' | 'recentPages' | 'pageList' | 'columns' | 'assetPrice';

interface BaseBlock { id: string; type: BlockType; }

export interface TextBlock extends BaseBlock { type: 'text'; text: string; }
export interface MediaBlock extends BaseBlock { type: 'media'; mediaType: 'image' | 'video' | 'embed'; src: string; alt?: string; caption?: string; }
export interface CalloutBlock extends BaseBlock { type: 'callout'; title?: string; text: string; }
export interface DividerBlock extends BaseBlock { type: 'divider'; }
export interface CodeBlock extends BaseBlock { type: 'code'; language?: string; code: string; }
export interface QuoteBlock extends BaseBlock { type: 'quote'; text: string; attribution?: string; }
export interface TableBlock extends BaseBlock { type: 'table'; rows: { cells: string[] }[]; hasHeader?: boolean; }
export interface TocBlock extends BaseBlock { type: 'toc'; title?: string; maxDepth?: 1 | 2 | 3; }
export interface RecentPagesBlock extends BaseBlock { type: 'recentPages'; tagPath?: string; limit: number; }
export interface PageListBlock extends BaseBlock { type: 'pageList'; pageIds: string[]; }
export interface AssetPriceBlock extends BaseBlock { type: 'assetPrice'; resourceAddress?: string; showChange?: boolean; }
export interface Column { id: string; width?: 'auto' | '1/2' | '1/3' | '2/3' | '1/4' | '3/4'; blocks: ContentBlock[]; }
export interface ColumnsBlock extends BaseBlock { type: 'columns'; columns: Column[]; gap?: 'sm' | 'md' | 'lg'; align?: 'start' | 'center' | 'end' | 'stretch'; }

export type ContentBlock = TextBlock | MediaBlock | CalloutBlock | DividerBlock | CodeBlock | QuoteBlock | TableBlock | TocBlock | RecentPagesBlock | PageListBlock | AssetPriceBlock;
export type Block = ContentBlock | ColumnsBlock;

// Block creation defaults (now uses HTML instead of markdown)
const BLOCK_DEFAULTS: Record<BlockType, () => Omit<Block, 'id'>> = {
  text: () => ({ type: 'text', text: '' }),
  media: () => ({ type: 'media', mediaType: 'image', src: '', alt: '' }),
  callout: () => ({ type: 'callout', text: '' }),
  divider: () => ({ type: 'divider' }),
  code: () => ({ type: 'code', language: 'typescript', code: '' }),
  quote: () => ({ type: 'quote', text: '' }),
  table: () => ({ type: 'table', rows: [{ cells: ['Header 1', 'Header 2'] }, { cells: ['Cell 1', 'Cell 2'] }], hasHeader: true }),
  toc: () => ({ type: 'toc', title: 'Contents', maxDepth: 3 }),
  recentPages: () => ({ type: 'recentPages', limit: 5 }),
  pageList: () => ({ type: 'pageList', pageIds: [] }),
  assetPrice: () => ({ type: 'assetPrice', resourceAddress: 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd', showChange: true }),
  columns: () => ({ type: 'columns', columns: [{ id: crypto.randomUUID(), blocks: [] }, { id: crypto.randomUUID(), blocks: [] }], gap: 'md', align: 'start' }),
};

export const INSERTABLE_BLOCKS: BlockType[] = ['text', 'columns', 'table', 'toc', 'media', 'callout', 'quote', 'code', 'divider', 'recentPages', 'pageList', 'assetPrice'];
export const CONTENT_BLOCK_TYPES: BlockType[] = ['text', 'table', 'toc', 'media', 'callout', 'quote', 'code', 'divider', 'recentPages', 'pageList', 'assetPrice'];

export const createBlock = (type: BlockType): Block => ({ id: crypto.randomUUID(), ...BLOCK_DEFAULTS[type]() } as Block);
export const createColumn = (): Column => ({ id: crypto.randomUUID(), blocks: [] });

// Default page content now uses HTML
export const createDefaultPageContent = (): Block[] => [{
  id: crypto.randomUUID(),
  type: 'text',
  text: '<h2>Getting Started</h2><p>Start writing your content here...</p>',
}];

export function duplicateBlock(block: Block): Block {
  if (block.type === 'columns') {
    return { ...block, id: crypto.randomUUID(), columns: block.columns.map(col => ({ ...col, id: crypto.randomUUID(), blocks: col.blocks.map(b => ({ ...b, id: crypto.randomUUID() })) })) };
  }
  return { ...block, id: crypto.randomUUID() };
}