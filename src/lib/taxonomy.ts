// src/lib/taxonomy.ts — The second axis of category browsing.
//
// `tag_path` puts a page in exactly one place in the tree. Its `select`-type
// metadata (ecosystem's `category`/`status`) is a cross-cutting axis that was
// already stored on every page and never surfaced — 141 ecosystem pages rendered
// as one flat grid while the data to split them sat in the JSON column. These
// helpers derive facets from whatever select keys a tag path declares, plus the
// alphabetical index a category needs once it outgrows a screen of cards, and
// the shared-facet ranking that makes "See also" mean something.

import { getMetadataKeys, type MetadataKeyDefinition } from '@/lib/tags';
import type { WikiPage } from '@/types';

/** Below this a category fits on a page or two; above it, readers need an index. */
export const ALPHA_INDEX_MIN_PAGES = 40;

export interface FacetValue { value: string; count: number }
export interface Facet { key: string; label: string; values: FacetValue[] }
export type FacetFilters = Record<string, string>;

const metaValue = (page: WikiPage, key: string): string => page.metadata?.[key]?.trim() || '';

/** The select-type metadata keys a tag path declares — its facetable axes. */
export function facetKeys(tagPath: string): MetadataKeyDefinition[] {
  return getMetadataKeys(tagPath.split('/')).filter(k => k.type === 'select');
}

/** Query params narrowed to facets this tag path actually declares. */
export function facetFilters(tagPath: string, params: Record<string, string | string[] | undefined>): FacetFilters {
  const filters: FacetFilters = {};
  for (const key of facetKeys(tagPath)) {
    const value = params[key.key];
    if (typeof value === 'string' && value) filters[key.key] = value;
  }
  return filters;
}

/** Bucket for titles that don't start with a letter (numerals, `$BlueBalls`). */
export function firstLetter(title: string): string {
  const ch = title.trim()[0]?.toUpperCase() ?? '';
  return ch >= 'A' && ch <= 'Z' ? ch : '#';
}

function matches(page: WikiPage, filters: FacetFilters, letter?: string): boolean {
  if (letter && firstLetter(page.title) !== letter) return false;
  return Object.entries(filters).every(([key, value]) => metaValue(page, key) === value);
}

export function filterPages(pages: WikiPage[], filters: FacetFilters, letter?: string): WikiPage[] {
  if (!Object.keys(filters).length && !letter) return pages;
  return pages.filter(p => matches(p, filters, letter));
}

/**
 * Facet values with counts. Each facet is counted over the set narrowed by every
 * *other* active filter, so its own options stay switchable rather than
 * collapsing to the one already chosen.
 */
export function buildFacets(tagPath: string, pages: WikiPage[], filters: FacetFilters, letter?: string): Facet[] {
  return facetKeys(tagPath).flatMap(key => {
    const others = Object.fromEntries(Object.entries(filters).filter(([k]) => k !== key.key));
    const counts = new Map<string, number>();
    for (const page of filterPages(pages, others, letter)) {
      const value = metaValue(page, key.key);
      if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    if (counts.size < 2) return [];
    const values = [...counts].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
    return [{ key: key.key, label: key.label.replace(/:$/, ''), values }];
  });
}

/** A–Z buckets present in the set, `#` last. */
export function alphaIndex(pages: WikiPage[], filters: FacetFilters): FacetValue[] {
  const counts = new Map<string, number>();
  for (const page of filterPages(pages, filters)) {
    const letter = firstLetter(page.title);
    counts.set(letter, (counts.get(letter) ?? 0) + 1);
  }
  return [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => (a.value === '#' ? 1 : b.value === '#' ? -1 : a.value.localeCompare(b.value)));
}

/** The one place the category URL contract lives — every chip, letter and sort button builds through it. */
export function categoryHref(tagPath: string, state: { sort?: string; filters?: FacetFilters; letter?: string }): string {
  const params = new URLSearchParams();
  if (state.sort) params.set('sort', state.sort);
  for (const [key, value] of Object.entries(state.filters ?? {})) params.set(key, value);
  if (state.letter) params.set('letter', state.letter);
  const query = params.toString();
  return `/${tagPath}${query ? `?${query}` : ''}`;
}

/** Adding a filter already active removes it, so every chip is its own off-switch. */
export function toggleFilter(filters: FacetFilters, key: string, value: string): FacetFilters {
  const next = { ...filters };
  if (next[key] === value) delete next[key];
  else next[key] = value;
  return next;
}

export interface RelatedRanking { pages: WikiPage[]; sharedValue: string | null }

/**
 * Siblings ranked by how many facet values they share with the page — a real
 * relatedness signal. The previous behaviour (first five of the category) showed
 * every one of a 141-page category the same five links. Ties keep the category's
 * own sort order, so the tail degrades to that rather than to nothing.
 */
export function rankRelated(page: WikiPage, siblings: WikiPage[], tagPath: string, limit = 5): RelatedRanking {
  const keys = facetKeys(tagPath);
  if (!keys.length) return { pages: siblings.slice(0, limit), sharedValue: null };

  const score = (other: WikiPage) => keys.reduce((n, k) => n + (metaValue(page, k.key) && metaValue(other, k.key) === metaValue(page, k.key) ? 1 : 0), 0);
  const ranked = siblings.map((p, i) => ({ p, score: score(p), i }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, limit);

  // Name the narrowest axis the page shares — `category` (15 options) says more
  // about a project than `status` (4), so headline that rather than the first key.
  const narrowest = keys.filter(k => metaValue(page, k.key)).sort((a, b) => (b.options?.length ?? 0) - (a.options?.length ?? 0))[0];
  const shared = narrowest && ranked[0]?.score ? metaValue(page, narrowest.key) : null;
  return { pages: ranked.map(r => r.p), sharedValue: shared || null };
}
