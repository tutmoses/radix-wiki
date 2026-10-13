// src/components/charts/EntityIcon.tsx – a token's or validator's icon, or its initial
//
// Icons are whatever URL an issuer put in its metadata, and five of the /charts top
// twenty were dead in October 2026: their alt text spilled across the name beside them.
// The name is always printed next to the icon, so the image is decorative (alt="") and a
// missing or broken one falls back to the name's first letter.

'use client';

import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

export function EntityIcon({ src, name, large }: { src?: string; name: string; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  // An image that failed before hydration fired its error event before React listened,
  // so the element is checked as it attaches.
  const attach = (el: HTMLImageElement | null) => {
    if (el?.complete && el.naturalWidth === 0) setFailed(true);
  };

  if (!src || failed) {
    return <span className={cn('entity-icon entity-icon-fallback', large && 'entity-icon-lg')} aria-hidden>{[...name.trim()][0] ?? '?'}</span>;
  }
  const size = large ? 48 : 20;
  return <Image ref={attach} src={src} alt="" width={size} height={size} className={cn('entity-icon', large && 'entity-icon-lg')} unoptimized onError={() => setFailed(true)} />;
}
