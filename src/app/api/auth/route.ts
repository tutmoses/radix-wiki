// src/app/api/auth/route.ts

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { getSession, createSession, destroySession, verifySignedChallenge } from '@/lib/auth';
import { json, errors, handleRoute } from '@/lib/api';
import type { SignedChallenge, RadixAccount, RadixPersona } from '@/types';

export async function GET() {
  return handleRoute(async () => {
    const session = await getSession();
    if (!session) return json(null);

    return json({
      userId: session.userId,
      radixAddress: session.radixAddress,
      personaAddress: session.personaAddress,
      displayName: session.displayName,
      expiresAt: session.expiresAt.toISOString(),
    });
  }, 'Session check error');
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const body = await request.json();
    const { accounts, persona, signedChallenge } = body as {
      accounts?: RadixAccount[];
      persona?: RadixPersona;
      signedChallenge?: SignedChallenge;
    };

    if (!accounts || accounts.length === 0) {
      return errors.badRequest('No accounts provided');
    }

    if (!signedChallenge) {
      return errors.badRequest('Signed challenge is required');
    }

    const verification = await verifySignedChallenge(signedChallenge);
    if (!verification.isValid) {
      return json({ error: verification.error || 'Verification failed' }, { status: 401 });
    }

    // The session belongs to the address the proof verified, never to one the
    // body merely names. `accounts` is unsigned: keying the user on accounts[0]
    // let anyone sign a challenge with their own key and log in as any address
    // on the ledger. A persona proof names no account, so it cannot log in.
    const address = signedChallenge.address;
    if (!address.startsWith('account_')) {
      return errors.badRequest('Sign in with an account proof');
    }
    const account = accounts.find(a => a.address === address);

    let user = await prisma.user.findUnique({ where: { radixAddress: address } });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      user = await prisma.user.create({
        data: {
          radixAddress: address,
          personaAddress: persona?.identityAddress,
          displayName: persona?.label || account?.label,
        },
      });
    } else if (persona?.identityAddress || persona?.label) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          personaAddress: persona?.identityAddress || user.personaAddress,
          displayName: persona?.label || user.displayName,
        },
      });
    }

    const token = await createSession(
      user.id,
      user.radixAddress,
      user.personaAddress || undefined,
      user.displayName || undefined
    );

    return json({
      userId: user.id,
      radixAddress: user.radixAddress,
      personaAddress: user.personaAddress,
      displayName: user.displayName,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      token,
      isNewUser,
    });
  }, 'Auth error');
}

export async function DELETE() {
  return handleRoute(async () => {
    await destroySession();
    return json({ success: true });
  }, 'Logout error');
}