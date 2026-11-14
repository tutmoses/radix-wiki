// src/lib/radix/price.ts – What OciSwap says a token is worth, decided once for every surface that shows it

/**
 * A quoted price; a token OciSwap quotes no price for, or has never seen; or an
 * OciSwap that did not answer. The last is not the second: "not traded" is a
 * claim about the token, and a failed read makes none.
 */
export type Price =
  | { kind: 'priced'; usd: number; change24h?: number }
  | { kind: 'unpriced' }
  | { kind: 'unread' };

/**
 * OciSwap's `/tokens/{address}` answer as a price: `status` is its HTTP status,
 * or null when nothing answered. It answers 404 for an address it has never
 * seen, and 200 with no price for a resource it knows but nobody trades; both
 * are unpriced. Any other refusal is a read that failed.
 */
export function ociswapPrice(status: number | null, body: unknown): Price {
  if (status === 404) return { kind: 'unpriced' };
  if (status === null || status < 200 || status >= 300) return { kind: 'unread' };
  const usd = (body as { price?: { usd?: Record<string, unknown> } } | null)?.price?.usd;
  const now = Number(usd?.now);
  const day = Number(usd?.['24h']);
  if (!(now > 0)) return { kind: 'unpriced' };
  return { kind: 'priced', usd: now, change24h: day > 0 ? ((now - day) / day) * 100 : undefined };
}
