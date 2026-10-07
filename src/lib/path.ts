// src/lib/path.ts — what a URL path means, with no data access, so the
// client hooks and the server route read it through the same parser.

import { isValidTagPath } from '@/lib/tags';
import { STATIC_PATH_TYPES } from '@/lib/static-pages';

const SUFFIXES = ['edit', 'history', 'mdx'] as const;
type Suffix = typeof SUFFIXES[number];

interface ParsedPath {
  type: 'homepage' | 'category' | 'page' | 'history' | 'edit' | 'mdx' | 'leaderboard' | 'welcome' | 'rewards' | 'search' | 'maintenance' | 'stats' | 'charts' | 'charts-validators' | 'charts-tokens' | 'token-detail' | 'invalid';
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
