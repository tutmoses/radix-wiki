// src/lib/radix/headline.ts – the /charts numbers in one sentence, for the link preview.
//
// A shared /charts link used to unfurl as the word "Charts". This puts the last day's
// transactions and the $XRD price on the card, from the same cached reads the page uses.

import { getLedgerDays } from './activity';
import { getTopTokens } from './tokens';
import { XRD_ADDRESS } from './config';

const pct = (n: number) => `${n >= 0 ? 'up' : 'down'} ${Math.abs(n).toFixed(1)}%`;

export async function chartsHeadline(): Promise<string | null> {
  const [days, tokens] = await Promise.all([getLedgerDays().catch(() => []), getTopTokens().catch(() => [])]);
  const parts: string[] = [];
  const last = days.at(-1);
  if (last) {
    const before = days.slice(-31, -1);
    const mean = before.reduce((sum, d) => sum + d.transactions, 0) / (before.length || 1);
    const day = new Date(last.time * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
    parts.push(`${last.transactions.toLocaleString('en-US')} transactions on ${day}${mean > 0 ? `, ${pct(((last.transactions - mean) / mean) * 100)} on the 30-day average` : ''}.`);
  }
  const xrd = tokens.find(t => t.address === XRD_ADDRESS);
  if (xrd) parts.push(`$XRD at $${xrd.price.toPrecision(3)}${xrd.change24h !== undefined ? `, ${pct(xrd.change24h)} in 24 hours` : ''}.`);
  return parts.length ? parts.join(' ') : null;
}
