// src/lib/block-utils.ts - Shared block constants and utilities

import type { Block, BlockType } from '@/types/blocks';
import { coreAtomicValidator, createBlockValidator, duplicateBlockIds, MAX_BLOCK_ROWS } from 'wiki-formant/validation';
import { Activity, List, Columns, TrendingUp, Pencil, Info, Rss, Code2, BarChart3, MessageSquareQuote, LayoutGrid, QrCode, ListOrdered, AlertTriangle, type LucideIcon } from 'lucide-react';
import { coreBlockDefaults, LIST_SOURCES, someBlock } from 'wiki-formant/blocks';
import { BLOCK_SHAPE } from '@/lib/block-shape';
import { ACTIVITY_METRICS, isActivityMetric } from '@/lib/radix/metrics';

// One row per block type: label, icon and a one-line hint for the editor's
// Add menu, what inserting it makes, and which menus offer it -- `insertable` the page menu, `atomic` the
// infobox and column menus. Both lists derive in the order written here.
//
// Counted against the live database rather than assumed: `store` and `footer`
// appear in no page and no revision, so they are gone entirely. `stats` (1 page,
// 3 revisions) and `testimonial` (13 Week in Review issues, written by its
// routine) DO have live content -- an earlier version of this comment called all
// four unused, which would have broken them -- so they stay valid and
// renderable, just not insertable.
// `tipJar` is likewise unused today but stays offered in the editor. Stats has
// an editor, so the revisions that carry it can be edited, but is not offered.
type BlockSpec = { label: string; icon: LucideIcon; hint: string; insertable?: true; atomic?: true; create: () => Omit<Block, 'id'> };

// What inserting a core type makes is `wiki-formant/blocks`', identical in all three wikis.
const CORE = coreBlockDefaults();

export const BLOCK_META: Record<BlockType, BlockSpec> = {
  content: { label: 'Content', icon: Pencil, hint: 'Text, headings, images, tables and embeds', insertable: true, atomic: true, create: CORE.content },
  banner: { label: 'Notice Banner', icon: AlertTriangle, hint: 'A notice at the top of the page', insertable: true, atomic: true, create: CORE.banner },
  columns: { label: 'Columns', icon: Columns, hint: 'Two to four columns of blocks', insertable: true, create: CORE.columns },
  list: { label: 'Page List', icon: List, hint: 'The pages in a category, the newest, or pages you pick', insertable: true, atomic: true, create: CORE.list },
  assetPrice: { label: 'Asset Price', icon: TrendingUp, hint: "A Radix token's live price and chart", insertable: true, atomic: true, create: () => ({ type: 'assetPrice', resourceAddress: 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd', showChange: true }) },
  networkChart: { label: 'Network Chart', icon: Activity, hint: 'Daily Radix network activity, live', insertable: true, atomic: true, create: () => ({ type: 'networkChart', metric: 'transactions', range: '1y' }) },
  rssFeed: { label: 'RSS Feed', icon: Rss, hint: 'Items from an RSS or JSON feed', insertable: true, atomic: true, create: () => ({ type: 'rssFeed', url: 'https://tutmoses.github.io/rss-feed/feeds.json', limit: 15 }) },
  codeTabs: { label: 'Code Tabs', icon: Code2, hint: 'Code samples, a tab per language', insertable: true, atomic: true, create: CORE.codeTabs },
  linkGrid: { label: 'Link Grid', icon: LayoutGrid, hint: 'Links in groups under headings', insertable: true, atomic: true, create: CORE.linkGrid },
  tipJar: { label: 'Tip Jar', icon: QrCode, hint: 'A QR code for tips to a Radix account', insertable: true, atomic: true, create: () => ({ type: 'tipJar', address: '', label: 'Tip the author ☕️', message: 'Support independent writing on Radix — scan to send $XRD.' }) },
  references: { label: 'References', icon: ListOrdered, hint: 'Numbered sources the text cites', insertable: true, atomic: true, create: CORE.references },
  infobox: { label: 'Infobox', icon: Info, hint: 'A sidebar beside the article', create: CORE.infobox },
  stats: { label: 'Stats', icon: BarChart3, hint: 'A row of headline figures', create: CORE.stats },
  testimonial: { label: 'Testimonial', icon: MessageSquareQuote, hint: 'A quote and who said it', create: CORE.testimonial },
};

/** Every type the wire format accepts: `BLOCK_SCHEMA`'s enum reads it. */
const BLOCK_TYPES = Object.keys(BLOCK_META) as BlockType[];
/**
 * One block on the wire, as JSON Schema: the /openapi.json `Block` and the item
 * of every MCP tool's `content` array. Derived, because a hand-listed enum
 * named six of the fourteen types the write path accepts. The fields named are
 * the ones an agent cannot guess; every other shape is an existing page's.
 */
export const BLOCK_SCHEMA = {
  type: 'object',
  description:
    'A typed block with a unique `id` (UUID) and a `type`. A `content` block carries semantic HTML in `text`; an `infobox` carries nested `blocks`. '
    + 'For any other type, copy the shape of one already on a page: get_page with `blocks: true` (or GET /api/wiki/{path}) returns blocks as stored.',
  required: ['id', 'type'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    type: { type: 'string', enum: BLOCK_TYPES },
    text: { type: 'string', description: 'Semantic HTML (content, banner)' },
    blocks: { type: 'array', items: { type: 'object' }, description: 'Nested leaf blocks (infobox)' },
    source: { type: 'string', enum: LIST_SOURCES, description: 'Where a list\'s pages come from (list): `under` the pages in the category `under` names, `newest` the newest `count` pages (within `under` if given), `chosen` the pages in `pages`' },
    under: { type: 'string', description: 'A tag path, such as `contents/tech` (list)' },
    count: { type: 'integer', minimum: 1, maximum: MAX_BLOCK_ROWS, description: 'How many of the newest (list)' },
    pages: { type: 'array', items: { type: 'string' }, maxItems: MAX_BLOCK_ROWS, description: 'Page ids in display order (list, `chosen`): the `id` get_page returns with `blocks: true`' },
    show: { type: 'string', enum: ['links', 'cards'], description: 'Each page as a link with its age, or as a card with its banner and opening line (list)' },
    metric: { type: 'string', enum: ACTIVITY_METRICS.map(m => m.key), description: 'The series charted (networkChart)' },
  },
  additionalProperties: true,
} as const;

export const INSERTABLE_BLOCKS: readonly BlockType[] = BLOCK_TYPES.filter(t => BLOCK_META[t].insertable);
export const ATOMIC_BLOCK_TYPES: readonly BlockType[] = BLOCK_TYPES.filter(t => BLOCK_META[t].atomic);

export const createBlock = (type: BlockType): Block => ({ id: crypto.randomUUID(), ...BLOCK_META[type].create() } as Block);

export const duplicateBlock = (block: Block): Block => duplicateBlockIds(block, () => crypto.randomUUID());

// --- Block validation ---
//
// The walk (id/type gate, container branch, the two nested item validators) and
// the core leaf checks are `wiki-formant/validation`, shared with caper and
// acuiq2. Only the four native cases below are this repo's — its block type set is.
//
// `okUrl` arrives with it: reference and link-grid URLs outside http(s) and
// mailto are rejected at the write path. React 19 neutralises a `javascript:`
// href at render time, so
// this is defence in depth rather than a fix for a live hole -- but a URL that
// can never render safely is better rejected than stored.

//
// Every type but the two containers is a valid leaf. `atomic` above says which
// types the infobox and column MENUS offer, which is not the same question:
// reading it here rejected every save of the eight Week in Review issues that
// carry a top-level testimonial, through the editor and MCP alike.
const core = coreAtomicValidator();
const { validateBlocks: validate, blockIssues } = createBlockValidator({
  isKnownType: t => t in BLOCK_META,
  isAtomicType: t => t !== 'columns' && t !== 'infobox',
  validateAtomic: b => {
    switch (b.type) {
      case 'assetPrice':
        return b.resourceAddress === undefined || typeof b.resourceAddress === 'string';
      case 'rssFeed':
        return typeof b.url === 'string';
      case 'networkChart':
        return isActivityMetric(b.metric) && (b.range === undefined || typeof b.range === 'string');
      case 'tipJar':
        return typeof b.address === 'string';
      default:
        return core(b);
    }
  },
});

export const validateBlocks = (content: unknown): content is Block[] => validate(content);

/** Where a rejected tree fails and why, for an error that names the problem. */
export { blockIssues };

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
