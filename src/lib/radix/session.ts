// src/lib/radix/session.ts

import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import type { AuthSession } from '@/types';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'default-secret-change-in-production-min-32-chars'
);

const SESSION_COOKIE_NAME = 'radix_wiki_session';
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

interface SessionPayload extends JWTPayload {
  userId: string;
  radixAddress: string;
  personaAddress?: string;
  displayName?: string;
}

export async function createSession(
  userId: string,
  radixAddress: string,
  personaAddress?: string,
  displayName?: string
): Promise<string> {
  const expiresAt = new Date(Date.now() + SESSION_DURATION);

  const token = await new SignJWT({
    userId,
    radixAddress,
    personaAddress,
    displayName,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .setJti(crypto.randomUUID())
    .sign(JWT_SECRET);

  await prisma.session.create({
    data: { userId, token, expiresAt },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  });

  return token;
}

export async function getSession(): Promise<AuthSession | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    const { payload } = await jwtVerify<SessionPayload>(token, JWT_SECRET);

    const session = await prisma.session.findUnique({ where: { token } });
    if (!session || session.expiresAt < new Date()) {
      if (session) await prisma.session.delete({ where: { id: session.id } });
      return null;
    }

    return {
      userId: payload.userId,
      radixAddress: payload.radixAddress,
      personaAddress: payload.personaAddress,
      displayName: payload.displayName,
      expiresAt: new Date(payload.exp! * 1000),
    };
  } catch (error) {
    console.error('Session verification error:', error);
    return null;
  }
}

export async function verifySession(token: string): Promise<AuthSession | null> {
  try {
    const { payload } = await jwtVerify<SessionPayload>(token, JWT_SECRET);

    const session = await prisma.session.findUnique({ where: { token } });
    if (!session || session.expiresAt < new Date()) return null;

    return {
      userId: payload.userId,
      radixAddress: payload.radixAddress,
      personaAddress: payload.personaAddress,
      displayName: payload.displayName,
      expiresAt: new Date(payload.exp! * 1000),
    };
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function cleanupExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}

export function getTokenFromHeaders(headers: Headers): string | null {
  const authHeader = headers.get('Authorization');
  return authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
}

// Auth helpers (consolidated from auth.ts)
export async function getAuthSession(request?: NextRequest): Promise<AuthSession | null> {
  const session = await getSession();
  if (session) return session;

  if (request) {
    const token = getTokenFromHeaders(request.headers);
    if (token) return verifySession(token);
  }

  return null;
}

export async function requireAuth(request?: NextRequest): Promise<{ session: AuthSession } | { error: true }> {
  const session = await getAuthSession(request);
  return session ? { session } : { error: true };
}