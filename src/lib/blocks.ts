// src/lib/blocks.ts - Block validation utilities

import type { Block, BlockType, AtomicBlock } from '@/types/blocks';

const VALID_BLOCK_TYPES: BlockType[] = ['content', 'recentPages', 'pageList', 'assetPrice', 'columns', 'infobox', 'rssFeed'];
const ATOMIC_TYPES: BlockType[] = ['content', 'recentPages', 'pageList', 'assetPrice', 'rssFeed'];

function isValidBlockType(type: unknown): type is BlockType {
  return typeof type === 'string' && VALID_BLOCK_TYPES.includes(type as BlockType);
}

function isAtomicType(type: BlockType): boolean {
  return ATOMIC_TYPES.includes(type);
}

function validateAtomicBlock(block: unknown): block is AtomicBlock {
  if (!block || typeof block !== 'object') return false;
  const b = block as Record<string, unknown>;
  if (typeof b.id !== 'string' || !isValidBlockType(b.type) || !isAtomicType(b.type)) return false;

  switch (b.type) {
    case 'content':
      return typeof b.text === 'string';
    case 'recentPages':
      return typeof b.limit === 'number' && b.limit > 0;
    case 'pageList':
      return Array.isArray(b.pageIds) && b.pageIds.every((id: unknown) => typeof id === 'string');
    case 'assetPrice':
      return b.resourceAddress === undefined || typeof b.resourceAddress === 'string';
    case 'rssFeed':
      return typeof b.url === 'string';
    default:
      return false;
  }
}

function validateBlock(block: unknown): block is Block {
  if (!block || typeof block !== 'object') return false;
  const b = block as Record<string, unknown>;
  if (typeof b.id !== 'string' || !isValidBlockType(b.type)) return false;

  switch (b.type) {
    case 'columns': {
      if (!Array.isArray(b.columns)) return false;
      return b.columns.every((col: unknown) => {
        if (!col || typeof col !== 'object') return false;
        const c = col as Record<string, unknown>;
        return typeof c.id === 'string' && Array.isArray(c.blocks) && c.blocks.every(validateAtomicBlock);
      });
    }
    case 'infobox':
      return Array.isArray(b.blocks) && b.blocks.every(validateAtomicBlock);
    default:
      return validateAtomicBlock(block);
  }
}

export function validateBlocks(content: unknown): content is Block[] {
  return Array.isArray(content) && content.every(validateBlock);
}
