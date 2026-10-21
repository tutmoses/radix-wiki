// src/lib/wiki.ts - Server-side data fetching

import { cache } from 'react';
import { revalidateTag, unstable_cache } from 'next/cache';
import { wikiStore, type ListSort, type WikiPageRow } from 'wiki-formant/store';
import { searchWiki, type WikiRow } from 'wiki-formant/wiki-tools';
import { blocksToMarkdown } from '@/lib/markdown';
import { prisma } from '@/lib/prisma/client';
import { pageUrl } from '@/lib/utils';
import { getSortOrder, getMetadataKeys, HIDDEN_TAG_PATHS } from '@/lib/tags';
import type { WikiAuthor, WikiPage, IdeasPage } from '@/types';
import type { Block, ListBlock, RssFeedBlock } from '@/types/blocks';
import { blockLimit, MAX_BLOCK_ROWS } from 'wiki-formant/validation';
import { leafBlocks } from '@/lib/block-shape';
import { RECAP_PREFIX } from '@/lib/week-in-review';

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

const withAuthors = async <R extends Omit<WikiPageRow, 'content'> & { content?: unknown; snippet?: string }>(rows: R[]) => {
  const authors = await authorsOf(rows.map(r => r.authorId));
  return rows.map(r => toWikiPage(r, authors));
};

/** A day, matching the catch-all page's `revalidate`: a page takes the shortest
 *  revalidate of any cache it reads, so a minute here re-rendered every article each
 *  minute. Writes bust the pages they change (`revalidatePage`), so the day is only a
 *  backstop. Everything also carries `wiki`, which a bulk rewrite busts whole. */
const CACHE_OPTS = { tags: ['wiki'], revalidate: 86400 };

/** The tag of what a URL renders: its path, so `page:/` is the homepage and `page:/ideas` the ideas board. */
export const pageTag = (tagPath: string, slug = '') => `page:/${[tagPath, slug].filter(Boolean).join('/')}`;

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
    return row && toWikiPage(row, await authorsOf([row.authorId]));
  },
  (tagPath, slug) => [pageTag(tagPath, slug)],
);

/** The root's own article occupies the empty slug of the empty tag path. */
export const getHomepage = () => getPage('', '');

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

export const getIdeasPages = cached('getIdeasPages',
  async (tagPath: string, limit = 200): Promise<IdeasPage[]> => {
    const pages = await prisma.wikiPage.findMany({
      where: { siteId: '', tagPath: { startsWith: tagPath } },
      omit: { content: true },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
    const replies = pages.length
      ? await prisma.comment.groupBy({ by: ['pageId'], where: { pageId: { in: pages.map(p => p.id) } }, _count: true, _max: { createdAt: true } })
      : [];
    const byPage = new Map(replies.map(r => [r.pageId, r]));
    const rows = await withAuthors(pages.map(p => ({ ...p, metadata: asMeta(p.metadata), snippet: '' })));
    return rows.map(p => ({
      ...p,
      content: null,
      version: '',
      replyCount: byPage.get(p.id)?._count ?? 0,
      lastActivity: byPage.get(p.id)?._max.createdAt ?? p.createdAt,
    }));
  },
  tagPath => [pageTag(tagPath)],
);

/**
 * A page's history for the history view and `/api/wiki/…/history`, each
 * revision diffed against the one before it. Uncached, and deliberately
 * reachable that way: the API route is the documented way to confirm a
 * direct-DB script write landed, and those scripts do not revalidate the tag.
 */
export async function loadPageHistory(tagPath: string, slug: string) {
  const page = await store.get(tagPath, slug);
  if (!page) return null;
  const revisions = await store.history(page.id, { limit: 500 });
  const authors = await authorsOf(revisions.map(r => r.authorId));
  return {
    currentVersion: page.version,
    revisions: revisions.map(r => ({ ...r, ...(r.authorId && authors.get(r.authorId) ? { author: authors.get(r.authorId) } : {}) })),
  };
}

export const getPageHistory = cached('getPageHistory', loadPageHistory, (tagPath, slug) => [pageTag(tagPath, slug)]);

/** Deletes a page, its history, and the comments and notifications that point at it. */
export async function deletePage(page: { id: string; tagPath: string; slug: string }) {
  await prisma.$transaction([
    prisma.notification.deleteMany({ where: { pageId: page.id } }),
    prisma.comment.deleteMany({ where: { pageId: page.id } }),
  ]);
  return store.remove(page.tagPath, page.slug);
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

const getFeedItems = cached('getFeedItems',
  async (url: string, limit: number): Promise<any[]> => {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'radix-wiki' } });
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json?.items) ? json.items.slice(0, limit) : [];
    } catch { return []; }
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

/** Pre-resolve list and rssFeed blocks server-side to avoid client waterfalls. */
export async function resolveBlockData(blocks: Block[]): Promise<Block[]> {
  const leaves = leafBlocks(blocks);
  const lists = leaves.filter((b): b is ListBlock => b.type === 'list');
  const feeds = leaves.filter((b): b is RssFeedBlock => b.type === 'rssFeed');
  if (!lists.length && !feeds.length) return blocks;

  const [listResults, feedResults] = await Promise.all([
    Promise.all(lists.map(listPages)),
    Promise.all(feeds.map(b => getFeedItems(b.url, b.limit || 20))),
  ]);
  lists.forEach((b, i) => { b.items = listResults[i]; });
  feeds.forEach((b, i) => { b.resolvedItems = feedResults[i]; });
  return blocks;
}
