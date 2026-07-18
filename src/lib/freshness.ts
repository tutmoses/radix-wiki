// src/lib/freshness.ts — Freshness (the crypto-native extension of verifiability).
// A page is "fresh" if its facts were verified recently. Crypto facts decay fast,
// so a page not re-checked within FRESHNESS_MAX_AGE_DAYS gets a synthetic
// `outdated` notice atop the article until an editor (or the maintenance sweep,
// via scripts/mark-verified.mjs) re-verifies it and stamps `lastVerifiedAt`.

import type { BannerBlock } from '@/types/blocks';

export const FRESHNESS_MAX_AGE_DAYS = 180;
const DAY_MS = 86_400_000;

type FreshnessInput = { lastVerifiedAt?: Date | string | null; updatedAt: Date | string };

export function daysSince(date: Date | string | null | undefined): number | null {
  if (!date) return null;
  const t = new Date(date).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / DAY_MS);
}

// Stale when the last verification — or, if never verified, the last edit — is
// older than the threshold.
export function isStale(page: FreshnessInput): boolean {
  const age = daysSince(page.lastVerifiedAt ?? page.updatedAt);
  return age !== null && age > FRESHNESS_MAX_AGE_DAYS;
}

// A synthetic `outdated` banner for stale pages, distinct from an author-placed
// banner block (fixed id so React keys stay stable across renders).
export function freshnessBanner(page: FreshnessInput): BannerBlock | null {
  if (!isStale(page)) return null;
  const when = page.lastVerifiedAt
    ? `last verified ${new Date(page.lastVerifiedAt).toISOString().slice(0, 10)}`
    : 'not yet verified against sources';
  return {
    id: '__freshness__',
    type: 'banner',
    variant: 'outdated',
    text: `This page was ${when} and may be out of date. Please help re-check its facts against current sources and the live ledger.`,
  };
}
