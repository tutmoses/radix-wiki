// src/lib/utils.ts

import type { CSSProperties } from 'react';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { openingText } from 'wiki-formant/text';
import { describe } from 'wiki-formant/metadata';
import { hashStr, seededRandom } from 'wiki-formant/seeded';
import { SITE_URL } from '@/lib/site';
import { ROOT_ADDRESS } from '@/lib/static-pages';
import type { ConflictReason } from 'wiki-formant/store';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * A declared label as prose — "Blog" from "✍️ Blog", "In Progress" from
 * "🔵 In Progress". One rule for tag names and `select` option values alike:
 * both prefixes are the same convention, a decoration the schema carries that no
 * heading, badge, JSON-LD field or MCP row wants.
 *
 * The class is "everything up to the first letter or digit", not "the leading
 * emoji": ✍️ and ⚖️ are text-default codepoints wearing a variation
 * selector, so an emoji test misses them, and the ideas board's priorities
 * ("㆔ High", "㆓ Medium") are Unicode numerals, so \p{N} misses those.
 */
export const categoryLabel = (name?: string): string =>
  (name ?? '').replace(/^[^\p{Lu}\p{Ll}\p{Nd}]+/u, '').trim();

export function shortenAddress(address: string, chars: number = 6): string {
  return address.length <= chars * 2 ? address : `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * A page's URL path. Two rows carry an empty slug — the homepage and a category's
 * hub article — and both live at the path their tag path already names, so the
 * segments are joined rather than interpolated with a slash that has nothing after it.
 */
export function pagePath(tagPath: string, slug: string): string {
  const path = [tagPath, slug].filter(Boolean).join('/');
  return `/${ROOT_ADDRESS.get(path) ?? path}`;
}

/** The one absolute URL for a page. Every export that advertises a page URL
 *  (llms.txt family, MCP rows, sitemap, blog.xml) goes through here. */
export function pageUrl(tagPath: string, slug: string): string {
  return `${SITE_URL}${pagePath(tagPath, slug)}`;
}

/** A JSON body sent from the browser to one of the wiki's own routes. */
export const sendJson = (url: string, method: 'POST' | 'PUT' | 'PATCH', body: unknown) =>
  fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

/**
 * A refused save that only a reload fixes: the store's 409 for a page that moved
 * on (`stale`) or went (`deleted`), read from the reason its body names. `taken`
 * is fixed in place by picking another slug. Both editors and the MCP write
 * tools read a refusal through this, so none of them guesses it.
 */
const RELOAD_REASONS: readonly ConflictReason[] = ['stale', 'deleted'];
export const mustReload = (status: number, body: { conflict?: unknown } | null | undefined): boolean =>
  status === 409 && RELOAD_REASONS.includes(body?.conflict as ConflictReason);

// ========== CONTENT SNIPPET ==========

/** The description a page publishes: the excerpt an editor wrote, else the opening
 *  content block. The meta description and the Article JSON-LD both read this, so
 *  a page cannot describe itself two ways. */
export function pageDescription(page: { metadata?: unknown; content?: unknown } | null | undefined): string {
  const excerpt = (page?.metadata as Record<string, unknown> | null | undefined)?.excerpt;
  return describe((typeof excerpt === 'string' && excerpt) || openingText(page?.content));
}

// ========== GENERATIVE BANNER ==========
// [dark base, mid accent, bright accent]
const CATEGORY_PALETTES: Record<string, [string, string, string]> = {
  'contents/tech':    ['#1e1b4b', '#4f46e5', '#818cf8'], // indigo
  'developers':       ['#052e16', '#059669', '#6ee7b7'], // emerald
  'ecosystem':        ['#451a03', '#d97706', '#fcd34d'], // amber
  'blog':             ['#450a0a', '#dc2626', '#fca5a5'], // red
  'contents/history': ['#2e1065', '#7c3aed', '#c4b5fd'], // purple
  'ideas':            ['#083344', '#0891b2', '#67e8f9'], // cyan
};
const DEFAULT_PALETTE: [string, string, string] = ['#3b1520', '#c06a73', '#ff9da0'];

/** [dark base, mid accent, bright accent] for a tag path, falling back to the default palette. */
export function paletteFor(tagPath: string): [string, string, string] {
  return Object.entries(CATEGORY_PALETTES).find(([k]) => tagPath.startsWith(k))?.[1] ?? DEFAULT_PALETTE;
}

/** A category's palette as the custom properties `wiki-formant/banner` draws its art in: the gradient from the dark base to the mid accent at 60%, the shapes in the two accents. */
export function bannerPalette(tagPath: string): CSSProperties {
  const [base, mid, bright] = paletteFor(tagPath);
  return { '--banner-from': base, '--banner-to': `${mid}99`, '--banner-mid': mid, '--banner-ink': bright } as CSSProperties;
}

// ========== IDENTICON ==========

export function generateIdenticon(address: string): { cells: boolean[]; fg: string; bg: string } {
  const h = hashStr(address);
  const cells: boolean[] = [];
  for (let i = 0; i < 15; i++) cells.push(((h >> (i % 30)) & 1) === 1);
  const rand = seededRandom(h);
  const hue = Math.floor(rand() * 360);
  return { cells, fg: `hsl(${hue}, 65%, 65%)`, bg: `hsl(${hue}, 25%, 20%)` };
}

const RADIX_ACCOUNT_RE = /^account_(rdx|tdx_2_)1[a-z0-9]{50,}$/;

/** The tip-jar address, trimmed and checked; shared by the block view and its editor. */
export function tipAddress(raw: string | undefined) {
  const address = (raw || '').trim();
  return { address, isValid: RADIX_ACCOUNT_RE.test(address) };
}
