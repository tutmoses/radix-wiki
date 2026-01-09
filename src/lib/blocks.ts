// src/lib/blocks.ts

export type BlockType =
  | 'heading'
  | 'paragraph'
  | 'image'
  | 'callout'
  | 'divider'
  | 'code'
  | 'quote'
  | 'list'
  | 'recentPages'
  | 'pageList'
  | 'embed';

interface BaseBlock {
  id: string;
  type: BlockType;
}

export interface HeadingBlock extends BaseBlock {
  type: 'heading';
  level: 1 | 2 | 3;
  text: string;
}

export interface ParagraphBlock extends BaseBlock {
  type: 'paragraph';
  text: string; // Supports basic markdown: **bold**, *italic*, [links](url), `code`
}

export interface ImageBlock extends BaseBlock {
  type: 'image';
  src: string;
  alt?: string;
  caption?: string;
}

export interface CalloutBlock extends BaseBlock {
  type: 'callout';
  variant: 'info' | 'warning' | 'success' | 'error';
  title?: string;
  text: string;
}

export interface DividerBlock extends BaseBlock {
  type: 'divider';
}

export interface CodeBlock extends BaseBlock {
  type: 'code';
  language?: string;
  code: string;
}

export interface QuoteBlock extends BaseBlock {
  type: 'quote';
  text: string;
  attribution?: string;
}

export interface ListBlock extends BaseBlock {
  type: 'list';
  style: 'bullet' | 'numbered' | 'checklist';
  items: { text: string; checked?: boolean }[];
}

export interface RecentPagesBlock extends BaseBlock {
  type: 'recentPages';
  tagPath?: string; // Filter by category, empty = all
  limit: number;
}

export interface PageListBlock extends BaseBlock {
  type: 'pageList';
  pageIds: string[]; // Curated list of page IDs
}

export interface EmbedBlock extends BaseBlock {
  type: 'embed';
  url: string;
  aspectRatio?: '16:9' | '4:3' | '1:1';
}

export type Block =
  | HeadingBlock
  | ParagraphBlock
  | ImageBlock
  | CalloutBlock
  | DividerBlock
  | CodeBlock
  | QuoteBlock
  | ListBlock
  | RecentPagesBlock
  | PageListBlock
  | EmbedBlock;

export type BlockContent = Block[];

export function createBlock(type: BlockType): Block {
  const id = crypto.randomUUID();
  
  switch (type) {
    case 'heading':
      return { id, type, level: 2, text: '' };
    case 'paragraph':
      return { id, type, text: '' };
    case 'image':
      return { id, type, src: '', alt: '' };
    case 'callout':
      return { id, type, variant: 'info', text: '' };
    case 'divider':
      return { id, type };
    case 'code':
      return { id, type, language: 'typescript', code: '' };
    case 'quote':
      return { id, type, text: '' };
    case 'list':
      return { id, type, style: 'bullet', items: [{ text: '' }] };
    case 'recentPages':
      return { id, type, limit: 5 };
    case 'pageList':
      return { id, type, pageIds: [] };
    case 'embed':
      return { id, type, url: '' };
  }
}

export function duplicateBlock(block: Block): Block {
  return { ...block, id: crypto.randomUUID() };
}

export const BLOCK_LABELS: Record<BlockType, string> = {
  heading: 'Heading',
  paragraph: 'Paragraph',
  image: 'Image',
  callout: 'Callout',
  divider: 'Divider',
  code: 'Code',
  quote: 'Quote',
  list: 'List',
  recentPages: 'Recent Pages',
  pageList: 'Page List',
  embed: 'Embed',
};

export const BLOCK_DESCRIPTIONS: Record<BlockType, string> = {
  heading: 'Section title',
  paragraph: 'Plain text with basic formatting',
  image: 'Image with optional caption',
  callout: 'Highlighted message box',
  divider: 'Horizontal separator',
  code: 'Code snippet with syntax highlighting',
  quote: 'Blockquote with attribution',
  list: 'Bullet, numbered, or checklist',
  recentPages: 'Dynamic list of recent pages',
  pageList: 'Curated list of specific pages',
  embed: 'Embed external content',
};

// Blocks that contain dynamic data (fetched at render time)
export const DYNAMIC_BLOCKS: BlockType[] = ['recentPages', 'pageList'];

// Blocks available in the insert menu
export const INSERTABLE_BLOCKS: BlockType[] = [
  'paragraph',
  'heading',
  'list',
  'image',
  'callout',
  'quote',
  'code',
  'divider',
  'recentPages',
  'pageList',
  'embed',
];