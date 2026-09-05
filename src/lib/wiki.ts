// src/lib/wiki.ts - Server-side data fetching

import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma/client';
import { getContentSnippet, getMatchSnippet, pageUrl } from '@/lib/utils';
import { decodeEntities } from '@/lib/content';
import { isValidTagPath, getSortOrder, getMetadataKeys, HIDDEN_TAG_PATHS, type SortOrder } from '@/lib/tags';
import type { WikiPage, IdeasPage } from '@/types';
import type { Block, RecentPagesBlock, PageListBlock, RssFeedBlock, ColumnsBlock } from '@/types/blocks';
import { computeRevisionDiff } from '@/lib/versioning';
import { STATIC_PATH_TYPES } from '@/lib/static-pages';

// ========== PRISMA QUERY FRAGMENTS ==========
export const AUTHOR_SELECT = { select: { id: true, displayName: true, shortAddress: true, avatarUrl: true } } as const;
export const PAGE_INCLUDE = { author: AUTHOR_SELECT, _count: { select: { revisions: true } } } as const;
export const CATEGORY_SELECT = {
  id: true, slug: true, title: true, content: true, bannerImage: true,
  tagPath: true, metadata: true, version: true, createdAt: true, updatedAt: true,
  authorId: true, author: AUTHOR_SELECT,
} as const;
export const PAGE_LIST_SELECT = {
  ...CATEGORY_SELECT,
  _count: { select: { revisions: true } },
} as const;
const CACHE_OPTS = { tags: ['wiki'], revalidate: 60 };

/** A cache hit returns plain JSON, but a miss returns Prisma's live objects — whose
 *  computed-field results (author.shortAddress) are proxies carrying symbol
 *  properties the RSC boundary rejects. Flattening before caching gives hit and
 *  miss the identical plain shape. */
const plain = <T>(value: T): T => value == null ? value : JSON.parse(JSON.stringify(value));

/** A card needs one line of the article, not the article. Every listing below selects
 *  `content` (there is no snippet column to select instead) and then trades it for that
 *  line here, before the row reaches a cache entry or the RSC payload — a page of 200
 *  cards was otherwise shipping 200 full block arrays to the browser, and the homepage
 *  was carrying the whole maintenance log inside its "recently updated" strip. */
const listRow = <T extends { content?: unknown }>(page: T): T =>
  ({ ...page, content: null, snippet: getContentSnippet(page.content) });

/** Shorthand for cache(unstable_cache(fn, [key], CACHE_OPTS)) */
export function cached<T extends (...args: any[]) => Promise<any>>(key: string, fn: T): T {
  const wrapped = async (...args: Parameters<T>) => plain(await fn(...args));
  return cache(unstable_cache(wrapped as T, [key], CACHE_OPTS)) as T;
}

// ========== UNIFIED PATH PARSING ==========

const SUFFIXES = ['edit', 'history', 'mdx'] as const;
type Suffix = typeof SUFFIXES[number];

export interface ParsedPath {
  type: 'homepage' | 'category' | 'page' | 'history' | 'edit' | 'mdx' | 'leaderboard' | 'welcome' | 'rewards' | 'search' | 'maintenance' | 'charts' | 'charts-validators' | 'charts-tokens' | 'token-detail' | 'invalid';
  tagPath: string;
  slug: string;
  suffix: Suffix | null;
  tokenAddress?: string;
}

export function parsePath(segments: string[] = [], mode: 'client' | 'api' = 'client'): ParsedPath {
  const base: ParsedPath = { type: 'homepage', tagPath: '', slug: '', suffix: null };
  if (segments.length === 0) return base;

  // Static pages, including the two-segment /charts pair — one lookup over the
  // same table that gives each of them its metadata and its sitemap row.
  const staticType = STATIC_PATH_TYPES.get(segments.join('/'));
  if (staticType) return { ...base, type: staticType as ParsedPath['type'] };

  // A token address is the only other thing under /charts; nothing else is.
  if (segments[0] === 'charts') {
    if (segments.length === 3 && segments[1] === 'tokens' && segments[2]!.startsWith('resource_')) {
      return { ...base, type: 'token-detail', tokenAddress: segments[2] };
    }
    return { ...base, type: 'invalid' };
  }

  // Single-segment suffix (e.g., /edit, /history, /mdx)
  if (segments.length === 1 && SUFFIXES.includes(segments[0] as Suffix)) {
    const suffix = segments[0] as Suffix;
    if (mode === 'api' && suffix === 'edit') return { ...base, type: 'invalid' };
    return { ...base, type: suffix, suffix };
  }

  // Check full path as tag (handles tags like 'history' that collide with suffixes).
  // The empty slug is the category's own hub article, the way `''/''` is the
  // homepage — so the API resolves it here too, and PUT lands on the hub row.
  if (isValidTagPath(segments)) {
    return { ...base, type: 'category', tagPath: segments.join('/') };
  }

  const lastSegment = segments[segments.length - 1];
  const suffix = SUFFIXES.includes(lastSegment as Suffix) ? lastSegment as Suffix : null;
  const pathSegments = suffix ? segments.slice(0, -1) : segments;

  // Client: check if stripped path is a category
  if (mode === 'client' && suffix && isValidTagPath(pathSegments)) {
    return { ...base, type: suffix === 'edit' ? 'category' : suffix, tagPath: pathSegments.join('/'), suffix };
  }

  if (pathSegments.length < 2) return { ...base, type: 'invalid' };

  const slug = pathSegments[pathSegments.length - 1]!;
  const tagPathSegments = pathSegments.slice(0, -1);

  if (!isValidTagPath(tagPathSegments)) {
    return { ...base, type: 'invalid' };
  }

  const tagPath = tagPathSegments.join('/');
  const type = suffix ?? 'page';
  if (mode === 'api' && suffix === 'edit') return { ...base, type: 'invalid' };
  return { type, tagPath, slug, suffix };
}

// ========== DATA FETCHING ==========

export const getPage = cached('getPage',
  async (tagPath: string, slug: string): Promise<WikiPage | null> => {
    return prisma.page.findUnique({ where: { tagPath_slug: { tagPath, slug } }, include: PAGE_INCLUDE }) as Promise<WikiPage | null>;
  },
);

/** The root's own article occupies the empty slug of the empty tag path. */
export const getHomepage = () => getPage('', '');

/**
 * A category's own article, stored at the empty slug — the same slot the homepage
 * occupies for the root. The category URL renders it above the listing, so the
 * topic and the pages under it are one page rather than an article plus a pointer.
 */
export const getCategoryHub = async (tagPath: string) => tagPath ? getPage(tagPath, '') : null;

export const getEcosystemPageByAsset = cached('getEcosystemPageByAsset',
  async (resourceAddress: string): Promise<{ tagPath: string; slug: string; title: string } | null> => {
    return prisma.page.findFirst({
      where: { tagPath: { startsWith: 'ecosystem' }, metadata: { path: ['assets'], equals: resourceAddress } },
      select: { tagPath: true, slug: true, title: true },
    });
  },
);

const sortOrderBy: Record<SortOrder, object> = {
  title: { title: 'asc' as const },
  newest: { createdAt: 'desc' as const },
  oldest: { createdAt: 'asc' as const },
  recent: { updatedAt: 'desc' as const },
};

export const getCategoryPages = cached('getCategoryPages',
  async (tagPath: string, sort?: SortOrder, limit = 200): Promise<WikiPage[]> => {
    const resolvedSort = sort ?? getSortOrder(tagPath.split('/'));
    const hasDateMeta = resolvedSort !== 'title' && getMetadataKeys(tagPath.split('/')).some(k => k.key === 'date' && k.type === 'date');
    const pages = await prisma.page.findMany({
      // The hub article heads the category page; it is not one of the cards in it.
      where: { tagPath, slug: { not: '' } },
      select: CATEGORY_SELECT,
      orderBy: sortOrderBy[resolvedSort],
      take: limit,
    }).then(rows => rows.map(listRow)) as unknown as WikiPage[];
    if (!hasDateMeta) return pages;
    const dir = resolvedSort === 'oldest' ? 1 : -1;
    return pages.sort((a, b) => {
      const da = (a.metadata as Record<string, string> | null)?.date || '';
      const db = (b.metadata as Record<string, string> | null)?.date || '';
      return (da < db ? -1 : da > db ? 1 : 0) * dir;
    });
  },
);

/** A category's subtree, minus the tag paths declared wiki-internal — search
 *  already excludes them, and a reader browsing Contents has no business being
 *  handed the maintenance log. */
const subtreeWhere = (tagPath: string) => ({
  tagPath: { startsWith: `${tagPath}/`, notIn: HIDDEN_TAG_PATHS },
  slug: { not: '' },
});

/**
 * Title-only refs for everything under a category. A subcategory card used to
 * carry a page *count* and nothing else, which made a section index a page of
 * cards leading to more cards; with the titles it holds, the card is the index
 * and every article is one hop from the category it lives in.
 */
export const getSubtreeRefs = cached('getSubtreeRefs',
  async (tagPath: string): Promise<{ tagPath: string; slug: string; title: string }[]> =>
    prisma.page.findMany({
      where: subtreeWhere(tagPath),
      select: { tagPath: true, slug: true, title: true },
      orderBy: { title: 'asc' },
    }),
);

/** Title-only lookup — a category's main article usually lives in another category. */
export const getPageRef = cached('getPageRef',
  async (path: string): Promise<{ title: string; href: string } | null> => {
    const slug = path.split('/').pop() ?? '';
    const tagPath = path.slice(0, -(slug.length + 1));
    const page = await prisma.page.findUnique({ where: { tagPath_slug: { tagPath, slug } }, select: { title: true } });
    return page && { title: page.title, href: `/${path}` };
  },
);

export function isIdeasPath(tagPath: string): boolean {
  return tagPath === 'ideas' || tagPath.startsWith('ideas/');
}

export const getIdeasPages = cached('getIdeasPages',
  async (tagPath: string, limit = 200): Promise<IdeasPage[]> => {
    const pages = await prisma.page.findMany({
      where: { tagPath: { startsWith: tagPath } },
      select: {
        ...CATEGORY_SELECT,
        _count: { select: { comments: true } },
        comments: { orderBy: { createdAt: 'desc' as const }, take: 1, select: { createdAt: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
    return pages.map(p => ({
      ...p,
      content: null,
      version: '',
      replyCount: p._count.comments,
      lastActivity: p.comments[0]?.createdAt ?? p.createdAt,
    })) as unknown as IdeasPage[];
  },
);

/**
 * Uncached, and deliberately reachable that way: `/api/wiki/…/history` is the
 * documented way to confirm a direct-DB script write landed, and those scripts
 * insert revisions without revalidating the `wiki` tag.
 */
export async function loadPageHistory(tagPath: string, slug: string) {
  const page = await prisma.page.findUnique({
    where: { tagPath_slug: { tagPath, slug } },
    select: { id: true, title: true, version: true },
  });
  if (!page) return null;

  const revisions = await prisma.revision.findMany({
    where: { pageId: page.id },
    select: {
      id: true, title: true, version: true, changeType: true,
      changes: true, content: true, message: true, createdAt: true,
      author: AUTHOR_SELECT,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Backfill changes for revisions that don't have stored diffs
  const backfilled = revisions.map((rev, i) => {
    if (rev.changes && Array.isArray(rev.changes) && (rev.changes as unknown[]).length > 0) {
      const { content: _, ...rest } = rev;
      return rest;
    }
    const next = revisions[i + 1];
    const newContent = (rev.content as unknown as Block[]) || [];
    const oldContent = next ? (next.content as unknown as Block[]) || [] : [];
    const diff = computeRevisionDiff(
      next?.version ?? null, oldContent, newContent,
      next?.title ?? '', rev.title, null, null,
    );
    const { content: _, ...rest } = rev;
    return { ...rest, changes: diff.changes, changeType: diff.changeType || rev.changeType };
  });

  return { currentVersion: page.version, revisions: backfilled };
}

export const getPageHistory = cached('getPageHistory', loadPageHistory);

// ========== SEARCH ==========

/** The row shape every agent-facing listing returns (MCP search_wiki /
 *  list_pages / get_recent_changes and the plain-GET /api/wiki?q= twin). */
export const SUMMARY_SELECT = { title: true, tagPath: true, slug: true, content: true, updatedAt: true, metadata: true, lastVerifiedAt: true } as const;

/**
 * `query` swaps the opening-line snippet for the passage that matched.
 *
 * `headline` overrides it, and only tier-3 (full-text) rows carry one. Those
 * matched a STEM, so `getMatchSnippet` has no literal substring to find and
 * would silently fall back to the page opening — the infobox. Postgres already
 * knows where the stem matched, so it hands back the passage instead.
 */
/** A single metadata value's ceiling in a listing. Generous for a real one. */
const META_VALUE_MAX = 500;

/**
 * Metadata as a *listing* may carry it: declared keys only, each bounded.
 *
 * `metadata` is a free-form JSON column, and one page had the wiki-sweep
 * routine writing 327 KB of run state into it. Passed straight through, that
 * single row made `list_pages`, `get_recent_changes` and `search_wiki` each
 * answer with roughly 350 KB — around 90k tokens, on the three calls an agent
 * makes before anything else — and published internal operational notes to
 * anonymous MCP callers. The REST twin of the same query came back at 31 KB,
 * so the agent lane alone paid it.
 *
 * Which keys a page shows is a schema question the tag hierarchy already
 * answers, so ask it. The cap is the backstop for a declared key that grows:
 * a projection that trusts the column is the bug that was just fixed.
 */
function listingMetadata(tagPath: string, meta: Record<string, unknown> | null) {
  if (!meta) return null;
  const declared = new Set(getMetadataKeys(tagPath.split('/')).map(k => k.key));
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (!declared.has(key) || value == null) continue;
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    out[key] = text.length > META_VALUE_MAX ? `${text.slice(0, META_VALUE_MAX)}…` : value;
  }
  return Object.keys(out).length ? out : null;
}

export function summarizePage(p: { title: string; tagPath: string; slug: string; content: unknown; updatedAt: Date; metadata?: unknown; lastVerifiedAt?: Date | null }, query?: string, headline?: string) {
  const meta = listingMetadata(p.tagPath, (p.metadata ?? null) as Record<string, unknown> | null);
  return {
    title: p.title,
    url: pageUrl(p.tagPath, p.slug),
    tagPath: p.tagPath,
    slug: p.slug,
    // `ts_headline` runs on the same prose expression `search_tsv` is built from,
    // which strips tags and `&nbsp;` but leaves every other entity encoded, so a raw
    // headline reads back "docs &middot; Related". Decode here rather than in the SQL:
    // that expression has to stay byte-identical to the generated column's, or the
    // literal and full-text tiers disagree about what counts as prose.
    snippet: (headline ? decodeEntities(headline).trim() : '')
      || (query ? getMatchSnippet(p.content, query) : getContentSnippet(p.content)),
    updatedAt: p.updatedAt.toISOString().split('T')[0],
    ...(p.lastVerifiedAt ? { lastVerified: p.lastVerifiedAt.toISOString().split('T')[0] } : {}),
    ...(meta ? { metadata: meta } : {}),
  };
}

export type PageSummary = ReturnType<typeof summarizePage>;

/** Re-order rows to match a ranked id list, dropping ids that no longer resolve. */
export function orderByIds<T extends { id: string }>(rows: T[], ids: string[]): T[] {
  const byId = new Map(rows.map(row => [row.id, row]));
  return ids.map(id => byId.get(id)).filter((row): row is T => row !== undefined);
}

/**
 * Ranked search over titles and page prose, in four tiers.
 *
 *   0  title starts with the term
 *   1  title contains it
 *   2  prose contains it, literally
 *   3  full-text match on `search_tsv` — stems, stopword-stripped, ranked
 *
 * Tiers 0-2 are literal substring matching and are what keeps identifiers,
 * tickers, version strings and decimals working: `XRD` finds 190 pages by
 * substring and only 178 through the dictionary, `0.1` finds 24 against 9,
 * because the english config folds case, discards stopwords, and tokenises
 * numbers its own way. Tier 3 is only ever reached by a query the literal tiers
 * could not answer at all, so it adds recall without displacing anything.
 *
 * What tier 3 buys: `what is a validator` went from 0 hits to 154, `how do I
 * edit a page` from 0 to 20, and `validators` from 79 to 154 (the stemmer finds
 * the singular). `websearch_to_tsquery` also gives quoted phrases and `-negation`
 * for free.
 *
 * What it does NOT buy, so nobody looks for it later: it does not understand the
 * question. `what is a validator` and `what does a validator do` return the
 * identical 154 rows, because both reduce to the lexeme `validator`. That is 43%
 * of the corpus, so ORDERING is the whole product on this tier — hence
 * `ts_rank_cd` with normalisation 32 (`rank/(rank+1)`). Normalisation 2 (divide
 * by document length) was measured and is actively worse: it promotes one-line
 * validator stubs above the Staking article the asker wants.
 *
 * Body matching in tier 2 reads every `text` value at any block depth
 * (`$.**.text`) rather than the raw JSON, so block ids, type discriminators and
 * markup can't score as prose; tags and non-breaking spaces are collapsed so a
 * typed "534 KB" still matches a stored "534&nbsp;KB". `search_tsv` is generated
 * from that same expression, so the two tiers cannot disagree about what counts
 * as prose.
 *
 * Hidden tag paths are article space's back office — the maintenance log quotes
 * every edit ever made, so it would head the body tier on almost any query, and
 * it is measurably the TOP full-text hit for "how do I edit a page". Excluded
 * from tiers 2 and 3 alike; still findable by title.
 *
 * `headline` is set on tier-3 rows only. It has to be: a full-text hit matches a
 * STEM, and `getMatchSnippet` searches for a literal substring, so on a stem-only
 * match it finds nothing and falls back to the page opening — which is the
 * infobox, i.e. exactly the defect the match-windowed snippet was built to fix.
 * Measured share of full-text hits carrying no literal substring: 34% for `fees`,
 * 49% `validators`, 62% `staked`, 93% `governing`. `ts_headline` re-parses the
 * document per row, so it is computed only for the page actually being returned.
 *
 * Returns ranked ids and the unpaginated total — hydrate them with whichever
 * select the caller needs.
 */
export async function searchPageIds(
  query: string,
  { tagPath = null, skip = 0, take = 25 }: { tagPath?: string | null; skip?: number; take?: number } = {},
): Promise<{ ids: string[]; total: number; headlines: Map<string, string> }> {
  const term = query.trim().replace(/[\\%_]/g, char => `\\${char}`);
  if (!term) return { ids: [], total: 0, headlines: new Map() };
  const like = `%${term}%`;

  const rows = await prisma.$queryRaw<{ id: string; rank: number; headline: string | null; total: bigint }[]>`
    WITH q AS (SELECT websearch_to_tsquery('english', ${query.trim()}) AS tsq),
    matched AS (
      SELECT p.id, p.title, p.updated_at, p.content, q.tsq,
             CASE WHEN p.title ILIKE ${`${term}%`} THEN 0
                  WHEN p.title ILIKE ${like} THEN 1
                  WHEN p.tag_path <> ALL(${HIDDEN_TAG_PATHS}::text[])
                   AND regexp_replace(translate(jsonb_path_query_array(p.content, '$.**.text')::text, chr(160), ' '),
                                      '<[^>]*>|&nbsp;', ' ', 'g') ILIKE ${like} THEN 2
                  ELSE 3 END AS rank,
             ts_rank_cd(p.search_tsv, q.tsq, 32) AS fts_rank
        FROM pages p CROSS JOIN q
       WHERE p.tag_path <> ''
         AND (${tagPath}::text IS NULL OR p.tag_path = ${tagPath})
         AND (p.title ILIKE ${like}
              OR (p.tag_path <> ALL(${HIDDEN_TAG_PATHS}::text[])
                  AND (regexp_replace(translate(jsonb_path_query_array(p.content, '$.**.text')::text, chr(160), ' '),
                                      '<[^>]*>|&nbsp;', ' ', 'g') ILIKE ${like}
                       OR (q.tsq IS NOT NULL AND p.search_tsv @@ q.tsq))))
    ),
    paged AS (
      SELECT id, rank, content, tsq, count(*) OVER () AS total
        FROM matched
       ORDER BY rank,
                CASE WHEN rank = 0 THEN title END,
                CASE WHEN rank = 3 THEN fts_rank END DESC,
                updated_at DESC
       LIMIT ${take} OFFSET ${skip}
    )
    SELECT id, rank, total,
           CASE WHEN rank = 3 THEN ts_headline('english',
                  regexp_replace(translate(jsonb_path_query_array(content, '$.**.text')::text, chr(160), ' '),
                                 '<[^>]*>|&nbsp;', ' ', 'g'),
                  tsq, 'MaxWords=32, MinWords=16, ShortWord=3, MaxFragments=1, StartSel="", StopSel=""')
                END AS headline
      FROM paged
  `;

  return {
    ids: rows.map(row => row.id),
    total: Number(rows[0]?.total ?? 0),
    headlines: new Map(rows.filter(r => r.headline).map(r => [r.id, r.headline as string])),
  };
}

// ========== BLOCK DATA RESOLUTION ==========

const getRecentPages = cached('getRecentPages',
  async (tagPath: string | undefined, limit: number) => (await prisma.page.findMany({
    where: tagPath ? { tagPath } : undefined,
    select: PAGE_LIST_SELECT,
    orderBy: { updatedAt: 'desc' },
    take: limit,
  })).map(listRow),
);

const getPagesByIds = cached('getPagesByIds',
  async (ids: string[]) => {
    if (!ids.length) return [];
    const pages = (await prisma.page.findMany({ where: { id: { in: ids } }, select: PAGE_LIST_SELECT })).map(listRow);
    return orderByIds(pages, ids);
  },
);

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

/** Pre-resolve recentPages, pageList, and rssFeed blocks server-side to avoid client waterfalls. */
export async function resolveBlockData(blocks: Block[]): Promise<Block[]> {
  const recentPending: { block: RecentPagesBlock; promise: Promise<any[]> }[] = [];
  const listPending: { block: PageListBlock; promise: Promise<any[]> }[] = [];
  const feedPending: { block: RssFeedBlock; promise: Promise<any[]> }[] = [];

  function collect(list: (Block | import('@/types/blocks').AtomicBlock)[]) {
    for (const b of list) {
      if (b.type === 'recentPages') recentPending.push({ block: b, promise: getRecentPages(b.tagPath, b.limit) });
      else if (b.type === 'pageList') listPending.push({ block: b as PageListBlock, promise: getPagesByIds((b as PageListBlock).pageIds) });
      else if (b.type === 'rssFeed') feedPending.push({ block: b as RssFeedBlock, promise: getFeedItems((b as RssFeedBlock).url, (b as RssFeedBlock).limit || 20) });
      else if (b.type === 'columns') for (const col of (b as ColumnsBlock).columns) collect(col.blocks);
      else if (b.type === 'infobox') collect((b as import('@/types/blocks').InfoboxBlock).blocks);
    }
  }

  collect(blocks);
  if (!recentPending.length && !listPending.length && !feedPending.length) return blocks;

  const [recentResults, listResults, feedResults] = await Promise.all([
    Promise.all(recentPending.map(p => p.promise)),
    Promise.all(listPending.map(p => p.promise)),
    Promise.all(feedPending.map(p => p.promise)),
  ]);
  recentPending.forEach((p, i) => { p.block.resolvedPages = recentResults[i]; });
  listPending.forEach((p, i) => { p.block.resolvedPages = listResults[i]; });
  feedPending.forEach((p, i) => { p.block.resolvedItems = feedResults[i]; });
  return blocks;
}
