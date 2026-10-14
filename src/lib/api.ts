// src/lib/api.ts - Shared API utilities

import { getSession } from '@/lib/auth';
import { requireBalance, type BalanceAction } from '@/lib/radix/balance';
import { json, errors } from 'wiki-formant/http';
import type { AuthSession } from '@/types';

export type RouteContext<T = Record<string, string | string[]>> = { params: Promise<T> };

export async function requireAuth(request?: Request, action?: BalanceAction): Promise<{ session: AuthSession } | { error: Response }> {
  const session = await getSession(request);
  if (!session) return { error: errors.unauthorized() };
  if (action) {
    const check = await requireBalance(session, action);
    if (!check.ok) return { error: check.response };
  }
  return { session };
}

export const CACHE = {
  short: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
  medium: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
  long: { 'Cache-Control': 'public, s-maxage=3600' },
  og: { 'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800' },
} as const;

export function cachedJson<T>(data: T, headers: Record<string, string> = CACHE.short, status?: number) {
  return json(data, { status, headers });
}
