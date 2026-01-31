// src/lib/block-utils.ts - Shared block constants and utilities

import type { Block, BlockType } from '@/types/blocks';
import { Clock, FileText, Columns, TrendingUp, Pencil, type LucideIcon } from 'lucide-react';

export const BLOCK_META: Record<BlockType, { label: string; icon: LucideIcon }> = {
  content: { label: 'Content', icon: Pencil },
  recentPages: { label: 'Recent Pages', icon: Clock },
  pageList: { label: 'Page List', icon: FileText },
  assetPrice: { label: 'Asset Price', icon: TrendingUp },
  columns: { label: 'Columns', icon: Columns },
};

export const BLOCK_DEFAULTS: Record<BlockType, () => Omit<Block, 'id'>> = {
  content: () => ({ type: 'content', text: '' }),
  recentPages: () => ({ type: 'recentPages', limit: 5 }),
  pageList: () => ({ type: 'pageList', pageIds: [] }),
  assetPrice: () => ({ type: 'assetPrice', resourceAddress: 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd', showChange: true }),
  columns: () => ({ type: 'columns', columns: [{ id: crypto.randomUUID(), blocks: [] }, { id: crypto.randomUUID(), blocks: [] }], gap: 'md', align: 'start' }),
};

export const INSERTABLE_BLOCKS: readonly BlockType[] = ['content', 'columns', 'recentPages', 'pageList', 'assetPrice'];

export const createBlock = (type: BlockType): Block => ({ id: crypto.randomUUID(), ...BLOCK_DEFAULTS[type]() } as Block);

export function duplicateBlock(block: Block): Block {
  if (block.type === 'columns') {
    return { ...block, id: crypto.randomUUID(), columns: block.columns.map(col => ({ ...col, id: crypto.randomUUID(), blocks: col.blocks.map(b => ({ ...b, id: crypto.randomUUID() })) })) };
  }
  return { ...block, id: crypto.randomUUID() };
}

export function hasCodeBlocksInContent(content: Block[]): boolean {
  const check = (blocks: Block[]): boolean => {
    for (const block of blocks) {
      if (block.type === 'content' && block.text?.includes('<pre')) return true;
      if (block.type === 'columns') {
        for (const col of block.columns) if (check(col.blocks)) return true;
      }
    }
    return false;
  };
  return check(content);
}