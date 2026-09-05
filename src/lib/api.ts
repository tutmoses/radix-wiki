// src/lib/api.ts - Shared API utilities

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, clientKey, rateLimitedResponse, type RateLimitOptions } from 'wiki-formant/rate-limit';
import { getSession } from '@/lib/auth';
import { requireBalance, type BalanceAction } from '@/lib/radix/balance';
import type { AuthSession } from '@/types';

export function json<T>(data: T, init?: number | ResponseInit): NextResponse {
  return NextResponse.json(data, typeof init === 'number' ? { status: init } : init);
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
  return json(data, { status, headers });
}

// ---- rate limiting ----

/**
 * The one MCP rate-limit number. `initialize`'s instructions, the OpenAPI spec
 * and /.well-known/mcp.json all read this rather than restating it, so the
 * route enforces exactly what the documents claim.
 */
export const MCP_RATE_LIMIT_PER_MIN = 60;
export const MCP_RATE_LIMIT_TEXT = `${MCP_RATE_LIMIT_PER_MIN} requests per minute per IP`;

// The bucket itself is `wiki-formant/rate-limit`, shared with the other agent
// surfaces — this was the third copy of it in the workspace. What stays here is
// the Next binding: reading the request headers and shaping the 429.

/** Per-IP gate for anonymous route handlers. Returns a ready-to-return 429
 *  when the caller is over budget, or null to proceed. `capacity` is the peak
 *  burst; `refillPerSec` the sustained rate. */
export function checkRateLimit(
  request: NextRequest,
  prefix: string,
  opts: RateLimitOptions,
): Response | null {
  const limit = rateLimit(clientKey(prefix, request.headers), opts);
  return limit.ok ? null : rateLimitedResponse(limit.retryAfterSec);
}

/** The verdict itself, for a caller that has to shape its own refusal — an MCP
 *  endpoint owes a JSON-RPC envelope, not this one's plain JSON body. */
export function rateLimitVerdict(request: NextRequest, prefix: string, opts: RateLimitOptions) {
  return rateLimit(clientKey(prefix, request.headers), opts);
}

// `Response`, not `NextResponse`: the shared helpers in `wiki-formant/http`
// answer with web-standard responses — a 304 from `notModified`, a descriptor
// from `descriptorResponse` — and a route that returns one is still a valid
// Next route handler.
export async function handleRoute(fn: () => Promise<Response>, errorMsg = 'Internal server error'): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    console.error(errorMsg, error);
    return errors.internal(errorMsg);
  }
}