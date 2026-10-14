// src/lib/auth.ts — sign-in and the session it opens.
//
// The challenge, the wallet's proof of it and the HS256 token are
// `wiki-formant/rola`, shared with caper. What is this wiki's own is the
// session: a `Session` row behind a seven-day cookie, so signing out revokes
// the token, and the same token taken as a Bearer header by agents.

import { cookies } from 'next/headers';
import { bearerToken, createRola, sessionSecret, signSession, verifySession } from 'wiki-formant/rola';
import { prisma } from '@/lib/prisma/client';
import { RADIX_CONFIG } from '@/lib/radix/config';

export type { SignedChallenge } from 'wiki-formant/rola';

export interface AuthSession {
  userId: string;
  radixAddress: string;
  personaAddress?: string;
  displayName?: string;
  expiresAt: Date;
}

type SessionClaims = Omit<AuthSession, 'expiresAt'>;

const COOKIE = 'radix_wiki_session';
const SESSION_SEC = 7 * 24 * 60 * 60;
const secret = sessionSecret(process.env.JWT_SECRET);

export const { generateChallenge, verifySignedChallenge } = createRola({
  expectedOrigin: RADIX_CONFIG.applicationUrl,
  dAppDefinitionAddress: RADIX_CONFIG.dAppDefinitionAddress,
  networkId: RADIX_CONFIG.networkId,
  applicationName: RADIX_CONFIG.applicationName,
  challenges: prisma.challenge,
  challengeTtlSec: parseInt(process.env.CHALLENGE_EXPIRATION || '300', 10),
});

async function verifyToken(token: string): Promise<AuthSession | null> {
  const claims = await verifySession<SessionClaims>(token, secret);
  if (!claims) return null;
  const session = await prisma.session.findUnique({ where: { token } });
  if (!session || session.expiresAt < new Date()) {
    if (session) await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return {
    userId: claims.userId,
    radixAddress: claims.radixAddress,
    personaAddress: claims.personaAddress,
    displayName: claims.displayName,
    expiresAt: new Date(claims.exp! * 1000),
  };
}

export async function createSession(userId: string, radixAddress: string, personaAddress?: string, displayName?: string): Promise<string> {
  const token = await signSession({ userId, radixAddress, personaAddress, displayName }, secret, SESSION_SEC);
  const expiresAt = new Date(Date.now() + SESSION_SEC * 1000);
  await prisma.session.create({ data: { userId, token, expiresAt } });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  });
  return token;
}

/** The cookie's session, else the request's Bearer token: agents send the same token as a header. */
export async function getSession(request?: { headers: { get(name: string): string | null } }): Promise<AuthSession | null> {
  const cookieToken = (await cookies()).get(COOKIE)?.value;
  const session = cookieToken ? await verifyToken(cookieToken) : null;
  if (session) return session;
  const bearer = request && bearerToken(request.headers);
  return bearer ? verifyToken(bearer) : null;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { token } });
  jar.delete(COOKIE);
}
