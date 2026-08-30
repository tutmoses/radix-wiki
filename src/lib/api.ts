// src/lib/api.ts - Shared API utilities

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { requireBalance, type BalanceAction } from '@/lib/radix/balance';
import type { AuthSession } from '@/types';

export function json<T>(data: T, status?: number | { status?: number }): NextResponse {
  const opts = typeof status === 'number' ? { status } : status;
  return NextResponse.json(data, opts);
}

export const errors = {
  unauthorized: () => json({ error: 'Unauthorized' }, 401),
  forbidden: (msg = 'Forbidden') => json({ error: msg }, 403),
  notFound: (msg = 'Not found') => json({ error: msg }, 404),
  badRequest: (msg: string) => json({ error: msg }, 400),
  internal: (msg = 'Internal server error') => json({ error: msg }, 500),
} as const;

export type RouteContext<T = Record<string, string | string[]>> = { params: Promise<T> };

export async function requireAuth(request?: NextRequest, action?: BalanceAction): Promise<{ session: AuthSession } | { error: NextResponse }> {
  const session = await getSession(request);
  if (!session) return { error: errors.unauthorized() };
  if (action) {
    const check = await requireBalance(session, action);
    if (!check.ok) return { error: check.response };
  }
  return { session };
}

// The clamp and the `{items,total,page,pageSize,totalPages}` shape are a client
// contract, so they live in `wiki-formant/pagination` rather than being re-typed
// per repo — which is how one sibling dropped `totalPages` and another redid the
// offset by hand in raw SQL. Re-exported so every route handler here is unchanged.
export { parsePagination, paginatedResponse } from 'wiki-formant/pagination';

export const CACHE = {
  short: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
  medium: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
  long: { 'Cache-Control': 'public, s-maxage=3600' },
  og: { 'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800' },
} as const;

export function cachedJson<T>(data: T, headers: Record<string, string> = CACHE.short, status?: number) {
  return NextResponse.json(data, { status, headers });
}

// ---- rate limiting ----
// Token bucket per IP, in-memory. Survives across requests within a single
// serverless instance; on cold start the bucket resets. Fine as a
// defense-in-depth bar for anonymous routes.
type Bucket = { tokens: number; updatedAt: number };
const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

/** Per-IP gate for anonymous route handlers. Returns a ready-to-return 429
 *  when the caller is over budget, or null to proceed. `capacity` is the peak
 *  burst; `refillPerSec` the sustained rate. */
export function checkRateLimit(
  request: NextRequest,
  prefix: string,
  opts: { capacity: number; refillPerSec: number },
): NextResponse | null {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon';
  const key = `${prefix}:${ip}`;
  const now = Date.now();
  const existing = buckets.get(key);

  // Evict oldest if the map grows unbounded — prevents memory pressure under
  // high-cardinality keying (e.g. one bucket per attacker IP).
  if (!existing && buckets.size >= MAX_BUCKETS) {
    const oldest = buckets.keys().next().value;
    if (oldest !== undefined) buckets.delete(oldest);
  }

  const bucket: Bucket = existing ?? { tokens: opts.capacity, updatedAt: now };
  bucket.tokens = Math.min(opts.capacity, bucket.tokens + ((now - bucket.updatedAt) / 1000) * opts.refillPerSec);
  bucket.updatedAt = now;
  buckets.set(key, bucket);

  if (bucket.tokens < 1) {
    const retryAfterSec = Math.ceil((1 - bucket.tokens) / opts.refillPerSec);
    return NextResponse.json(
      { error: `Too many requests. Try again in ${retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
    );
  }

  bucket.tokens -= 1;
  return null;
}

export async function handleRoute(fn: () => Promise<NextResponse>, errorMsg = 'Internal server error'): Promise<NextResponse> {
  try {
    return await fn();
  } catch (error) {
    console.error(errorMsg, error);
    return errors.internal(errorMsg);
  }
}