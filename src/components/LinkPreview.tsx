// src/components/LinkPreview.tsx — Wikipedia-style hover cards for internal links.
//
// The controller is `wiki-formant/react`, shared with the other wikis, which had
// written the same ninety lines: the same 350ms intent delay, the same grace
// period so the cursor can cross the gap into the card, the same viewport-clamp
// arithmetic and the same per-href cache. What stays here is the only part that
// was ever this wiki's — which links are eligible, where a preview comes from,
// and what the card looks like.

'use client';

import { useLinkPreview } from 'wiki-formant/react';

type Preview = { found: boolean; title?: string; excerpt?: string; bannerImage?: string | null };

// Non-article top-level routes that would never resolve to a page preview.
const SKIP_PREFIX = new Set(['charts', 'search', 'leaderboard', 'welcome', 'rewards']);

const eligible = (a: HTMLAnchorElement): boolean => {
  if (!a.closest('.prose-content')) return false;
  const href = a.getAttribute('href') || '';
  if (!href.startsWith('/')) return false;
  const segs = href.replace(/[#?].*$/, '').split('/').filter(Boolean);
  return segs.length >= 2 && !SKIP_PREFIX.has(segs[0]!);
};

const fetchPreview = async (href: string): Promise<Preview | null> => {
  const res = await fetch(`/api/wiki/preview?path=${encodeURIComponent(href.replace(/^\//, ''))}`);
  if (!res.ok) return null;
  const data: Preview = await res.json();
  // `found: false` is a resolved answer, not a card. Returning null tells the
  // controller to cache the miss and never re-ask for this href.
  return data.found ? data : null;
};

export function LinkPreview() {
  const { preview, cardProps } = useLinkPreview<Preview>({ eligible, fetch: fetchPreview });

  if (!preview) return null;

  return (
    <div className="link-preview-card" {...cardProps}>
      {preview.bannerImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview.bannerImage} alt="" className="link-preview-banner" loading="lazy" />
      )}
      <div className="link-preview-body">
        <div className="link-preview-title">{preview.title}</div>
        {preview.excerpt && <p className="link-preview-excerpt">{preview.excerpt}</p>}
      </div>
    </div>
  );
}

export default LinkPreview;
