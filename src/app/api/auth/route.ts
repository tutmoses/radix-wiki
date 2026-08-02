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

    const primaryAccount = accounts[0]!;

    if (!signedChallenge) {
      return errors.badRequest('Signed challenge is required');
    }

    const verification = await verifySignedChallenge(signedChallenge);
    if (!verification.isValid) {
      return json({ error: verification.error || 'Verification failed' }, { status: 401 });
    }

    let user = await prisma.user.findUnique({ where: { radixAddress: primaryAccount.address } });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      user = await prisma.user.create({
        data: {
          radixAddress: primaryAccount.address,
          personaAddress: persona?.identityAddress,
          displayName: persona?.label || primaryAccount.label,
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