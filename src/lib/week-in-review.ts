// src/lib/week-in-review.ts — the series' shared vocabulary.
//
// The recap slugs, the issue numbering and the scored prediction record are read
// by the app (feed, page furniture) and written by scripts/week-in-review.mjs.
// They agree because the rules live here and the script mirrors these three
// functions verbatim; both sides are asserted by scripts/wir-lint.mjs.

export const SERIES_SLUG = 'week-in-review';
export const RECAP_PREFIX = 'week-in-review-';

export type PredictionStatus = 'open' | 'hit' | 'miss' | 'void';

export type Prediction = {
  id: string;
  claim: string;
  who: string;
  due: string;
  kind: 'onchain' | 'http' | 'manual';
  check: string;
  status: PredictionStatus;
  recorded: string;
  scored?: string;
  deferrals?: number;
  sourceUrl?: string;
};

export type Throughline = { slug: string; week: string; title: string; standout: string };

export type LedgerState = { predictions?: Prediction[]; throughlines?: Throughline[]; trackingSince?: string };

/** `hit` and `miss` are the only scored outcomes. `void` is a withdrawn claim and
 *  must never flatter the rate by counting as anything but withdrawn. */
export function tally(state: LedgerState | null | undefined) {
  const preds = state?.predictions ?? [];
  const hit = preds.filter(p => p.status === 'hit').length;
  const miss = preds.filter(p => p.status === 'miss').length;
  const open = preds.filter(p => p.status === 'open').length;
  const withdrawn = preds.filter(p => p.status === 'void').length;
  const scored = hit + miss;
  return { hit, miss, open, withdrawn, scored, rate: scored ? Math.round((hit / scored) * 100) : null };
}

export const issueLabel = (n: number) => `Issue #${n}`;

/** One sentence carrying the record. This is the series' only unique number, so it
 *  travels: feed channel, series index infobox, and the foot of every recap. */
export function scoreline(state: LedgerState | null | undefined): string {
  const { hit, scored, open, rate } = tally(state);
  if (!scored && !open) return 'Predictions are scored against the ledger as they come due.';
  if (!scored) return `${open} prediction${open === 1 ? '' : 's'} open, none scored yet.`;
  const openPart = open ? `, ${open} still open` : '';
  return `${hit} of ${scored} predictions hit (${rate}%)${openPart}.`;
}
