// src/lib/feed.ts — RSS plumbing shared by /blog.xml and /week-in-review.xml
//
// Both feeds ship the whole article in `content:encoded`, not a 150-char teaser.
// Full-text RSS is the cheapest distribution this site has: it is what lets a
// reader-to-email bridge, an aggregator or another newsletter carry an issue
// without us running a mail server. A description-only feed cannot be mirrored,
// only linked, which is why the series had no reach outside its own tweet.

import type { Block, AtomicBlock } from '@/types/blocks';
import { BASE_URL } from '@/lib/utils';

// Numeric reference for the apostrophe: some readers' entity tables lack `&apos;`
const XML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escXml = (s: string) => s.replace(/[&<>"']/g, c => XML_ESCAPES[c]!);

/** `content:encoded` carries raw HTML, so it has to travel inside CDATA. A literal
 *  `]]>` in the body would close the section early and corrupt the rest of the feed. */
export const cdata = (html: string) => `<![CDATA[${html.replace(/]]>/g, ']]&gt;')}]]>`;

/** Aggregators hard-truncate descriptions at 150 chars — trim on a word boundary so they never cut mid-word. */
export function clampWords(s: string, max = 150): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:–-]$/, '');
}

/** Blog posts carry a `metadata.date` ("2026-08-02" or "2026/03/15"); fall back to the row's createdAt. */
export function publishedAt(metadata: unknown, createdAt: Date): Date {
  const raw = (metadata as Record<string, string> | null)?.date?.replace(/\//g, '-');
  const parsed = raw ? new Date(raw) : null;
  return parsed && !isNaN(parsed.getTime()) ? parsed : createdAt;
}

/** Relative hrefs and srcs are meaningless once an item is syndicated, so every
 *  internal link is absolutised on the way out. Protocol-relative and anchor-only
 *  targets are left alone. */
function absolutise(html: string): string {
  return html.replace(/\s(href|src)="\/(?!\/)([^"]*)"/gi, (_m, attr, path) => ` ${attr}="${BASE_URL}/${path}"`);
}

function renderAtomic(block: AtomicBlock): string {
  switch (block.type) {
    case 'content':
      return block.text ?? '';
    case 'references': {
      const items = (block.items ?? []).map(i =>
        `<li>${i.text}${i.url ? ` <a href="${escXml(i.url)}" rel="noopener">↗</a>` : ''}</li>`).join('');
      return items ? `<h2>${escXml(block.title || 'References')}</h2><ol>${items}</ol>` : '';
    }
    case 'linkGrid': {
      const groups = (block.groups ?? []).map(g => {
        const links = (g.links ?? []).map(l => `<li><a href="${escXml(l.href)}" rel="noopener">${escXml(l.label)}</a></li>`).join('');
        return `<h3>${escXml(g.heading)}</h3>${g.description ? `<p>${escXml(g.description)}</p>` : ''}<ul>${links}</ul>`;
      }).join('');
      return `${block.intro ? `<p>${escXml(block.intro)}</p>` : ''}${groups}`;
    }
    case 'stats': {
      const rows = (block.items ?? []).map(i =>
        `<tr><th scope="row">${escXml(i.label)}</th><td>${escXml(i.value)}${i.suffix ? ` ${escXml(i.suffix)}` : ''}</td></tr>`).join('');
      return rows ? `<table>${rows}</table>` : '';
    }
    case 'testimonial':
      return `<blockquote><p>${escXml(block.quote)}</p><footer>${escXml(block.author)}${block.role ? `, ${escXml(block.role)}` : ''}</footer></blockquote>`;
    case 'codeTabs':
      return (block.tabs ?? []).map(t => `<pre><code>${escXml(t.code)}</code></pre>`).join('');
    case 'banner':
      return block.text ? `<p><em>${escXml(block.text)}</em></p>` : '';
    // pageList / recentPages / rssFeed resolve their rows at render time and carry
    // none in the stored block, so a feed built straight off the DB has nothing to show.
    default:
      return '';
  }
}

/** The stored blocks as one HTML string, for `content:encoded`. */
export function blocksToFeedHtml(content: unknown): string {
  if (!Array.isArray(content)) return '';
  const html = (content as Block[]).map(block => {
    if (block.type === 'infobox') return block.blocks.map(renderAtomic).join('');
    if (block.type === 'columns') return block.columns.flatMap(c => c.blocks.map(renderAtomic)).join('');
    return renderAtomic(block as AtomicBlock);
  }).join('\n');
  return absolutise(html);
}

export type FeedItem = {
  title: string;
  url: string;
  description: string;
  date: Date;
  image?: string;
  html?: string;
  categories?: string[];
};

export function renderItem(item: FeedItem): string {
  return [
    '    <item>',
    `      <title>${escXml(item.title)}</title>`,
    `      <link>${escXml(item.url)}</link>`,
    `      <guid isPermaLink="true">${escXml(item.url)}</guid>`,
    `      <description>${escXml(item.description)}</description>`,
    ...(item.categories ?? []).map(c => `      <category>${escXml(c)}</category>`),
    `      <pubDate>${item.date.toUTCString()}</pubDate>`,
    ...(item.image ? [`      <enclosure url="${escXml(item.image)}" type="image/png" />`] : []),
    ...(item.html ? [`      <content:encoded>${cdata(item.html)}</content:encoded>`] : []),
    '    </item>',
  ].join('\n');
}

export function renderFeed(channel: {
  title: string; link: string; description: string; self: string;
}, items: string[]): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">',
    '  <channel>',
    `    <title>${escXml(channel.title)}</title>`,
    `    <link>${escXml(channel.link)}</link>`,
    `    <description>${escXml(channel.description)}</description>`,
    '    <language>en</language>',
    // Channel-level licence, so the CC BY grant travels with the feed the same
    // way it travels with the plain-text exports.
    '    <copyright>Creative Commons Attribution 4.0 International (CC-BY-4.0): https://creativecommons.org/licenses/by/4.0/</copyright>',
    `    <atom:link href="${escXml(channel.self)}" rel="self" type="application/rss+xml" />`,
    `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
    ...items,
    '  </channel>',
    '</rss>',
  ].join('\n');
}

export const FEED_HEADERS = {
  'Content-Type': 'application/rss+xml; charset=utf-8',
  'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
};
