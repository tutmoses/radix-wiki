// src/lib/auth.ts — this wiki's binding of @/lib/rola.
//
// The stack itself (challenge, proof verification, JWT session, cookie and
// Bearer entry) is @/lib/rola. What stays here is only what is this wiki's
// configuration: the cookie name, the secret and the dApp identity.

import { createRolaAuth } from '@/lib/rola';
import { RADIX_CONFIG } from '@/lib/radix/config';

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET environment variable is required in production');
}

const auth = createRolaAuth({
  cookieName: 'radix_wiki_session',
  jwtSecret: new TextEncoder().encode(
    process.env.JWT_SECRET || 'default-secret-change-in-production-min-32-chars'
  ),
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
