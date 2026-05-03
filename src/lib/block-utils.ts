// src/lib/block-utils.ts - Shared block constants and utilities

import type { Block, BlockType, AtomicBlock } from '@/types/blocks';
import { Clock, FileText, Columns, TrendingUp, Pencil, Info, Rss, Code2, ShoppingBag, PanelBottom, BarChart3, MessageSquareQuote, LayoutGrid, type LucideIcon } from 'lucide-react';

export const CODE_LANGS = ['javascript', 'typescript', 'css', 'json', 'bash', 'python', 'rust', 'sql', 'html', 'xml', 'jsx', 'tsx', 'markdown', 'yaml', 'toml'] as const;
export const DEFAULT_LANG = 'rust';

export const BLOCK_META: Record<BlockType, { label: string; icon: LucideIcon }> = {
  content: { label: 'Content', icon: Pencil },
  recentPages: { label: 'Recent Pages', icon: Clock },
  pageList: { label: 'Page List', icon: FileText },
  assetPrice: { label: 'Asset Price', icon: TrendingUp },
  columns: { label: 'Columns', icon: Columns },
  infobox: { label: 'Infobox', icon: Info },
  rssFeed: { label: 'RSS Feed', icon: Rss },
  codeTabs: { label: 'Code Tabs', icon: Code2 },
  store: { label: 'Store', icon: ShoppingBag },
  footer: { label: 'Footer', icon: PanelBottom },
  stats: { label: 'Stats', icon: BarChart3 },
  testimonial: { label: 'Testimonial', icon: MessageSquareQuote },
  linkGrid: { label: 'Link Grid', icon: LayoutGrid },
};

const BLOCK_DEFAULTS: Record<BlockType, () => Omit<Block, 'id'>> = {
  content: () => ({ type: 'content', text: '' }),
  recentPages: () => ({ type: 'recentPages', limit: 5 }),
  pageList: () => ({ type: 'pageList', pageIds: [] }),
  assetPrice: () => ({ type: 'assetPrice', resourceAddress: 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd', showChange: true }),
  columns: () => ({ type: 'columns', columns: [{ id: crypto.randomUUID(), blocks: [] }, { id: crypto.randomUUID(), blocks: [] }], gap: 'md', align: 'start' }),
  infobox: () => ({ type: 'infobox', blocks: [] }),
  rssFeed: () => ({ type: 'rssFeed', url: 'https://tutmoses.github.io/rss-feed/feeds.json', limit: 15 }),
  codeTabs: () => ({ type: 'codeTabs', tabs: [{ label: 'Rust', language: 'rust', code: '' }, { label: 'TypeScript', language: 'typescript', code: '' }] }),
  store: () => ({ type: 'store', columns: 3, showPrice: true }),
  footer: () => ({ type: 'footer', text: '', showLinks: true }),
  stats: () => ({ type: 'stats', items: [
    { id: crypto.randomUUID(), value: '100+', label: 'Customers' },
    { id: crypto.randomUUID(), value: '$1M', label: 'Revenue' },
    { id: crypto.randomUUID(), value: '99%', label: 'Uptime' },
  ], columns: 3 }),
  testimonial: () => ({ type: 'testimonial', quote: 'An amazing product that changed everything.', author: 'Jane Doe', role: 'CEO' }),
  linkGrid: () => ({ type: 'linkGrid', groups: [{ id: crypto.randomUUID(), heading: 'Group', links: [] }] }),
};

export const INSERTABLE_BLOCKS: readonly BlockType[] = ['content', 'columns', 'recentPages', 'pageList', 'assetPrice', 'rssFeed', 'codeTabs', 'store', 'footer', 'stats', 'testimonial', 'linkGrid'];
export const ATOMIC_BLOCK_TYPES: readonly BlockType[] = ['content', 'recentPages', 'pageList', 'assetPrice', 'rssFeed', 'codeTabs', 'store', 'footer', 'stats', 'testimonial', 'linkGrid'];

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

// --- Block validation ---

function isValidBlockType(type: unknown): type is BlockType {
  return typeof type === 'string' && type in BLOCK_META;
}

function isAtomicType(type: BlockType): boolean {
  return ATOMIC_BLOCK_TYPES.includes(type);
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
    case 'codeTabs':
      return Array.isArray(b.tabs);
    case 'store':
      return typeof b.columns === 'number' && typeof b.showPrice === 'boolean';
    case 'footer':
      return true;
    case 'stats':
      return Array.isArray(b.items);
    case 'testimonial':
      return typeof b.quote === 'string' && typeof b.author === 'string';
    case 'linkGrid':
      return Array.isArray(b.groups) && b.groups.every((g: unknown) => {
        if (!g || typeof g !== 'object') return false;
        const grp = g as Record<string, unknown>;
        return typeof grp.id === 'string'
          && typeof grp.heading === 'string'
          && Array.isArray(grp.links)
          && grp.links.every((l: unknown) => {
            if (!l || typeof l !== 'object') return false;
            const lnk = l as Record<string, unknown>;
            return typeof lnk.label === 'string' && typeof lnk.href === 'string';
          });
      });
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

// --- Code detection ---

export function hasCodeBlocksInContent(content: Block[]): boolean {
  if (!content || !Array.isArray(content)) return false;
  const check = (blocks: Block[]): boolean => {
    if (!blocks || !Array.isArray(blocks)) return false;
    for (const block of blocks) {
      if (!block) continue;
      if (block.type === 'content' && block.text?.includes('<pre')) return true;
      if (block.type === 'codeTabs') return true;
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