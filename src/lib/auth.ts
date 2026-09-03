// src/lib/auth.ts — this wiki's binding of `wiki-formant/rola`.
//
// The stack itself (challenge, proof verification, JWT session, cookie and
// Bearer entry) lives in the package. What stays here is only what is this
// wiki's: the cookie name, the dApp identity, and the two ports the package
// deliberately does not import — a per-repo Prisma client and next/headers.

import { cookies } from 'next/headers';
import { createRolaAuth } from 'wiki-formant/rola';
import { prisma } from '@/lib/prisma/client';
import { RADIX_CONFIG } from '@/lib/radix/config';

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET environment variable is required in production');
}

const auth = createRolaAuth({
  cookieName: 'radix_wiki_session',
  jwtSecret: new TextEncoder().encode(
    process.env.JWT_SECRET || 'default-secret-change-in-production-min-32-chars'
  ),
  store: { session: prisma.session, challenge: prisma.challenge },
  cookies,
  rola: {
    expectedOrigin: RADIX_CONFIG.applicationUrl,
    dAppDefinitionAddress: RADIX_CONFIG.dAppDefinitionAddress,
    networkId: RADIX_CONFIG.networkId,
    applicationName: RADIX_CONFIG.applicationName,
  },
  challengeTtlSec: parseInt(process.env.CHALLENGE_EXPIRATION || '300', 10),
});

export const {
  createSession,
  getSession,
  destroySession,
  generateChallenge,
  verifySignedChallenge,
} = auth;
