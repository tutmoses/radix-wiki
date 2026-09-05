// src/lib/block-utils.ts - Shared block constants and utilities

import type { Block, BlockType, AtomicBlock } from '@/types/blocks';
import { createBlockValidator, duplicateBlockIds, validateLinkGroups, validateReferenceItems } from 'wiki-formant/validation';
import { Clock, FileText, Columns, TrendingUp, Pencil, Info, Rss, Code2, BarChart3, MessageSquareQuote, LayoutGrid, QrCode, ListOrdered, AlertTriangle, type LucideIcon } from 'lucide-react';
import { someBlock } from 'wiki-formant/blocks';

export const CODE_LANGS = ['javascript', 'typescript', 'css', 'json', 'bash', 'python', 'rust', 'sql', 'html', 'xml', 'jsx', 'tsx', 'markdown', 'yaml', 'toml'] as const;
export const DEFAULT_LANG = 'rust';

// One row per block type: label and icon for the editor, what inserting it
// makes, and which menus offer it -- `insertable` the page menu, `atomic` the
// infobox and column menus. Both lists derive in the order written here.
//
// Counted against the live database rather than assumed: `store` and `footer`
// appear in no page and no revision, so they are gone entirely. `stats` (1 page,
// 3 revisions) and `testimonial` (1 page, 5 revisions) DO have live content --
// an earlier version of this comment called all four unused, which would have
// broken two pages -- so they stay valid and renderable, just not insertable.
// `tipJar` is likewise unused today but stays offered in the editor.
// codeTabs is valid and renderable (one live tutorial) with no editor UI.
type BlockSpec = { label: string; icon: LucideIcon; insertable?: true; atomic?: true; create: () => Omit<Block, 'id'> };

export const BLOCK_META: Record<BlockType, BlockSpec> = {
  content: { label: 'Content', icon: Pencil, insertable: true, atomic: true, create: () => ({ type: 'content', text: '' }) },
  banner: { label: 'Notice Banner', icon: AlertTriangle, insertable: true, atomic: true, create: () => ({ type: 'banner', variant: 'stub' }) },
  columns: { label: 'Columns', icon: Columns, insertable: true, create: () => ({ type: 'columns', columns: [{ id: crypto.randomUUID(), blocks: [] }, { id: crypto.randomUUID(), blocks: [] }], gap: 'md', align: 'start' }) },
  recentPages: { label: 'Recent Pages', icon: Clock, insertable: true, atomic: true, create: () => ({ type: 'recentPages', limit: 5 }) },
  pageList: { label: 'Page List', icon: FileText, insertable: true, atomic: true, create: () => ({ type: 'pageList', pageIds: [] }) },
  assetPrice: { label: 'Asset Price', icon: TrendingUp, insertable: true, atomic: true, create: () => ({ type: 'assetPrice', resourceAddress: 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd', showChange: true }) },
  rssFeed: { label: 'RSS Feed', icon: Rss, insertable: true, atomic: true, create: () => ({ type: 'rssFeed', url: 'https://tutmoses.github.io/rss-feed/feeds.json', limit: 15 }) },
  codeTabs: { label: 'Code Tabs', icon: Code2, atomic: true, create: () => ({ type: 'codeTabs', tabs: [{ label: 'Rust', language: 'rust', code: '' }, { label: 'TypeScript', language: 'typescript', code: '' }] }) },
  linkGrid: { label: 'Link Grid', icon: LayoutGrid, insertable: true, atomic: true, create: () => ({ type: 'linkGrid', groups: [{ id: crypto.randomUUID(), heading: 'Group', links: [] }] }) },
  tipJar: { label: 'Tip Jar', icon: QrCode, insertable: true, atomic: true, create: () => ({ type: 'tipJar', address: '', label: 'Tip the author ☕️', message: 'Support independent writing on Radix — scan to send XRD.' }) },
  references: { label: 'References', icon: ListOrdered, insertable: true, atomic: true, create: () => ({ type: 'references', title: 'References', items: [] }) },
  infobox: { label: 'Infobox', icon: Info, create: () => ({ type: 'infobox', blocks: [] }) },
  stats: { label: 'Stats', icon: BarChart3, create: () => ({ type: 'stats', items: [
    { id: crypto.randomUUID(), value: '100+', label: 'Customers' },
    { id: crypto.randomUUID(), value: '$1M', label: 'Revenue' },
    { id: crypto.randomUUID(), value: '99%', label: 'Uptime' },
  ], columns: 3 }) },
  testimonial: { label: 'Testimonial', icon: MessageSquareQuote, create: () => ({ type: 'testimonial', quote: 'An amazing product that changed everything.', author: 'Jane Doe', role: 'CEO' }) },
};

/** Every type the wire format accepts — the /openapi.json Block enum reads it. */
export const BLOCK_TYPES = Object.keys(BLOCK_META) as BlockType[];
export const INSERTABLE_BLOCKS: readonly BlockType[] = BLOCK_TYPES.filter(t => BLOCK_META[t].insertable);
export const ATOMIC_BLOCK_TYPES: readonly BlockType[] = BLOCK_TYPES.filter(t => BLOCK_META[t].atomic);

export const createBlock = (type: BlockType): Block => ({ id: crypto.randomUUID(), ...BLOCK_META[type].create() } as Block);

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

/**
 * Whether the page holds anything the highlighter has to ship for.
 *
 * The walk is `someBlock` from `wiki-formant/blocks`. The version here checked
 * containers by hand and was the fifth copy of that walk in this repo.
 */
export function hasCodeBlocksInContent(content: Block[]): boolean {
  if (!Array.isArray(content)) return false;
  return someBlock(
    content,
    block =>
      !!block &&
      ((block.type === 'content' && !!block.text?.includes('<pre')) || block.type === 'codeTabs'),
    BLOCK_SHAPE.containers,
  );
}

/**
 * This wiki's two container types, for the shared tree walk. Written once here
 * rather than at each call site, which is where the three-branch version used to
 * be re-derived per pass.
 */
export const BLOCK_SHAPE = {
  containers: (block: Block) =>
    block.type === 'infobox' ? [block.blocks as Block[]]
    : block.type === 'columns' ? block.columns.map(col => col.blocks as Block[])
    : null,
  rebuild: (block: Block, groups: Block[][]): Block =>
    block.type === 'infobox' ? { ...block, blocks: groups[0] as AtomicBlock[] }
    : block.type === 'columns'
      ? { ...block, columns: block.columns.map((col, i) => ({ ...col, blocks: groups[i] as AtomicBlock[] })) }
      : block,
};
