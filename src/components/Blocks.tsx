// src/components/Blocks.tsx - Re-export wrapper for code-split modules

'use client';

export type { Block, BlockType, ContentBlock, RecentPagesBlock, PageListBlock, AssetPriceBlock, TocBlock, ColumnsBlock, Column, LeafBlock } from '@/types/blocks';
export { BlockRenderer } from './BlockRenderer';

import dynamic from 'next/dynamic';

export const BlockEditor = dynamic(() => import('./BlockEditor').then(m => m.BlockEditor), {
  ssr: false,
  loading: () => <div className="h-64 skeleton rounded-lg" />,
});

export async function createDefaultPageContent() {
  const mod = await import('./BlockEditor');
  return mod.createDefaultPageContent();
}

export function createDefaultPageContentSync() {
  return [
    { id: crypto.randomUUID(), type: 'content' as const, text: '' },
    { id: crypto.randomUUID(), type: 'columns' as const, columns: [
      { id: crypto.randomUUID(), blocks: [{ id: crypto.randomUUID(), type: 'toc' as const }] },
      { id: crypto.randomUUID(), blocks: [{ id: crypto.randomUUID(), type: 'content' as const, text: '' }] },
    ], gap: 'md' as const, align: 'start' as const },
    { id: crypto.randomUUID(), type: 'content' as const, text: '' },
  ];
}