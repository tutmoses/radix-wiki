// src/lib/auth.ts

import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { RADIX_CONFIG, getGatewayUrl } from '@/lib/radix/config';
import type { AuthSession, SignedChallenge } from '@/types';

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

// Session Management

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

// ROLA Verification

export async function generateChallenge(): Promise<{ challenge: string; expiresAt: Date }> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const challenge = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
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

export async function verifySignedChallenge(
  signedChallenge: SignedChallenge,
  expectedOrigin: string
): Promise<{ isValid: boolean; error?: string }> {
  try {
    if (!(await validateChallenge(signedChallenge.challenge))) {
      return { isValid: false, error: 'Invalid or expired challenge' };
    }

    const response = await fetch(`${getGatewayUrl()}/state/entity/details`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        addresses: [signedChallenge.address],
        aggregation_level: 'Vault',
        opt_ins: { explicit_metadata: ['owner_keys'] },
      }),
    });

    if (!response.ok) return { isValid: false, error: 'Failed to verify with Radix Gateway' };

    const { items = [] } = await response.json();
    if (!items.length) return { isValid: false, error: 'Entity not found on network' };

    const ownerKeysEntry = items[0].metadata?.items?.find((m: { key: string }) => m.key === 'owner_keys');
    if (!ownerKeysEntry) return { isValid: false, error: 'No owner_keys metadata found' };

    const ownerKeys = ownerKeysEntry.value?.typed?.values || [];
    const providedKeyHash = await hashPublicKey(signedChallenge.proof.publicKey);
    const keyMatches = ownerKeys.some((key: { value: string }) =>
      key.value === providedKeyHash || key.value === signedChallenge.proof.publicKey
    );

    if (!keyMatches) return { isValid: false, error: 'Public key does not match owner keys' };

    const messageToVerify = `ROLA${signedChallenge.challenge}${RADIX_CONFIG.dAppDefinitionAddress}${expectedOrigin}`;
    const signatureValid = await verifySignature(
      messageToVerify,
      signedChallenge.proof.signature,
      signedChallenge.proof.publicKey,
      signedChallenge.proof.curve
    );

    return signatureValid ? { isValid: true } : { isValid: false, error: 'Invalid signature' };
  } catch (error) {
    console.error('ROLA verification error:', error);
    return { isValid: false, error: 'Verification failed' };
  }
}

// Crypto helpers

async function hashPublicKey(publicKey: string): Promise<string> {
  const keyBytes = hexToBytes(publicKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', keyBytes.buffer as ArrayBuffer);
  return bytesToHex(new Uint8Array(hashBuffer).slice(-29));
}

async function verifySignature(
  message: string,
  signature: string,
  publicKey: string,
  curve: 'curve25519' | 'secp256k1'
): Promise<boolean> {
  try {
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = hexToBytes(signature);
    const publicKeyBytes = hexToBytes(publicKey);

    if (curve === 'curve25519') {
      const key = await crypto.subtle.importKey('raw', publicKeyBytes.buffer as ArrayBuffer, { name: 'Ed25519' }, false, ['verify']);
      return crypto.subtle.verify('Ed25519', key, signatureBytes.buffer as ArrayBuffer, messageBytes);
    } else {
      const key = await crypto.subtle.importKey('raw', publicKeyBytes.buffer as ArrayBuffer, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, signatureBytes.buffer as ArrayBuffer, messageBytes);
    }
  } catch {
    return false;
  }
}

function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Cleanup

export async function cleanupExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return result.count;
}

export async function cleanupExpiredChallenges(): Promise<number> {
  const result = await prisma.challenge.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return result.count;
}