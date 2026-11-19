// src/lib/news.ts — the homepage's Latest News, read out of the block that stores it.

import { describe } from 'wiki-formant/metadata';
import type { Block } from '@/types/blocks';

export interface NewsItem {
  /** The bold opening: a dated item's day, a pinned one's topic. Empty on the closing line. */
  lead: string;
  /** What follows the lead, as plain text. */
  text: string;
  /** The item's own page: the last wiki link it makes, else its first link out. */
  href?: string;
  /** In the pinned list: a condition that still holds, rather than a day's event. */
  pinned: boolean;
}

/** The stored section's heading. The block that carries it is the news; the ticker's own heading takes the id. */
const HEADING = /<h2[^>]*id="latest-news"[^>]*>[\s\S]*?<\/h2>/;
/** The ticker shows this much of an item, cut on a sentence where one ends in time. */
const HEADLINE = 110;
const hrefs = (html: string) => [...html.matchAll(/<a\s[^>]*?href="([^"]+)"/g)].map(m => m[1] ?? '');

function newsItem(html: string, pinned: boolean): NewsItem {
  const [opening = '', lead = ''] = html.match(/^\s*(?:<p[^>]*>)?\s*<strong>([\s\S]*?)<\/strong>/) ?? [];
  const links = hrefs(html);
  return {
    lead: describe(lead, Infinity),
    text: describe(html.slice(opening.length), Infinity),
    href: links.filter(h => h.startsWith('/')).at(-1) ?? links[0],
    pinned,
  };
}

/**
 * A homepage's blocks as its news and everything else. The news block holds a
 * pinned list, a dated list after it, and a closing paragraph; with one list,
 * every item is dated.
 */
export function splitNews(content: Block[]): { items: NewsItem[]; closing?: NewsItem; blocks: Block[] } {
  const block = content.find(b => b.type === 'content' && HEADING.test(b.text || ''));
  if (block?.type !== 'content') return { items: [], blocks: content };
  const section = (block.text || '').replace(HEADING, '');
  const lists = [...section.matchAll(/<ul[^>]*>([\s\S]*?)<\/ul>/g)].map(m => m[1] ?? '');
  const items = lists.flatMap((list, i) =>
    [...list.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map(m => newsItem(m[1] ?? '', i < lists.length - 1)));
  const closing = section.replace(/<ul[\s\S]*?<\/ul>/g, '').match(/<p[^>]*>([\s\S]*?)<\/p>/)?.[1];
  return { items, ...(closing && { closing: newsItem(closing, false) }), blocks: content.filter(b => b !== block) };
}

/** An item as the ticker carries it: its text cut to a headline. */
export const headline = (item: NewsItem): NewsItem => ({ ...item, text: describe(item.text, HEADLINE) });
