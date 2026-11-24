// src/lib/wiki.ts - Server-side data fetching

import { cache } from 'react';
import { revalidateTag, unstable_cache } from 'next/cache';
import { wikiStore, type ListSort, type WikiPageRow, type WikiRevisionRow } from 'wiki-formant/store';
import { withChanges } from 'wiki-formant/history';
import { HttpError } from 'wiki-formant/http';
import { cacheTagHeaders } from 'wiki-formant/http';
import { searchWiki, type WikiRow } from 'wiki-formant/wiki-tools';
import { blocksToMarkdown } from '@/lib/markdown';
import { prisma } from '@/lib/prisma/client';
import { pagePath, pageUrl } from '@/lib/utils';
import { parseChartEvents, type NetworkEvent } from '@/lib/radix/events';
import { getSortOrder, getMetadataKeys, HIDDEN_TAG_PATHS } from '@/lib/tags';
import type { WikiAuthor, WikiPage, IdeasPage } from '@/types';
import type { Block, ListBlock, RssFeedBlock } from '@/types/blocks';
import { blockLimit, MAX_BLOCK_ROWS } from 'wiki-formant/validation';
import { today } from 'wiki-formant/blocks';
import type { ChangeType } from 'wiki-formant/versioning';
import { leafBlocks } from '@/lib/block-utils';
import { sanitizePage } from '@/lib/sanitize';
import { splitNews, tickerNews, type NewsItem } from '@/lib/news';
import { RECAP_PREFIX } from '@/lib/week-in-review';
import { checklistProgress } from '@/lib/checklist';

/**
 * The wiki's pages and revisions: `wiki-formant/store` over this app's client.
 * Every write goes through it, so every content change has its revision and a
 * save that lost a race is refused rather than applied over the other one.
 */
export const store = wikiStore<Block>({
  sql: (query, ...values) => prisma.$queryRawUnsafe(query, ...values),
  hidden: HIDDEN_TAG_PATHS,
});

// ========== AUTHORS ==========
export const AUTHOR_SELECT = { select: { id: true, displayName: true, shortAddress: true, avatarUrl: true } } as const;

/** Authors by id, for rows the store returns with `authorId` alone. */
export async function authorsOf(ids: Iterable<string | null>): Promise<Map<string, WikiAuthor>> {
  const wanted = [...new Set([...ids].filter((id): id is string => !!id))];
  if (!wanted.length) return new Map();
  const users = await prisma.user.findMany({ where: { id: { in: wanted } }, ...AUTHOR_SELECT });
  return new Map(users.map(u => [u.id, u]));
}

const asMeta = (metadata: unknown) => (metadata ?? {}) as Record<string, unknown>;

/**
 * A stored row as the app's views read it. The banner and a blog post's
 * co-editors live in metadata, beside the facet keys; the views keep reading
 * them as fields.
 */
export function toWikiPage<R extends Omit<WikiPageRow, 'content'> & { content?: unknown; snippet?: string; revisionCount?: number }>(
  row: R,
  authors?: Map<string, WikiAuthor>,
): WikiPage {
  const meta = asMeta(row.metadata);
  const author = row.authorId ? authors?.get(row.authorId) : undefined;
  return {
    ...row,
    content: (row.content ?? null) as WikiPage['content'],
    metadata: meta as WikiPage['metadata'],
    bannerImage: typeof meta.banner === 'string' ? meta.banner : null,
    editorIds: Array.isArray(meta.editors) ? (meta.editors as string[]) : [],
    ...(author ? { author } : {}),
  };
}

export type StoredRow = Parameters<typeof toWikiPage>[0];

/** Stored rows as pages, each with its author. */
export async function withAuthors(rows: StoredRow[]): Promise<WikiPage[]> {
  const authors = await authorsOf(rows.map(r => r.authorId));
  return rows.map(r => toWikiPage(r, authors));
}

/** A stored row as a page with its author. */
export const withAuthor = async (row: StoredRow): Promise<WikiPage> => toWikiPage(row, await authorsOf([row.authorId]));

/** A day, matching the catch-all page's `revalidate`: a page takes the shortest
 *  revalidate of any cache it reads, so a minute here re-rendered every article each
 *  minute. Writes bust the pages they change (`revalidatePage`), so the day is only a
 *  backstop. Everything also carries `wiki`, which a bulk rewrite busts whole. */
const WIKI_TAG = 'wiki';
const CACHE_OPTS = { tags: [WIKI_TAG], revalidate: 86400 };

/** The tag of what a URL renders: its path, so `page:/` is the homepage and `page:/ideas` the ideas board. */
export const pageTag = (tagPath: string, slug = '') => `page:/${[tagPath, slug].filter(Boolean).join('/')}`;

/** The homepage's tag, which every save expires since the homepage lists and
 *  counts what the wiki holds: a route handler whose text spans the corpus carries it. */
export const CORPUS_TAG = pageTag('');

/** The ticker's news, on every page that draws it; a homepage save expires it. */
const NEWS_TAG = 'news';

/** The tag headers a route handler sends: its own tags, plus `wiki`, which a
 *  script's bulk write purges, since it cannot name every page it touched. */
export const routeTags = (tags: string | readonly string[]) => cacheTagHeaders([WIKI_TAG, ...[tags].flat()]);

/**
 * Expires what an edit to a page changes: the page at each of `slugs`, and every
 * category above it up to the homepage, since each one lists or counts what it
 * holds. A page's tags reach every route that read it, so the rest of the wiki
 * stays cached. Busting `wiki` instead re-rendered all of it on every edit.
 */
export function revalidatePage(tagPath: string, ...slugs: string[]) {
  const segments = tagPath ? tagPath.split('/') : [];
  const tags = new Set([...segments.map((_, i) => segments.slice(0, i).join('/')), tagPath].map(t => pageTag(t)));
  for (const slug of slugs) tags.add(pageTag(tagPath, slug));
  // The homepage stores the news every banner's ticker shows.
  if (!tagPath && slugs.includes('')) tags.add(NEWS_TAG);
  for (const tag of tags) revalidateTag(tag, { expire: 0 });
}

/** A cache hit returns plain JSON and a miss the live rows; flattening before
 *  caching gives both the identical plain shape across the RSC boundary. */
const plain = <T>(value: T): T => value == null ? value : JSON.parse(JSON.stringify(value));

/** Shorthand for cache(unstable_cache(fn, [key], CACHE_OPTS)), plus the page tags `tagsOf` names for a call's arguments. */
export function cached<T extends (...args: any[]) => Promise<any>>(key: string, fn: T, tagsOf?: (...args: Parameters<T>) => string[]): T {
  const wrapped = async (...args: Parameters<T>) => plain(await fn(...args));
  if (!tagsOf) return cache(unstable_cache(wrapped as T, [key], CACHE_OPTS)) as T;
  return cache((...args: Parameters<T>) =>
    unstable_cache(wrapped, [key], { ...CACHE_OPTS, tags: [...CACHE_OPTS.tags, ...tagsOf(...args)] })(...args)) as T;
}

// ========== DATA FETCHING ==========

export const getPage = cached('getPage',
  async (tagPath: string, slug: string): Promise<WikiPage | null> => {
    const row = await store.get(tagPath, slug);
    return row && withAuthor(row);
  },
  (tagPath, slug) => [pageTag(tagPath, slug)],
);

/** The root's own article occupies the empty slug of the empty tag path. */
export const getHomepage = () => getPage('', '');

/**
 * The homepage's Latest News as the ticker under every other page's banner
 * carries it. Read from the store under its own tag, not through `getHomepage`:
 * that would put the homepage's tag on every page drawing the ticker, and every
 * save expires that tag. So an edit elsewhere leaves these pages cached, and a
 * save of the homepage re-renders them.
 */
export const getNews = cached('getNews',
  async (): Promise<NewsItem[]> => {
    const home = await store.get('', '');
    return home ? tickerNews(splitNews(sanitizePage(home).content)) : [];
  },
  () => [NEWS_TAG],
);

/**
 * A category's own article, stored at the empty slug — the same slot the homepage
 * occupies for the root. The category URL renders it above the listing, so the
 * topic and the pages under it are one page rather than an article plus a pointer.
 */
export const getCategoryHub = async (tagPath: string) => tagPath ? getPage(tagPath, '') : null;

export type PageRef = { tagPath: string; slug: string; title: string };
const PAGE_REF_SELECT = { tagPath: true, slug: true, title: true } as const;

/** The article a token belongs to: the page whose `assets` names it, an ecosystem project's or $XRD's own. */
export const getPageByAsset = cached('getPageByAsset',
  async (resourceAddress: string): Promise<PageRef | null> => {
    return prisma.wikiPage.findFirst({ where: { siteId: '', metadata: { path: ['assets'], equals: resourceAddress } }, select: PAGE_REF_SELECT });
  },
);

/** Every page that names a token in `assets`, by the token's address, for the token tables. */
export const getAssetPages = cached('getAssetPages',
  async (): Promise<Record<string, PageRef>> => {
    const rows = await prisma.wikiPage.findMany({ where: { siteId: '', metadata: { path: ['assets'], string_starts_with: 'resource_' } }, select: { ...PAGE_REF_SELECT, metadata: true } });
    return Object.fromEntries(rows.flatMap(({ metadata, ...ref }) => {
      const asset = asMeta(metadata).assets;
      return typeof asset === 'string' ? [[asset, ref]] : [];
    }));
  },
);

/**
 * Ecosystem pages by the validator they document: the address in a page's first block, its
 * infobox (a few older pages write that as a content block holding a table). Body text is
 * not enough, since a staking guide or a weekly recap names a dozen validators it is not about.
 */
export const getValidatorPages = cached('getValidatorPages',
  async (): Promise<Record<string, PageRef>> => {
    const rows = await prisma.$queryRaw<(PageRef & { address: string })[]>`
      SELECT DISTINCT ON (m[1]) m[1] AS address, "tagPath", slug, title
      FROM "WikiPage", regexp_matches((content->0)::text, '(validator_rdx1[0-9a-z]{54})', 'g') AS m
      WHERE "siteId" = '' AND "tagPath" LIKE 'ecosystem%'
      ORDER BY m[1], "updatedAt" DESC`;
    return Object.fromEntries(rows.map(({ address, ...ref }) => [address, ref]));
  },
);

/** The newest Radix Week in Review recap. */
/** Every event a page tags for the chart marks (`metadata.chartEvents`), oldest first. */
export const getNetworkEvents = cached('getNetworkEvents',
  async (): Promise<NetworkEvent[]> => {
    const rows = await prisma.wikiPage.findMany({ where: { siteId: '', metadata: { path: ['chartEvents'], string_starts_with: '' } }, select: { tagPath: true, slug: true, metadata: true } });
    return rows.flatMap(r => parseChartEvents(asMeta(r.metadata).chartEvents, pagePath(r.tagPath, r.slug))).sort((a, b) => a.date.localeCompare(b.date));
  },
);

export const getLatestRecap = cached('getLatestRecap',
  async (): Promise<PageRef | null> => {
    return prisma.wikiPage.findFirst({ where: { siteId: '', tagPath: 'blog', slug: { startsWith: RECAP_PREFIX } }, orderBy: { createdAt: 'desc' }, select: PAGE_REF_SELECT });
  },
  () => [pageTag('blog')],
);

async function listCategory(tagPath: string, sort?: ListSort, limit = 200): Promise<WikiPage[]> {
  const resolved = sort ?? getSortOrder(tagPath.split('/'));
  // Newest `date` first where the section declares one: a blog post or an event
  // is as recent as the day it is about.
  const dated = resolved !== 'title' && getMetadataKeys(tagPath.split('/')).some(k => k.key === 'date' && k.type === 'date');
  return withAuthors(await store.list(tagPath, { sort: dated ? 'date' : resolved, limit }));
}

export const getCategoryPages = cached('getCategoryPages', listCategory, tagPath => [pageTag(tagPath)]);

/**
 * The category's listing as the pool an article's See also ranks from, under
 * `wiki` alone. Tagged with its category, every edit would re-render each of
 * the page's siblings to refresh their related links.
 */
export const getSiblingPages = cached('getSiblingPages', (tagPath: string) => listCategory(tagPath));

/**
 * Title-only refs for everything under a category. A subcategory card used to
 * carry a page *count* and nothing else, which made a section index a page of
 * cards leading to more cards; with the titles it holds, the card is the index
 * and every article is one hop from the category it lives in.
 */
export const getSubtreeRefs = cached('getSubtreeRefs', (tagPath: string) => store.subtree(tagPath), tagPath => [pageTag(tagPath)]);

/** Every page's title by its address, so structured data can name the pages an article links to.
 *  Every save busts it through the homepage's tag. */
export const getTitleIndex = cached('getTitleIndex',
  async (): Promise<Record<string, string>> =>
    Object.fromEntries((await store.refs()).map(r => [pagePath(r.tagPath, r.slug), r.title])),
  () => [CORPUS_TAG],
);

/** Title-only lookup — a category's main article usually lives in another category. */
export const getPageRef = cached('getPageRef',
  async (path: string): Promise<{ title: string; href: string } | null> => {
    const slug = path.split('/').pop() ?? '';
    const page = await store.get(path.slice(0, -(slug.length + 1)), slug);
    return page && { title: page.title, href: `/${path}` };
  },
  path => [pageTag(path)],
);

export function isIdeasPath(tagPath: string): boolean {
  return tagPath === 'ideas' || tagPath.startsWith('ideas/');
}

export const getIdeasPages = cached('getIdeasBoard',
  async (tagPath: string, limit = 200): Promise<IdeasPage[]> => {
    // Content is read only to count each card's tick-boxes; the board gets the count.
    const pages = await prisma.wikiPage.findMany({
      where: { siteId: '', tagPath: { startsWith: tagPath } },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
    // A card's talk is its room: the lines still standing, and when the last was said.
    const replies = pages.length
      ? await prisma.chatMessage.groupBy({ by: ['pageId'], where: { pageId: { in: pages.map(p => p.id) }, deletedAt: null }, _count: true, _max: { createdAt: true } })
      : [];
    const byPage = new Map(replies.map(r => [r.pageId, r]));
    const rows = await withAuthors(pages.map(p => ({ ...p, metadata: asMeta(p.metadata), snippet: '' })));
    return rows.map(p => ({
      ...p,
      content: null,
      version: '',
      replyCount: byPage.get(p.id)?._count ?? 0,
      lastActivity: byPage.get(p.id)?._max.createdAt ?? p.createdAt,
      progress: checklistProgress(p.content),
    }));
  },
  tagPath => [pageTag(tagPath)],
);

/** A deleted page's newest snapshot at an address, its rows as `deletePage` kept them. */
export async function findDeletion(tagPath: string, slug: string) {
  const row = await prisma.deletedPage.findFirst({ where: { tagPath, slug }, orderBy: { deletedAt: 'desc' } });
  if (!row) return null;
  return {
    ...row,
    page: row.page as unknown as StoredRow,
    revisions: (row.revisions as unknown as WikiRevisionRow<Block>[]).map(r => ({ ...r, createdAt: new Date(r.createdAt) })),
  };
}

/**
 * A page's history for the history view and `/api/wiki/…/history`, each
 * revision diffed against the one before it. Uncached, and deliberately
 * reachable that way: the API route is the documented way to confirm a
 * direct-DB script write landed before any cache has caught up with it.
 * A deleted page answers from its snapshot, with `deleted` saying when and by
 * whom, so any of its revisions can restore it.
 */
export async function loadPageHistory(tagPath: string, slug: string) {
  const page = await store.get(tagPath, slug);
  const gone = page ? null : await findDeletion(tagPath, slug);
  if (!page && !gone) return null;
  const revisions = page
    ? await store.history(page.id, { limit: 500 })
    : withChanges<WikiRevisionRow<Block>, Block>(gone!.revisions.slice(-501).reverse()).slice(0, 500);
  const authors = await authorsOf([...revisions.map(r => r.authorId), gone?.deletedBy ?? null]);
  return {
    currentVersion: page?.version ?? gone!.page.version,
    ...(gone && { deleted: { at: gone.deletedAt, by: (gone.deletedBy && authors.get(gone.deletedBy)) || null } }),
    // The column is a string, written only by the store's own version bump.
    revisions: revisions.map(r => ({ ...r, changeType: r.changeType as ChangeType, ...(r.authorId && authors.get(r.authorId) ? { author: authors.get(r.authorId) } : {}) })),
  };
}

export const getPageHistory = cached('getPageHistory', loadPageHistory, (tagPath, slug) => [pageTag(tagPath, slug)]);

/**
 * Deletes a page, keeping it and its revisions in `deleted_pages` so its
 * history can still restore it. Its notifications go; its room's lines stay,
 * keyed to the page id a restore brings back.
 */
export async function deletePage(page: { id: string }, deletedBy: string | null) {
  await prisma.$transaction([
    prisma.notification.deleteMany({ where: { pageId: page.id } }),
    prisma.$executeRaw`
      INSERT INTO deleted_pages (id, tag_path, slug, page, revisions, deleted_by)
      SELECT p.id, p."tagPath", p.slug, to_jsonb(p) - 'search_tsv',
             COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r."createdAt", r.id) FROM "WikiRevision" r WHERE r."pageId" = p.id), '[]'::jsonb),
             ${deletedBy}::text
        FROM "WikiPage" p WHERE p.id = ${page.id}`,
    prisma.wikiPage.delete({ where: { id: page.id } }),
  ]);
}

/**
 * Puts a page back as one of its revisions had it, the restore a major
 * revision of its own. A deleted page first comes back as it stood, under its
 * own id with its whole history, unless a page has taken its address since.
 */
export async function restoreRevision(tagPath: string, slug: string, revisionId: string, authorId: string) {
  if (!await store.get(tagPath, slug)) {
    const gone = await findDeletion(tagPath, slug);
    if (!gone) throw new HttpError(404, 'Page not found');
    if (!gone.revisions.some(r => r.id === revisionId)) throw new HttpError(404, 'Revision not found');
    await prisma.$transaction([
      prisma.$executeRaw`
        INSERT INTO "WikiPage" (id, "siteId", "tagPath", slug, title, content, metadata, version, "authorId", "lastVerifiedAt", "createdAt", "updatedAt")
        SELECT id, "siteId", "tagPath", slug, title, content, metadata, version, "authorId", "lastVerifiedAt", "createdAt", "updatedAt"
          FROM jsonb_populate_record(NULL::"WikiPage", ${JSON.stringify(gone.page)}::jsonb)`,
      prisma.$executeRaw`
        INSERT INTO "WikiRevision" (id, "pageId", title, content, version, "changeType", message, "authorId", "createdAt")
        SELECT id, "pageId", title, content, version, "changeType", message, "authorId", "createdAt"
          FROM jsonb_populate_recordset(NULL::"WikiRevision", ${JSON.stringify(gone.revisions)}::jsonb)`,
      prisma.deletedPage.delete({ where: { id: gone.id } }),
    ]);
  }
  return store.restore(tagPath, slug, revisionId, { authorId });
}

// ========== SEARCH ==========

/** A single metadata value's ceiling in a listing. Generous for a real one. */
const META_VALUE_MAX = 500;

/**
 * Metadata as a *listing* may carry it: declared keys only, each bounded.
 *
 * `metadata` is a free-form JSON column, and one page had the sweep
 * routine writing 327 KB of run state into it. Passed straight through, that
 * single row made `list_pages`, `get_recent_changes` and `search_wiki` each
 * answer with roughly 350 KB — around 90k tokens, on the three calls an agent
 * makes before anything else — and published internal operational notes to
 * anonymous MCP callers.
 *
 * Which keys a page shows is a schema question the tag hierarchy already
 * answers, so ask it. The cap is the backstop for a declared key that grows.
 */
function listingMetadata(tagPath: string, meta: Record<string, unknown>) {
  const declared = new Set(getMetadataKeys(tagPath.split('/')).map(k => k.key));
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (!declared.has(key) || value == null) continue;
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    out[key] = text.length > META_VALUE_MAX ? `${text.slice(0, META_VALUE_MAX)}…` : value;
  }
  return Object.keys(out).length ? out : null;
}

/** A Prisma filter for article space: every tag path but the back office. */
export const NOT_HIDDEN = { notIn: HIDDEN_TAG_PATHS } as const;

/**
 * How this wiki's pages read to an agent: where each lives, its text, and the
 * declared metadata a row may carry. `wiki-formant/wiki-tools` builds every
 * agent-facing row from it: the MCP read tools, `GET /api/wiki?q=` and the
 * header search, so the three cannot drift.
 */
export const WIKI_READ = {
  store,
  url: pageUrl,
  text: blocksToMarkdown,
  // The page's own resolver, so a live list reads over MCP as on the page and its twin.
  resolve: resolveBlockData,
  metadata: listingMetadata,
};

/** A ranked page of search results: the rows `search_wiki` and `GET /api/wiki?q=` both return. */
export const searchPages = (query: string, { tagPath, page, size }: { tagPath?: string | null; page: number; size: number }) =>
  searchWiki(WIKI_READ, query, { tagPath: tagPath ?? undefined, page, size });

export type PageSummary = WikiRow;

// ========== BLOCK DATA RESOLUTION ==========

const getRecentPages = cached('getRecentPages',
  // A block that names a path gets that path, hidden or not. One that names
  // none is asking "what changed on the wiki", and the answer to that is
  // article space.
  async (tagPath: string | undefined, limit: number) => withAuthors(await store.recent({ tagPath, limit })),
  tagPath => [pageTag(tagPath ?? '')],
);

const getPagesByIds = cached('getPagesByIds', async (ids: string[]) => withAuthors(await store.byIds(ids)));

// A failed read throws past the cache, so it is never stored as an empty feed:
// the block is left unresolved and the reader's browser fetches it instead.
const getFeedItems = cached('getFeedItems',
  async (url: string, limit: number): Promise<any[]> => {
    const res = await fetch(url, { headers: { 'User-Agent': 'radix-wiki' } });
    if (!res.ok) throw new Error(`Feed ${url} answered ${res.status}`);
    const json = await res.json();
    if (!Array.isArray(json?.items)) throw new Error(`Feed ${url} returned no item list`);
    return json.items.slice(0, limit);
  },
);

/**
 * A list's pages. `newest` is the store's recent pages, within `under` when it
 * names a category; `under` is that category's own listing, in its own order;
 * `chosen` is the picked ids, in the order picked.
 */
function listPages(b: ListBlock): Promise<WikiPage[]> {
  switch (b.source) {
    case 'newest': return getRecentPages(b.under, blockLimit(b.count, 5));
    case 'under': return b.under ? getCategoryPages(b.under, undefined, blockLimit(b.count, MAX_BLOCK_ROWS)) : Promise.resolve([]);
    case 'chosen': return getPagesByIds(b.pages ?? []);
  }
}

/** Pre-resolve list and rssFeed blocks server-side to avoid client waterfalls, and date the events blocks. */
export async function resolveBlockData(blocks: Block[]): Promise<Block[]> {
  const leaves = leafBlocks(blocks);
  // An events block is split by the day the server renders it, which hydration must match.
  const day = today();
  leaves.forEach(b => { if (b.type === 'events') b.day = day; });
  const lists = leaves.filter((b): b is ListBlock => b.type === 'list');
  const feeds = leaves.filter((b): b is RssFeedBlock => b.type === 'rssFeed');
  if (!lists.length && !feeds.length) return blocks;

  const [listResults, feedResults] = await Promise.all([
    Promise.all(lists.map(listPages)),
    Promise.all(feeds.map(b => getFeedItems(b.url, b.limit || 20).catch(() => undefined))),
  ]);
  lists.forEach((b, i) => { b.items = listResults[i]; });
  feeds.forEach((b, i) => { b.resolvedItems = feedResults[i]; });
  return blocks;
}
