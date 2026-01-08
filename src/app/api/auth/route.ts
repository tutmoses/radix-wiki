// src/app/api/auth/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { verifySignedChallenge } from '@/lib/radix/rola';
import { createSession, getSession, destroySession } from '@/lib/radix/session';
import { RADIX_CONFIG } from '@/lib/radix/config';
import type { SignedChallenge, RadixAccount, RadixPersona } from '@/types';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json(null);

    return NextResponse.json({
      userId: session.userId,
      radixAddress: session.radixAddress,
      personaAddress: session.personaAddress,
      displayName: session.displayName,
      expiresAt: session.expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json(null);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accounts, persona, signedChallenge } = body as {
      accounts?: RadixAccount[];
      persona?: RadixPersona;
      signedChallenge?: SignedChallenge;
    };

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ error: 'No accounts provided' }, { status: 400 });
    }

    const primaryAccount = accounts[0];

    if (signedChallenge) {
      const verification = await verifySignedChallenge(signedChallenge, RADIX_CONFIG.applicationUrl);
      if (!verification.isValid) {
        return NextResponse.json({ error: verification.error || 'Verification failed' }, { status: 401 });
      }
    }

    let user = await prisma.user.findUnique({ where: { radixAddress: primaryAccount.address } });

    if (!user) {
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

    return NextResponse.json({
      userId: user.id,
      radixAddress: user.radixAddress,
      personaAddress: user.personaAddress,
      displayName: user.displayName,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      token,
    });
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await destroySession();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 });
  }
}