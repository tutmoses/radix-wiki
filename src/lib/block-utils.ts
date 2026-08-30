// src/lib/block-utils.ts - Shared block constants and utilities

import type { Block, BlockType, AtomicBlock } from '@/types/blocks';
import { createBlockValidator, duplicateBlockIds, validateLinkGroups, validateReferenceItems } from 'wiki-formant/validation';
import { Clock, FileText, Columns, TrendingUp, Pencil, Info, Rss, Code2, BarChart3, MessageSquareQuote, LayoutGrid, QrCode, ListOrdered, AlertTriangle, type LucideIcon } from 'lucide-react';

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
  stats: { label: 'Stats', icon: BarChart3 },
  testimonial: { label: 'Testimonial', icon: MessageSquareQuote },
  linkGrid: { label: 'Link Grid', icon: LayoutGrid },
  tipJar: { label: 'Tip Jar', icon: QrCode },
  references: { label: 'References', icon: ListOrdered },
  banner: { label: 'Notice Banner', icon: AlertTriangle },
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
  stats: () => ({ type: 'stats', items: [
    { id: crypto.randomUUID(), value: '100+', label: 'Customers' },
    { id: crypto.randomUUID(), value: '$1M', label: 'Revenue' },
    { id: crypto.randomUUID(), value: '99%', label: 'Uptime' },
  ], columns: 3 }),
  testimonial: () => ({ type: 'testimonial', quote: 'An amazing product that changed everything.', author: 'Jane Doe', role: 'CEO' }),
  linkGrid: () => ({ type: 'linkGrid', groups: [{ id: crypto.randomUUID(), heading: 'Group', links: [] }] }),
  tipJar: () => ({ type: 'tipJar', address: '', label: 'Tip the author ☕️', message: 'Support independent writing on Radix — scan to send XRD.' }),
  references: () => ({ type: 'references', title: 'References', items: [] }),
  banner: () => ({ type: 'banner', variant: 'stub' }),
};

// Counted against the live database rather than assumed: `store` and `footer`
// appear in no page and no revision, so they are gone entirely. `stats` (1 page,
// 3 revisions) and `testimonial` (1 page, 5 revisions) DO have live content --
// an earlier version of this comment called all four unused, which would have
// broken two pages -- so they stay valid and renderable, just not insertable.
// `tipJar` is likewise unused today but stays offered in the editor.
// codeTabs is valid and renderable (one live tutorial) with no editor UI.
export const INSERTABLE_BLOCKS: readonly BlockType[] = ['content', 'banner', 'columns', 'recentPages', 'pageList', 'assetPrice', 'rssFeed', 'linkGrid', 'tipJar', 'references'];
export const ATOMIC_BLOCK_TYPES: readonly BlockType[] = ['content', 'banner', 'recentPages', 'pageList', 'assetPrice', 'rssFeed', 'codeTabs', 'linkGrid', 'tipJar', 'references'];

export const createBlock = (type: BlockType): Block => ({ id: crypto.randomUUID(), ...BLOCK_DEFAULTS[type]() } as Block);

export const duplicateBlock = (block: Block): Block => duplicateBlockIds(block, () => crypto.randomUUID());

// --- Block validation ---
//
// The walk (id/type gate, container branch, the two nested item validators) is
// `wiki-formant/validation`, shared with caper, which had written the same one.
// Only the switch below is this repo's — its block type set is.
//
// `okUrl` arrives with it: reference and link-grid URLs used to be accepted as
// any string here, where caper already rejected non-http(s)/mailto schemes at
// the write path. React 19 neutralises a `javascript:` href at render time, so
// this is defence in depth rather than a fix for a live hole -- but a URL that
// can never render safely is better rejected than stored.

const { validateBlocks: validate } = createBlockValidator({
  isKnownType: t => t in BLOCK_META,
  isAtomicType: t => (ATOMIC_BLOCK_TYPES as readonly string[]).includes(t),
  validateAtomic: b => {
    switch (b.type) {
      case 'content':
        return typeof b.text === 'string';
      case 'recentPages':
        return typeof b.limit === 'number' && b.limit > 0;
      case 'pageList':
        return Array.isArray(b.pageIds) && b.pageIds.every(id => typeof id === 'string');
      case 'assetPrice':
        return b.resourceAddress === undefined || typeof b.resourceAddress === 'string';
      case 'rssFeed':
        return typeof b.url === 'string';
      case 'codeTabs':
        return Array.isArray(b.tabs);
      case 'stats':
        return Array.isArray(b.items);
      case 'testimonial':
        return typeof b.quote === 'string' && typeof b.author === 'string';
      case 'tipJar':
        return typeof b.address === 'string';
      case 'banner':
        return typeof b.variant === 'string';
      case 'references':
        return validateReferenceItems(b.items);
      case 'linkGrid':
        return validateLinkGroups(b.groups);
      default:
        return false;
    }
  },
});

export const validateBlocks = (content: unknown): content is Block[] => validate(content);

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