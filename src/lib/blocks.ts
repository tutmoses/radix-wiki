// src/lib/blocks.ts

export type BlockType =
  | 'text' | 'media' | 'callout' | 'divider'
  | 'code' | 'quote' | 'table' | 'toc' | 'recentPages' | 'pageList' | 'columns';

interface BaseBlock { id: string; type: BlockType; }

export interface TextBlock extends BaseBlock {
  type: 'text';
  text: string;
}
export interface MediaBlock extends BaseBlock {
  type: 'media';
  mediaType: 'image' | 'video' | 'embed';
  src: string;
  alt?: string;
  caption?: string;
}
export interface CalloutBlock extends BaseBlock {
  type: 'callout'; variant: 'info' | 'warning' | 'success' | 'error'; title?: string; text: string;
}
export interface DividerBlock extends BaseBlock { type: 'divider'; }
export interface CodeBlock extends BaseBlock {
  type: 'code'; language?: string; code: string;
}
export interface QuoteBlock extends BaseBlock {
  type: 'quote'; text: string; attribution?: string;
}
export interface TableBlock extends BaseBlock {
  type: 'table';
  rows: { cells: string[] }[];
  hasHeader?: boolean;
}
export interface TocBlock extends BaseBlock {
  type: 'toc';
  title?: string;
  maxDepth?: 1 | 2 | 3;
}
export interface RecentPagesBlock extends BaseBlock {
  type: 'recentPages'; tagPath?: string; limit: number;
}
export interface PageListBlock extends BaseBlock {
  type: 'pageList'; pageIds: string[];
}

export interface Column {
  id: string;
  width?: 'auto' | '1/2' | '1/3' | '2/3' | '1/4' | '3/4';
  blocks: ContentBlock[];
}

export interface ColumnsBlock extends BaseBlock {
  type: 'columns';
  columns: Column[];
  gap?: 'sm' | 'md' | 'lg';
  align?: 'start' | 'center' | 'end' | 'stretch';
}

// Content blocks are blocks that can be placed inside columns
export type ContentBlock =
  | TextBlock | MediaBlock | CalloutBlock | DividerBlock
  | CodeBlock | QuoteBlock | TableBlock | TocBlock | RecentPagesBlock | PageListBlock;

// All blocks including layout blocks
export type Block = ContentBlock | ColumnsBlock;

export type BlockContent = Block[];

// Block metadata registry
export const BLOCK_REGISTRY: Record<BlockType, { label: string; icon: string; create: () => Omit<Block, 'id'> }> = {
  text: { label: 'Text', icon: 'Type', create: () => ({ type: 'text', text: '' }) },
  media: { label: 'Media', icon: 'Image', create: () => ({ type: 'media', mediaType: 'image', src: '', alt: '' }) },
  callout: { label: 'Callout', icon: 'AlertCircle', create: () => ({ type: 'callout', variant: 'info', text: '' }) },
  divider: { label: 'Divider', icon: 'Minus', create: () => ({ type: 'divider' }) },
  code: { label: 'Code', icon: 'Code', create: () => ({ type: 'code', language: 'typescript', code: '' }) },
  quote: { label: 'Quote', icon: 'Quote', create: () => ({ type: 'quote', text: '' }) },
  table: { label: 'Table', icon: 'Table', create: () => ({ type: 'table', rows: [{ cells: ['Header 1', 'Header 2'] }, { cells: ['Cell 1', 'Cell 2'] }], hasHeader: true }) },
  toc: { label: 'Table of Contents', icon: 'ListTree', create: () => ({ type: 'toc', title: 'Contents', maxDepth: 3 }) },
  recentPages: { label: 'Recent Pages', icon: 'Clock', create: () => ({ type: 'recentPages', limit: 5 }) },
  pageList: { label: 'Page List', icon: 'FileText', create: () => ({ type: 'pageList', pageIds: [] }) },
  columns: { 
    label: 'Columns', 
    icon: 'Columns', 
    create: () => ({ 
      type: 'columns', 
      columns: [
        { id: crypto.randomUUID(), blocks: [] },
        { id: crypto.randomUUID(), blocks: [] }
      ],
      gap: 'md',
      align: 'start'
    }) 
  },
};

export const INSERTABLE_BLOCKS: BlockType[] = [
  'text', 'columns', 'table', 'toc', 'media', 'callout', 'quote', 'code', 'divider', 'recentPages', 'pageList',
];

// Content blocks that can go inside columns (no nested columns)
export const CONTENT_BLOCK_TYPES: BlockType[] = [
  'text', 'table', 'toc', 'media', 'callout', 'quote', 'code', 'divider', 'recentPages', 'pageList',
];

export function createBlock(type: BlockType): Block {
  return { id: crypto.randomUUID(), ...BLOCK_REGISTRY[type].create() } as Block;
}

export function createContentBlock(type: BlockType): ContentBlock {
  if (type === 'columns') throw new Error('Columns cannot be nested');
  return { id: crypto.randomUUID(), ...BLOCK_REGISTRY[type].create() } as ContentBlock;
}

export function duplicateBlock(block: Block): Block {
  if (block.type === 'columns') {
    return {
      ...block,
      id: crypto.randomUUID(),
      columns: block.columns.map(col => ({
        ...col,
        id: crypto.randomUUID(),
        blocks: col.blocks.map(b => ({ ...b, id: crypto.randomUUID() }))
      }))
    };
  }
  return { ...block, id: crypto.randomUUID() };
}

export function createColumn(): Column {
  return { id: crypto.randomUUID(), blocks: [] };
}

export function createDefaultPageContent(): BlockContent {
  return [
    { id: crypto.randomUUID(), type: 'text', text: '## Getting Started\n\nStart writing your content here...' },
  ];
}