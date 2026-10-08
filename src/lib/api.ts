// src/lib/api.ts - Shared API utilities

import type { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { requireBalance, type BalanceAction } from '@/lib/radix/balance';
import { json, errors } from 'wiki-formant/http';
import type { AuthSession } from '@/types';

// Web-standard `Response`, not `NextResponse`: the shared helpers in
// `wiki-formant/http` answer that way — a 304 from `notModified`, a descriptor
// from `descriptorResponse` — and the error shape is the one the other origins
// give, so an agent gets the same body for the same mistake everywhere.
export { json, errors, handleRoute } from 'wiki-formant/http';

export type RouteContext<T = Record<string, string | string[]>> = { params: Promise<T> };

export async function requireAuth(request?: NextRequest, action?: BalanceAction): Promise<{ session: AuthSession } | { error: Response }> {
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

// The MCP budget is `wiki-formant/rate-limit`, shared with the other agent
// surfaces: `initialize`'s instructions, the OpenAPI spec and
// /.well-known/mcp.json all read it, so the route enforces exactly what the
// documents claim — and all three repos had written the same three lines.
export { MCP_RATE_LIMIT, MCP_RATE_LIMIT_TEXT } from 'wiki-formant/rate-limit';
