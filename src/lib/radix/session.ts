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

// Core token verification - single source of truth
async function verifyToken(token: string): Promise<AuthSession | null> {
  try {
    const { payload } = await jwtVerify<SessionPayload>(token, JWT_SECRET);
    const session = await prisma.session.findUnique({ where: { token } });
    if (!session || session.expiresAt < new Date()) {
      if (session) prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      return null;
    }
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

export async function createSession(
  userId: string,
  radixAddress: string,
  personaAddress?: string,
  displayName?: string
): Promise<string> {
  const expiresAt = new Date(Date.now() + SESSION_DURATION);
  const token = await new SignJWT({ userId, radixAddress, personaAddress, displayName })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .setJti(crypto.randomUUID())
    .sign(JWT_SECRET);

  await prisma.session.create({ data: { userId, token, expiresAt } });

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

// Unified session getter - checks cookie first, then Authorization header
export async function getSession(request?: NextRequest): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (cookieToken) {
    const session = await verifyToken(cookieToken);
    if (session) return session;
  }

  if (request) {
    const authHeader = request.headers.get('Authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (bearerToken) return verifyToken(bearerToken);
  }

  return null;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) await prisma.session.deleteMany({ where: { token } });
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function requireAuth(request?: NextRequest): Promise<{ session: AuthSession } | { error: true }> {
  const session = await getSession(request);
  return session ? { session } : { error: true };
}

export async function cleanupExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return result.count;
}