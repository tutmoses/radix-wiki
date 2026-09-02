// src/lib/utils.ts

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { matchSnippet } from 'wiki-formant/text';
import { decodeEntities } from '@/lib/content';

export const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://radix.wiki';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * A tag node's name as prose — "Blog", not "✍️ Blog". The old
 * `\p{Emoji_Presentation}` test only matched glyphs that default to emoji
 * presentation, so ✍️ and ⚖️ (text-default codepoints wearing a
 * variation selector) survived it and reached headings as "Pages in ✍️ Blog".
 */
export const categoryLabel = (name: string): string =>
  name.replace(/^[\p{Extended_Pictographic}\p{Emoji_Modifier}\uFE0F\u200D]+\s*/u, '');

export function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
}

export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', ...options });
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDate(d);
}

export function shortenAddress(address: string, chars: number = 6): string {
  return address.length <= chars * 2 ? address : `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * A page's URL path. Two rows carry an empty slug — the homepage and a category's
 * hub article — and both live at the path their tag path already names, so the
 * segments are joined rather than interpolated with a slash that has nothing after it.
 */
export function pagePath(tagPath: string, slug: string): string {
  return `/${[tagPath, slug].filter(Boolean).join('/')}`;
}

/** The one absolute URL for a page. Every export that advertises a page URL
 *  (llms.txt family, MCP rows, sitemap, blog.xml) goes through here. */
export function pageUrl(tagPath: string, slug: string): string {
  return `${BASE_URL}${pagePath(tagPath, slug)}`;
}

// ========== CONTENT SNIPPET ==========

/** Collapse stored HTML to display text: tags out, entities decoded, whitespace normalised. */
function toPlainText(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract plain text snippet from page content blocks (skips infobox, strips HTML, truncates) */
export function getContentSnippet(content: unknown, maxLen = 150): string {
  if (!Array.isArray(content)) return '';
  for (const block of content) {
    if (block?.type === 'content' && typeof block.text === 'string') {
      const text = toPlainText(block.text.replace(/<h[1-6][^>]*>.*?<\/h[1-6]>/gi, ''));
      if (!text) continue;
      return text.length > maxLen ? text.slice(0, maxLen).trimEnd() + '…' : text;
    }
  }
  return '';
}

/** Shorten a snippet a list row already carries. List rows ship one 150-char snippet
 *  instead of their article, so the callers that used to ask getContentSnippet for a
 *  tighter cut (the related-pages rail wants 100) re-cut that string rather than the
 *  content it no longer has. */
export function clampSnippet(snippet: string | null | undefined, maxLen: number): string {
  if (!snippet) return '';
  return snippet.length > maxLen ? snippet.slice(0, maxLen).trimEnd() + '…' : snippet;
}

/**
 * Snippet centred on the first occurrence of `query` anywhere in the page, so a search
 * result can show why it matched. Falls back to the page opening when the match is in
 * the title alone.
 *
 * The walk and the clamp are `wiki-formant/text`, shared with caper, which had
 * adopted it first. The shared copy also collapses `&nbsp;` before decoding, which
 * the version that lived here did not — a phrase broken by one read back with the
 * entity still in it. What stays is this wiki's opening, which is the first
 * `content` block rather than the whole page flattened.
 */
export function getMatchSnippet(content: unknown, query: string, maxLen = 200): string {
  return matchSnippet(content, query, () => getContentSnippet(content, maxLen), maxLen);
}

// ========== GENERATIVE BANNER ==========
// [dark base, mid accent, bright accent]
const CATEGORY_PALETTES: Record<string, [string, string, string]> = {
  'contents/tech':    ['#1e1b4b', '#4f46e5', '#818cf8'], // indigo
  'developers':       ['#052e16', '#059669', '#6ee7b7'], // emerald
  'ecosystem':        ['#451a03', '#d97706', '#fcd34d'], // amber
  'community':        ['#500724', '#db2777', '#f9a8d4'], // pink
  'blog':             ['#450a0a', '#dc2626', '#fca5a5'], // red
  'contents/history': ['#2e1065', '#7c3aed', '#c4b5fd'], // purple
  'ideas':            ['#083344', '#0891b2', '#67e8f9'], // cyan
};
const DEFAULT_PALETTE: [string, string, string] = ['#3b1520', '#c06a73', '#ff9da0'];

/** [dark base, mid accent, bright accent] for a tag path, falling back to the default palette. */
export function paletteFor(tagPath: string): [string, string, string] {
  return Object.entries(CATEGORY_PALETTES).find(([k]) => tagPath.startsWith(k))?.[1] ?? DEFAULT_PALETTE;
}

export function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Lehmer/Park-Miller, seeded by an integer, so a title always lays its banner
// out the same way. The two guards are caper's, which had them and this copy did
// not: without the modulo the seed can exceed the modulus, and without the
// `<= 0` correction a seed of 0 sticks the generator at 0 forever — every call
// returns the same number and the banner degenerates to a single point.
export function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

const svgCache = new Map<string, string>();

export function generateBannerSvg(title: string, tagPath: string): string {
  const cacheKey = `${title}:${tagPath}`;
  const cached = svgCache.get(cacheKey);
  if (cached) return cached;

  const palette = paletteFor(tagPath);
  const hash = hashStr(title + tagPath);
  const rand = seededRandom(hash);
  const w = 800, h = 200;

  let svg = '';
  const angle = Math.floor(rand() * 360);
  svg += `<defs><linearGradient id="bg" gradientTransform="rotate(${angle})">`;
  svg += `<stop offset="0%" stop-color="${palette[0]}"/><stop offset="100%" stop-color="${palette[1]}" stop-opacity="0.6"/>`;
  svg += `</linearGradient></defs>`;
  svg += `<rect width="${w}" height="${h}" fill="url(#bg)"/>`;

  // Large soft background blobs
  for (let i = 0; i < 3; i++) {
    const cx = rand() * w, cy = rand() * h, r = 60 + rand() * 120;
    svg += `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r.toFixed(0)}" fill="${palette[1]}" opacity="${(0.15 + rand() * 0.2).toFixed(2)}"/>`;
  }

  // Mid-layer geometric shapes
  const count = 5 + Math.floor(rand() * 4);
  for (let i = 0; i < count; i++) {
    const x = rand() * w, y = rand() * h;
    const color = i % 2 === 0 ? palette[2] : palette[1];
    const opacity = 0.12 + rand() * 0.25;
    const kind = Math.floor(rand() * 4);
    if (kind === 0) {
      const r = 8 + rand() * 40;
      svg += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(0)}" fill="${color}" opacity="${opacity.toFixed(2)}"/>`;
    } else if (kind === 1) {
      const rw = 20 + rand() * 80, rh = 15 + rand() * 50, rx = rand() * 12;
      svg += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${rw.toFixed(0)}" height="${rh.toFixed(0)}" rx="${rx.toFixed(0)}" fill="${color}" opacity="${opacity.toFixed(2)}" transform="rotate(${(rand() * 60 - 30).toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)})"/>`;
    } else if (kind === 2) {
      const s = 15 + rand() * 35;
      const pts = Array.from({ length: 3 }, () => `${(x + rand() * s * 2 - s).toFixed(0)},${(y + rand() * s * 2 - s).toFixed(0)}`).join(' ');
      svg += `<polygon points="${pts}" fill="${color}" opacity="${opacity.toFixed(2)}"/>`;
    } else {
      // Ring / donut
      const r = 12 + rand() * 30;
      svg += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(0)}" fill="none" stroke="${color}" stroke-width="${(2 + rand() * 4).toFixed(1)}" opacity="${opacity.toFixed(2)}"/>`;
    }
  }

  // Bright small accent dots
  for (let i = 0; i < 4; i++) {
    const x = rand() * w, y = rand() * h, r = 2 + rand() * 6;
    svg += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(0)}" fill="${palette[2]}" opacity="${(0.4 + rand() * 0.4).toFixed(2)}"/>`;
  }

  const result = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${svg}</svg>`)}`;
  svgCache.set(cacheKey, result);
  return result;
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