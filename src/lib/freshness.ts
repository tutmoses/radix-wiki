// src/lib/freshness.ts — the stale-page notice, as a block this wiki renders.
//
// The staleness rule is `wiki-formant/freshness`, shared with caper. What stays
// here is turning a verdict into this repo's BannerBlock.
//
// `nowMs` is threaded in from a server component rather than read here. This
// used to call Date.now() during a 'use client' render, so a page sitting near
// the 180-day boundary could be stale on the server and fresh in the browser —
// a hydration mismatch. caper had already fixed this; adopting its signature is
// how the fix arrives here.

import { freshnessNotice, isStale, type FreshnessInput } from 'wiki-formant/freshness';
import type { BannerBlock } from '@/types/blocks';

export { daysSince, isStale, DEFAULT_MAX_AGE_DAYS as FRESHNESS_MAX_AGE_DAYS } from 'wiki-formant/freshness';
export type { FreshnessInput };

/** A synthetic `outdated` banner for a stale page, or null when it is fresh. */
export function freshnessBanner(page: FreshnessInput, nowMs: number): BannerBlock | null {
  if (!isStale(page, nowMs)) return null;
  return {
    id: '__freshness__',
    type: 'banner',
    variant: 'outdated',
    text: freshnessNotice(page),
  };
}
