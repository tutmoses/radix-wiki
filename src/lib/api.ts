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

type AuthResult = { session: AuthSession } | { error: NextResponse };

export async function withAuth(request?: NextRequest): Promise<AuthResult> {
  const session = await getSession(request);
  return session ? { session } : { error: errors.unauthorized() };
}

type BalanceAuthResult = 
  | { session: AuthSession; user: { id: string; radixAddress: string }; balance: number }
  | { error: NextResponse };

export async function withAuthAndBalance(request: NextRequest | undefined, action: BalanceAction): Promise<BalanceAuthResult> {
  const auth = await withAuth(request);
  if ('error' in auth) return auth;
  const balanceCheck = await requireBalance(auth.session, action);
  if (!balanceCheck.ok) return { error: balanceCheck.response };
  return { session: auth.session, user: balanceCheck.user, balance: balanceCheck.balance };
}

export async function handleRoute(fn: () => Promise<NextResponse>, errorMsg = 'Internal server error'): Promise<NextResponse> {
  try {
    return await fn();
  } catch (error) {
    console.error(errorMsg, error);
    return errors.internal(errorMsg);
  }
}