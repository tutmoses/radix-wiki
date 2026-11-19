// src/components/NewsTicker.tsx

import Link from 'next/link';
import type { NewsItem } from '@/lib/news';

/** Characters past the reader each second: about 55px of 14px Inter, slower than they are read. */
const PACE = 8;

function TickerItem({ item }: { item: NewsItem }) {
  const body = <>{item.lead && <strong>{item.lead}</strong>} {item.text}</>;
  return (
    <li className="news-ticker-item" data-pinned={item.pinned || undefined}>
      {/* Not prefetched: the loop holds a dozen pages, twice. */}
      {item.href?.startsWith('/') ? <Link href={item.href} prefetch={false}>{body}</Link>
        : item.href ? <a href={item.href} target="_blank" rel="noopener">{body}</a>
        : <span>{body}</span>}
    </li>
  );
}

/**
 * Latest News as one line under the homepage banner. The track holds the list
 * twice and slides left by one copy, so the loop has no seam; the second copy is
 * for the eye only. The loop's time follows its text, so every list passes at
 * one pace.
 */
export function NewsTicker({ items }: { items: NewsItem[] }) {
  if (!items.length) return null;
  const seconds = Math.round(items.reduce((n, item) => n + item.lead.length + item.text.length + 6, 0) / PACE);
  const copy = (hidden: boolean) => (
    <ul className="news-ticker-list" aria-hidden={hidden || undefined} inert={hidden}>
      {items.map((item, i) => <TickerItem key={i} item={item} />)}
    </ul>
  );
  return (
    <section className="news-ticker" aria-labelledby="latest-news">
      <h2 id="latest-news" className="news-ticker-label">Latest News</h2>
      <div className="news-ticker-view">
        <div className="news-ticker-track" style={{ animationDuration: `${seconds}s` }}>
          {copy(false)}
          {copy(true)}
        </div>
      </div>
    </section>
  );
}
