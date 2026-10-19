// src/lib/path.ts — what a URL path means, with no data access, so the
// client hooks and the server route read it through the same parser.

import { parseWikiPath, isReservedSlug as reservedIn } from 'wiki-formant/tree';
import { TAG_TREE as TREE } from '@/lib/tags';
import { STATIC_PATH_TYPES } from '@/lib/static-pages';

const SUFFIXES = ['edit', 'history', 'mdx'] as const;
type Suffix = typeof SUFFIXES[number];

/**
 * A slug no page in `tagPath` can hold, because `parsePath` reads that URL as
 * something else: a mode suffix (`/blog/history` is the blog's history) or a
 * child category. Page creation treats it as taken.
 */
export const isReservedSlug = (tagPath: string, slug: string): boolean => reservedIn(TREE, tagPath, slug, SUFFIXES);

interface ParsedPath {
  type: 'homepage' | 'category' | 'page' | 'history' | 'edit' | 'mdx' | 'leaderboard' | 'search' | 'maintenance' | 'stats' | 'settings' | 'charts' | 'charts-validators' | 'charts-tokens' | 'token-detail' | 'invalid';
  tagPath: string;
  slug: string;
  suffix: Suffix | null;
  tokenAddress?: string;
}

/**
 * The wiki half is `wiki-formant/tree`'s `parseWikiPath`; what stays here is
 * this wiki's static pages, its /charts tree, and the API's refusal of /edit.
 * A category's `/history` and `/mdx` address its hub article, the empty slug.
 */
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

  const parsed = parseWikiPath(TREE, segments, { modes: SUFFIXES });
  const suffix = parsed.mode;
  if (parsed.type === 'invalid' || (mode === 'api' && suffix === 'edit')) return { ...base, type: 'invalid' };
  const { tagPath, slug } = parsed;
  if (parsed.type === 'home') return { ...base, type: suffix ?? 'homepage', suffix };
  // The client opens a category's editor on the category page itself.
  if (parsed.type === 'category') return { type: !suffix || suffix === 'edit' ? 'category' : suffix, tagPath, slug: '', suffix };
  return { type: suffix ?? 'page', tagPath, slug, suffix };
}
