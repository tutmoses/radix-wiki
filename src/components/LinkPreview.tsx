// src/components/LinkPreview.tsx — Wikipedia-style hover cards for internal
// links. Delegated hover listener on the article prose; on a sustained hover of
// an internal article link it fetches a lead-paragraph preview and floats a card
// near the link. Results are cached per path; the card stays open while the
// cursor moves into it.

'use client';

import { useEffect, useRef, useState } from 'react';

type Preview = { found: boolean; title?: string; excerpt?: string; bannerImage?: string | null };

// Non-article top-level routes that would never resolve to a page preview.
const SKIP_PREFIX = new Set(['charts', 'search', 'leaderboard', 'welcome', 'rewards']);

const CARD_W = 320;
const CARD_H = 240;

export function LinkPreview() {
  const [card, setCard] = useState<{ data: Preview; left: number; top: number; above: boolean } | null>(null);
  const cache = useRef(new Map<string, Preview>());
  const showTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const activeHref = useRef<string | null>(null);

  useEffect(() => {
    const clearTimers = () => { clearTimeout(showTimer.current); clearTimeout(hideTimer.current); };

    const eligible = (a: HTMLAnchorElement | null): a is HTMLAnchorElement => {
      if (!a || !a.closest('.prose-content')) return false;
      const href = a.getAttribute('href') || '';
      if (!href.startsWith('/')) return false;
      const segs = href.replace(/[#?].*$/, '').split('/').filter(Boolean);
      return segs.length >= 2 && !SKIP_PREFIX.has(segs[0]!);
    };

    const onOver = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest('a') as HTMLAnchorElement | null;
      if (!eligible(a)) return;
      const href = a.getAttribute('href')!.replace(/[#?].*$/, '');
      if (activeHref.current === href) { clearTimeout(hideTimer.current); return; }
      clearTimers();
      activeHref.current = href;
      showTimer.current = setTimeout(async () => {
        let data = cache.current.get(href);
        if (!data) {
          try {
            const res = await fetch(`/api/wiki/preview?path=${encodeURIComponent(href.replace(/^\//, ''))}`);
            data = res.ok ? await res.json() : { found: false };
          } catch { data = { found: false }; }
          cache.current.set(href, data!);
        }
        if (activeHref.current !== href || !data?.found) return;
        const rect = a.getBoundingClientRect();
        const above = rect.bottom + CARD_H > window.innerHeight && rect.top > CARD_H;
        setCard({
          data,
          left: Math.max(8, Math.min(rect.left, window.innerWidth - CARD_W - 8)),
          top: above ? rect.top - 8 : rect.bottom + 8,
          above,
        });
      }, 350);
    };

    const onOut = (e: MouseEvent) => {
      const related = e.relatedTarget as HTMLElement | null;
      if (related?.closest('.link-preview-card')) return; // cursor moving into the card
      clearTimers();
      hideTimer.current = setTimeout(() => { activeHref.current = null; setCard(null); }, 200);
    };

    document.addEventListener('mouseover', onOver);
    document.addEventListener('mouseout', onOut);
    return () => {
      clearTimers();
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseout', onOut);
    };
  }, []);

  if (!card) return null;

  const keepOpen = () => clearTimeout(hideTimer.current);
  const scheduleHide = () => { hideTimer.current = setTimeout(() => { activeHref.current = null; setCard(null); }, 200); };

  return (
    <div
      className="link-preview-card"
      style={{ left: card.left, top: card.top, transform: card.above ? 'translateY(-100%)' : undefined }}
      onMouseEnter={keepOpen}
      onMouseLeave={scheduleHide}
    >
      {card.data.bannerImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.data.bannerImage} alt="" className="link-preview-banner" loading="lazy" />
      )}
      <div className="link-preview-body">
        <div className="link-preview-title">{card.data.title}</div>
        {card.data.excerpt && <p className="link-preview-excerpt">{card.data.excerpt}</p>}
      </div>
    </div>
  );
}

export default LinkPreview;
