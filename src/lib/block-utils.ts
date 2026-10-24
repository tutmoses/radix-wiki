// src/lib/block-utils.ts — this wiki's block model: the core blocks plus its
// own four, each a label, an icon and a hint for the editor, a default, and a
// check. Everything derived from the set (the shape, a new block, a copy, the
// validator and its issues) is `defineBlocks`.

import type { Block, BlockType } from '@/types/blocks';
import { defineBlocks, MAX_BLOCK_ROWS } from 'wiki-formant/validation';
import { Activity, List, Columns, TrendingUp, Pencil, Info, Rss, Code2, BarChart3, CalendarDays, MapPin, MessageSquareQuote, LayoutGrid, QrCode, ListOrdered, AlertTriangle, type LucideIcon } from 'lucide-react';
import { coreBlockDefaults, leafBlocks as leaves, LIST_SOURCES, someBlock } from 'wiki-formant/blocks';
import { ACTIVITY_METRICS, isActivityMetric } from '@/lib/radix/metrics';

type BlockSpec = { label: string; icon: LucideIcon; hint: string; insertable?: true; create: () => Omit<Block, 'id'> };

const CORE = coreBlockDefaults();

export const BLOCK_META: Record<BlockType, BlockSpec> = {
  content: { label: 'Content', icon: Pencil, hint: 'Text, headings, images, tables and embeds', insertable: true, create: CORE.content },
  banner: { label: 'Notice Banner', icon: AlertTriangle, hint: 'A notice at the top of the page', insertable: true, create: CORE.banner },
  columns: { label: 'Columns', icon: Columns, hint: 'Two to four columns of blocks', insertable: true, create: CORE.columns },
  list: { label: 'Page List', icon: List, hint: 'The pages in a category, the newest, or pages you pick', insertable: true, create: CORE.list },
  assetPrice: { label: 'Asset Price', icon: TrendingUp, hint: "A Radix token's live price and chart", insertable: true, create: () => ({ type: 'assetPrice', resourceAddress: 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd', showChange: true }) },
  networkChart: { label: 'Network Chart', icon: Activity, hint: 'Daily Radix network activity, live', insertable: true, create: () => ({ type: 'networkChart', metric: 'transactions', range: '1y' }) },
  rssFeed: { label: 'RSS Feed', icon: Rss, hint: 'Items from an RSS or JSON feed', insertable: true, create: () => ({ type: 'rssFeed', url: 'https://tutmoses.github.io/rss-feed/feeds.json', limit: 15 }) },
  codeTabs: { label: 'Code Tabs', icon: Code2, hint: 'Code samples, a tab per language', insertable: true, create: CORE.codeTabs },
  linkGrid: { label: 'Link Grid', icon: LayoutGrid, hint: 'Links in groups under headings', insertable: true, create: CORE.linkGrid },
  tipJar: { label: 'Tip Jar', icon: QrCode, hint: 'A QR code for tips to a Radix account', insertable: true, create: () => ({ type: 'tipJar', address: '', label: 'Tip the author ☕️', message: 'Support independent writing on Radix — scan to send $XRD.' }) },
  references: { label: 'References', icon: ListOrdered, hint: 'Numbered sources the text cites', insertable: true, create: CORE.references },
  locations: { label: 'Locations', icon: MapPin, hint: 'Venues and offices, with their addresses and opening hours', insertable: true, create: CORE.locations },
  events: { label: 'Events', icon: CalendarDays, hint: 'Talks, AMAs and conferences, sorted into upcoming and past by date', insertable: true, create: CORE.events },
  infobox: { label: 'Infobox', icon: Info, hint: 'A sidebar beside the article', create: CORE.infobox },
  stats: { label: 'Stats', icon: BarChart3, hint: 'A row of headline figures', insertable: true, create: CORE.stats },
  testimonial: { label: 'Testimonial', icon: MessageSquareQuote, hint: 'A quote and who said it', insertable: true, create: CORE.testimonial },
};

const optionalString = (v: unknown) => v === undefined || typeof v === 'string';

const model = defineBlocks<Block>({
  defaults: Object.fromEntries(Object.entries(BLOCK_META).map(([type, spec]) => [type, spec.create])) as Record<BlockType, () => Omit<Block, 'id'>>,
  checks: {
    assetPrice: b => optionalString(b.resourceAddress),
    rssFeed: b => typeof b.url === 'string',
    networkChart: b => isActivityMetric(b.metric) && optionalString(b.range),
    tipJar: b => typeof b.address === 'string',
  },
});
export const { shape: BLOCK_SHAPE, atomicTypes: ATOMIC_BLOCK_TYPES, createBlock, duplicateBlock, validateBlocks, blockIssues } = model;
const BLOCK_TYPES = model.types;

export const INSERTABLE_BLOCKS: readonly BlockType[] = BLOCK_TYPES.filter(t => BLOCK_META[t].insertable);

/** Every leaf in document order, with the containers flattened away. */
export const leafBlocks = (blocks: Block[]) => leaves(blocks, BLOCK_SHAPE.containers) as Exclude<Block, { type: 'infobox' | 'columns' }>[];

export const BLOCK_SCHEMA = {
  type: 'object',
  description:
    'A typed block with a unique `id` (UUID) and a `type`. A `content` block carries semantic HTML in `text`; an `infobox` carries nested `blocks`. '
    + 'An `events` block carries `items: [{ id, date, end?, text }]`, each date a year, month or day (`2026`, `2026-11`, `2026-11-12`) and `text` inline HTML saying what and where, in any order: the page sorts them into upcoming and past by the day it is read. '
    + 'A `locations` block carries `items: [{ id, name?, address?, map?, phone?, email?, hours?, timeZone?, note? }]`, each with its address (plain text, a line to a line) or its `hours`, rows of `{ days: ["mon"…"sun"], opens: "08:00", closes: "18:00" }`; the page groups the days and says whether each place is open by its own clock. '
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

/** Whether a page carries code to highlight on the server. */
export const hasCodeBlocksInContent = (content: Block[]): boolean =>
  Array.isArray(content) &&
  someBlock(content, block => !!block && ((block.type === 'content' && !!block.text?.includes('<pre')) || block.type === 'codeTabs'), BLOCK_SHAPE.containers);
