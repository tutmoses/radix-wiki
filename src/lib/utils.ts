// src/lib/utils.ts

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://radix.wiki';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

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

export function userProfileSlug(displayName: string | null | undefined, radixAddress: string): string {
  return displayName
    ? displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    : radixAddress.slice(-16).toLowerCase();
}

// ========== CONTENT SNIPPET ==========

const ENTITIES: Record<string, string> = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", mdash: '—', ndash: '–',
};

/** Collapse stored HTML to display text: tags out, common entities in, whitespace normalised. */
function toPlainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(nbsp|amp|lt|gt|quot|#39|mdash|ndash);/g, (_, name) => ENTITIES[name] ?? ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Every `text` value at any block depth — mirrors the `$.**.text` that search matches on. */
function collectText(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) { for (const item of node) collectText(item, out); return out; }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (key === 'text' && typeof value === 'string') out.push(value);
      else collectText(value, out);
    }
  }
  return out;
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

/**
 * Snippet centred on the first occurrence of `query` anywhere in the page, so a search
 * result can show why it matched. Falls back to the page opening when the match is in
 * the title alone.
 */
export function getMatchSnippet(content: unknown, query: string, maxLen = 200): string {
  const term = query.trim();
  if (!term || !Array.isArray(content)) return getContentSnippet(content, maxLen);

  const text = toPlainText(collectText(content).join(' '));
  const at = text.toLowerCase().indexOf(term.toLowerCase());
  if (at === -1) return getContentSnippet(content, maxLen);

  // Keep ~a line of lead-in before the hit, starting at a word boundary.
  let start = Math.max(0, at - 60);
  if (start > 0) {
    const boundary = text.indexOf(' ', start);
    if (boundary > -1 && boundary < at) start = boundary + 1;
  }
  const end = Math.min(text.length, start + maxLen);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trimEnd()}${end < text.length ? '…' : ''}`;
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

export function seededRandom(seed: number): () => number {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; };
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