// src/lib/block-utils.ts - Shared block constants and utilities

import type { Block, BlockType, AtomicBlock } from '@/types/blocks';
import { Clock, FileText, Columns, TrendingUp, Pencil, Info, type LucideIcon } from 'lucide-react';

export const BLOCK_META: Record<BlockType, { label: string; icon: LucideIcon }> = {
  content: { label: 'Content', icon: Pencil },
  recentPages: { label: 'Recent Pages', icon: Clock },
  pageList: { label: 'Page List', icon: FileText },
  assetPrice: { label: 'Asset Price', icon: TrendingUp },
  columns: { label: 'Columns', icon: Columns },
  infobox: { label: 'Infobox', icon: Info },
};

const BLOCK_DEFAULTS: Record<BlockType, () => Omit<Block, 'id'>> = {
  content: () => ({ type: 'content', text: '' }),
  recentPages: () => ({ type: 'recentPages', limit: 5 }),
  pageList: () => ({ type: 'pageList', pageIds: [] }),
  assetPrice: () => ({ type: 'assetPrice', resourceAddress: 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd', showChange: true }),
  columns: () => ({ type: 'columns', columns: [{ id: crypto.randomUUID(), blocks: [] }, { id: crypto.randomUUID(), blocks: [] }], gap: 'md', align: 'start' }),
  infobox: () => ({ type: 'infobox', blocks: [] }),
};

export const INSERTABLE_BLOCKS: readonly BlockType[] = ['content', 'columns', 'recentPages', 'pageList', 'assetPrice'];
export const ATOMIC_BLOCK_TYPES: readonly BlockType[] = ['content', 'recentPages', 'pageList', 'assetPrice'];

export const createBlock = (type: BlockType): Block => ({ id: crypto.randomUUID(), ...BLOCK_DEFAULTS[type]() } as Block);

export function duplicateBlock(block: Block): Block {
  if (block.type === 'columns') {
    return { ...block, id: crypto.randomUUID(), columns: block.columns.map(col => ({ ...col, id: crypto.randomUUID(), blocks: (col.blocks || []).map(b => ({ ...b, id: crypto.randomUUID() })) })) };
  }
  if (block.type === 'infobox') {
    return { ...block, id: crypto.randomUUID(), blocks: (block.blocks || []).map(b => ({ ...b, id: crypto.randomUUID() }) as AtomicBlock) };
  }
  return { ...block, id: crypto.randomUUID() };
}

export function hasCodeBlocksInContent(content: Block[]): boolean {
  if (!content || !Array.isArray(content)) return false;
  const check = (blocks: Block[]): boolean => {
    if (!blocks || !Array.isArray(blocks)) return false;
    for (const block of blocks) {
      if (!block) continue;
      if (block.type === 'content' && block.text?.includes('<pre')) return true;
      if (block.type === 'columns' && block.columns) {
        for (const col of block.columns) {
          if (col?.blocks && check(col.blocks)) return true;
        }
      }
      if (block.type === 'infobox' && block.blocks?.length && check(block.blocks)) return true;
    }
    return false;
  };
  return check(content);
}