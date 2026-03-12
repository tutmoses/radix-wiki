// src/lib/auth.ts

import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { Rola } from '@radixdlt/rola';
import { prisma } from '@/lib/prisma/client';
import { RADIX_CONFIG } from '@/lib/radix/config';
import type { AuthSession, SignedChallenge } from '@/types';

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET environment variable is required in production');
}
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'default-secret-change-in-production-min-32-chars'
);
const SESSION_COOKIE = 'radix_wiki_session';
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;

interface SessionPayload extends JWTPayload {
  userId: string;
  radixAddress: string;
  personaAddress?: string;
  displayName?: string;
}

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');

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
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  });

  return token;
}

export async function getSession(request?: NextRequest): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(SESSION_COOKIE)?.value;
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
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { token } });
  cookieStore.delete(SESSION_COOKIE);
}

export async function generateChallenge(): Promise<{ challenge: string; expiresAt: Date }> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const challenge = bytesToHex(array);
  const expiresAt = new Date(Date.now() + parseInt(process.env.CHALLENGE_EXPIRATION || '300', 10) * 1000);

  await prisma.challenge.create({ data: { challenge, expiresAt } });
  return { challenge, expiresAt };
}

async function validateChallenge(challenge: string): Promise<boolean> {
  const stored = await prisma.challenge.findUnique({ where: { challenge } });
  if (!stored || stored.expiresAt < new Date()) {
    if (stored) await prisma.challenge.delete({ where: { id: stored.id } });
    return false;
  }
  await prisma.challenge.delete({ where: { id: stored.id } });
  return true;
}

const rola = Rola({
  expectedOrigin: RADIX_CONFIG.applicationUrl,
  dAppDefinitionAddress: RADIX_CONFIG.dAppDefinitionAddress,
  networkId: RADIX_CONFIG.networkId,
  applicationName: RADIX_CONFIG.applicationName,
});

export async function verifySignedChallenge(
  signedChallenge: SignedChallenge,
): Promise<{ isValid: boolean; error?: string }> {
  try {
    if (!(await validateChallenge(signedChallenge.challenge))) {
      return { isValid: false, error: 'Invalid or expired challenge' };
    }

    const result = await rola.verifySignedChallenge({
      ...signedChallenge,
      type: 'account',
    });

    if (result.isErr()) {
      return { isValid: false, error: result.error.reason };
    }

    return { isValid: true };
  } catch (error) {
    console.error('ROLA verification error:', error);
    return { isValid: false, error: 'Verification failed' };
  }
}
