// src/lib/feed.ts — the block walk behind `content:encoded`.
//
// The channel, the item skeleton, the XML escaping and the headers are
// `wiki-formant/feed`, shared with the other two wikis, which had written the
// same 47 of 64 lines — including, verbatim, the comment explaining why the
// apostrophe escapes numerically.
//
// What stays here is the walk: a switch over this repo's block union, where a
// new block type is a compile error until it is handled.
//
// One behaviour changes in adopting it. `lastBuildDate` now comes from the
// newest item rather than `new Date()`, which this file stamped on every
// request — telling every poller the feed had changed when it had not.

import type { Block, AtomicBlock } from '@/types/blocks';
import { BASE_URL } from '@/lib/utils';
import { absolutise as absolutiseFrom, escXml } from 'wiki-formant/feed';

export {
  cdata,
  clampWords,
  escXml,
  FEED_HEADERS,
  renderFeed,
  renderItem,
  type FeedChannel,
  type FeedItem,
} from 'wiki-formant/feed';

/** Blog posts carry a `metadata.date` ("2026-08-02" or "2026/03/15"); fall back to the row's createdAt. */
export function publishedAt(metadata: unknown, createdAt: Date): Date {
  const raw = (metadata as Record<string, string> | null)?.date?.replace(/\//g, '-');
  const parsed = raw ? new Date(raw) : null;
  return parsed && !isNaN(parsed.getTime()) ? parsed : createdAt;
}

const absolutise = (html: string) => absolutiseFrom(html, BASE_URL);

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
