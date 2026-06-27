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

export function parsePagination(searchParams: URLSearchParams, defaults?: { pageSize?: number }) {
  return {
    page: Math.max(1, parseInt(searchParams.get('page') || '1', 10)),
    pageSize: Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || String(defaults?.pageSize ?? 20), 10))),
  };
}

export function paginatedResponse<T>(items: T[], total: number, page: number, pageSize: number) {
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export const CACHE = {
  short: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
  medium: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
  long: { 'Cache-Control': 'public, s-maxage=3600' },
  og: { 'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800' },
} as const;

export function cachedJson<T>(data: T, headers: Record<string, string> = CACHE.short, status?: number) {
  return NextResponse.json(data, { status, headers });
}

export async function handleRoute(fn: () => Promise<NextResponse>, errorMsg = 'Internal server error'): Promise<NextResponse> {
  try {
    return await fn();
  } catch (error) {
    console.error(errorMsg, error);
    return errors.internal(errorMsg);
  }
}