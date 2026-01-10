// src/lib/blocks.ts

import type { ReactNode } from 'react';

export type BlockType =
  | 'heading' | 'paragraph' | 'image' | 'callout' | 'divider'
  | 'code' | 'quote' | 'list' | 'recentPages' | 'pageList' | 'embed';

interface BaseBlock { id: string; type: BlockType; }

export interface HeadingBlock extends BaseBlock {
  type: 'heading'; level: 1 | 2 | 3; text: string;
}
export interface ParagraphBlock extends BaseBlock {
  type: 'paragraph'; text: string;
}
export interface ImageBlock extends BaseBlock {
  type: 'image'; src: string; alt?: string; caption?: string;
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
export interface ListBlock extends BaseBlock {
  type: 'list'; style: 'bullet' | 'numbered' | 'checklist'; items: { text: string; checked?: boolean }[];
}
export interface RecentPagesBlock extends BaseBlock {
  type: 'recentPages'; tagPath?: string; limit: number;
}
export interface PageListBlock extends BaseBlock {
  type: 'pageList'; pageIds: string[];
}
export interface EmbedBlock extends BaseBlock {
  type: 'embed'; url: string; aspectRatio?: '16:9' | '4:3' | '1:1';
}

export type Block =
  | HeadingBlock | ParagraphBlock | ImageBlock | CalloutBlock | DividerBlock
  | CodeBlock | QuoteBlock | ListBlock | RecentPagesBlock | PageListBlock | EmbedBlock;

export type BlockContent = Block[];

// Block metadata registry
export const BLOCK_REGISTRY: Record<BlockType, { label: string; icon: string; create: () => Omit<Block, 'id'> }> = {
  heading: { label: 'Heading', icon: 'Type', create: () => ({ type: 'heading', level: 2, text: '' }) },
  paragraph: { label: 'Paragraph', icon: 'AlignLeft', create: () => ({ type: 'paragraph', text: '' }) },
  image: { label: 'Image', icon: 'Image', create: () => ({ type: 'image', src: '', alt: '' }) },
  callout: { label: 'Callout', icon: 'AlertCircle', create: () => ({ type: 'callout', variant: 'info', text: '' }) },
  divider: { label: 'Divider', icon: 'Minus', create: () => ({ type: 'divider' }) },
  code: { label: 'Code', icon: 'Code', create: () => ({ type: 'code', language: 'typescript', code: '' }) },
  quote: { label: 'Quote', icon: 'Quote', create: () => ({ type: 'quote', text: '' }) },
  list: { label: 'List', icon: 'List', create: () => ({ type: 'list', style: 'bullet', items: [{ text: '' }] }) },
  recentPages: { label: 'Recent Pages', icon: 'Clock', create: () => ({ type: 'recentPages', limit: 5 }) },
  pageList: { label: 'Page List', icon: 'FileText', create: () => ({ type: 'pageList', pageIds: [] }) },
  embed: { label: 'Embed', icon: 'Link', create: () => ({ type: 'embed', url: '' }) },
};

export const INSERTABLE_BLOCKS: BlockType[] = [
  'paragraph', 'heading', 'list', 'image', 'callout', 'quote', 'code', 'divider', 'recentPages', 'pageList', 'embed',
];

export function createBlock(type: BlockType): Block {
  return { id: crypto.randomUUID(), ...BLOCK_REGISTRY[type].create() } as Block;
}

export function duplicateBlock(block: Block): Block {
  return { ...block, id: crypto.randomUUID() };
}