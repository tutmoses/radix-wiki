// src/lib/api/auth.ts

import { NextRequest } from 'next/server';
import { getSession, getTokenFromHeaders, verifySession } from '@/lib/radix/session';
import type { AuthSession } from '@/types';

export async function getAuthSession(request?: NextRequest): Promise<AuthSession | null> {
  // Try cookie-based session first
  const session = await getSession();
  if (session) return session;

  // Fall back to bearer token if request provided
  if (request) {
    const token = getTokenFromHeaders(request.headers);
    if (token) {
      return verifySession(token);
    }
  }

  return null;
}

export async function requireAuth(request?: NextRequest): Promise<{ session: AuthSession } | { error: true }> {
  const session = await getAuthSession(request);
  if (!session) {
    return { error: true };
  }
  return { session };
}