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

type AuthError = { error: NextResponse };

export async function requireAuth(request?: NextRequest): Promise<{ session: AuthSession } | AuthError>;
export async function requireAuth(request: NextRequest, action: BalanceAction): Promise<{ session: AuthSession; user: { id: string; radixAddress: string }; balance: number } | AuthError>;
export async function requireAuth(request?: NextRequest, action?: BalanceAction): Promise<{ session: AuthSession; user?: { id: string; radixAddress: string }; balance?: number } | AuthError> {
  const session = await getSession(request);
  if (!session) return { error: errors.unauthorized() };

  if (action) {
    const balanceCheck = await requireBalance(session, action);
    if (!balanceCheck.ok) return { error: balanceCheck.response };
    return { session, user: balanceCheck.user, balance: balanceCheck.balance };
  }

  return { session };
}

export async function handleRoute(fn: () => Promise<NextResponse>, errorMsg = 'Internal server error'): Promise<NextResponse> {
  try {
    return await fn();
  } catch (error) {
    console.error(errorMsg, error);
    return errors.internal(errorMsg);
  }
}