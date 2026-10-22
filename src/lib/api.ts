// src/lib/api.ts - Shared API utilities

import { createHash, timingSafeEqual } from 'node:crypto';
import { getSession } from '@/lib/auth';
import { requireBalance, type BalanceAction } from '@/lib/radix/balance';
import { json, errors } from 'wiki-formant/http';
import { routeTags } from '@/lib/wiki';
import { rateLimit, rateLimitedResponse, type RateLimitOptions } from 'wiki-formant/rate-limit';
import type { ImageFormat } from 'wiki-formant/upload';
import type { AuthSession } from '@/types';

export type RouteContext<T = Record<string, string | string[]>> = { params: Promise<T> };

export async function requireAuth(request?: Request, action?: BalanceAction): Promise<{ session: AuthSession } | { error: Response }> {
  const session = await getSession(request);
  if (!session) return { error: errors.unauthorized() };
  if (action) {
    // A balance gates who may write, not how often: one holder could otherwise
    // post without end, and every write purges the whole `wiki` cache tag.
    const limited = overBudget(`write:${session.userId}`, WRITE_LIMIT);
    if (limited) return { error: limited };
    const check = await requireBalance(session, action);
    if (!check.ok) return { error: check.response };
  }
  return { session };
}

const WRITE_LIMIT: RateLimitOptions = { capacity: 30, refillPerSec: 0.2 };

/** Budgets for what a signed-in wallet can do without holding $XRD. A wallet costs
 *  nothing to mint, so these are keyed on the caller's address (`clientKey`), never
 *  on a user id a fresh wallet per burst would renew. */
export const IP_LIMITS = {
  challenge: { capacity: 10, refillPerSec: 1 / 30 },
  settings: { capacity: 20, refillPerSec: 1 / 60 },
  // A keyword search is an unauthenticated scan of every page's prose; the
  // edge cache in front of it holds a repeated query, never a fresh one.
  search: { capacity: 60, refillPerSec: 1 },
} satisfies Record<string, RateLimitOptions>;

/** The 429 for a caller over `key`'s budget, or null while they are within it. */
export function overBudget(key: string, opts: RateLimitOptions): Response | null {
  const result = rateLimit(key, opts);
  return result.ok ? null : rateLimitedResponse(result.retryAfterSec);
}

/** Whether a presented secret is the expected one, in constant time. Both are
 *  hashed first, so their lengths match and neither is compared directly. */
export function secretMatches(given: string | null | undefined, expected: string | undefined): boolean {
  if (!given || !expected) return false;
  const digest = (s: string) => createHash('sha256').update(s).digest();
  return timingSafeEqual(digest(given), digest(expected));
}

/** The largest request body Vercel lets reach a function; anything larger is refused before a route sees it. */
export const REQUEST_BODY_MAX = 4.5 * 1024 * 1024;

/** What /api/upload holds every image to, here so the upload_image tool quotes the route. */
export const UPLOAD = {
  // As much as can arrive: the output is re-encoded down anyway.
  maxBytes: REQUEST_BODY_MAX,
  // 2x the ~800px prose column.
  maxWidth: 1600,
  // What the route's sniff accepts, keyed so a format wiki-formant adds or drops fails the type check.
  formats: { jpg: 'JPEG', png: 'PNG', gif: 'GIF', webp: 'WebP', avif: 'AVIF' } satisfies Record<ImageFormat, string>,
};

export const CACHE = {
  short: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
  medium: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
  long: { 'Cache-Control': 'public, s-maxage=3600' },
} as const;

/**
 * `res` with `routeTags(tags)`, for a response a shared helper builds
 * without room for them: the CDN holds a route handler by its `s-maxage` alone,
 * and only the tag lets the save that changes it purge it.
 */
export function tagged(res: Response, tags: string | readonly string[]): Response {
  for (const [name, value] of Object.entries(routeTags(tags))) res.headers.set(name, value);
  return res;
}

export function cachedJson<T>(data: T, headers: Record<string, string> = CACHE.short, status?: number) {
  return json(data, { status, headers });
}
