// src/components/NewsTicker.tsx

import Link from 'next/link';
import type { NewsItem } from '@/lib/news';

/** The loop's pace, in px a second, and the width a character of 14px Inter averages. */
const SPEED = 100;
const CHAR = 7;

function TickerItem({ item }: { item: NewsItem }) {
  const body = <>{item.lead && <strong>{item.lead}</strong>} {item.text}</>;
  return (
    <li className="news-ticker-item">
      {/* Not prefetched: the loop holds a dozen pages, twice. */}
      {item.href?.startsWith('/') ? <Link href={item.href} prefetch={false}>{body}</Link>
        : item.href ? <a href={item.href} target="_blank" rel="noopener">{body}</a>
        : <span>{body}</span>}
    </li>
  );
}

/**
 * Latest News as one line under a page's banner. The track holds the list
 * twice and slides left by one copy, so the loop has no seam; the second copy is
 * for the eye only. The loop's time follows its text, so every list passes at
 * one pace. Site chrome rather than a section of the page it runs on, so its
 * label is no heading; the homepage, where the news is stored, passes the id
 * its `#latest-news` links land on.
 */
export function NewsTicker({ items, id }: { items: NewsItem[]; id?: string }) {
  if (!items.length) return null;
  const seconds = Math.round(items.reduce((n, item) => n + item.lead.length + item.text.length + 6, 0) * CHAR / SPEED);
  const copy = (hidden: boolean) => (
    <ul className="news-ticker-list" aria-hidden={hidden || undefined} inert={hidden}>
      {items.map((item, i) => <TickerItem key={i} item={item} />)}
    </ul>
  );
  return (
    <aside id={id} className="news-ticker" aria-label="Latest News">
      <span className="news-ticker-label" aria-hidden>Latest News</span>
      <div className="news-ticker-view">
        <div className="news-ticker-track" style={{ animationDuration: `${seconds}s` }}>
          {copy(false)}
          {copy(true)}
        </div>
      </div>
    </aside>
  );
}
