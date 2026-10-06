// src/app/api/admin/rewards/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { json, errors, handleRoute, requireAuth } from '@/lib/api';
import { getEditorScores } from '@/lib/scoring';
import { getTreasuryBalance, getTreasuryAddress } from '@/lib/radix/balance';

export const dynamic = 'force-dynamic';

const ADMIN_ADDRESS = process.env.ADMIN_ADDRESS || '';

/** The admin's session, or the response that turns everyone else away. */
async function requireAdmin(request: NextRequest) {
  const auth = await requireAuth(request);
  if ('error' in auth) return auth;
  if (auth.session.radixAddress !== ADMIN_ADDRESS) return { error: errors.forbidden('Admin access required') };
  return auth;
}

function computeShares<T extends { points: number }>(editors: T[]) {
  const total = editors.reduce((sum, e) => sum + e.points, 0);
  if (total === 0) return { editors: [], totalPoints: 0 };
  return {
    editors: editors.map(e => ({ ...e, share: e.points / total })),
    totalPoints: total,
  };
}

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const admin = await requireAdmin(request);
    if ('error' in admin) return admin.error;

    const [balance, scored] = await Promise.all([getTreasuryBalance(), getEditorScores()]);
    const { editors, totalPoints } = computeShares(scored.filter(e => e.points > 0));
    const withAmounts = editors.map(e => ({ ...e, amountXrd: Math.floor(balance * e.share * 100) / 100 }));

    if (new URL(request.url).searchParams.get('format') === 'csv') {
      const rows = withAmounts.filter(e => e.amountXrd >= 1).map(e => `${e.radixAddress},${e.amountXrd}`);
      return new NextResponse(['Address,Amount', ...rows].join('\n'), { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="airdrop.csv"' } });
    }

    const airdrops = await prisma.airdrop.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });

    return json({
      treasury: { address: getTreasuryAddress(), balance },
      totalPoints,
      editors: withAmounts,
      airdrops,
    });
  }, 'Failed to fetch rewards');
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const admin = await requireAdmin(request);
    if ('error' in admin) return admin.error;

    const { txHash, totalXrd, snapshot } = await request.json();
    if (!txHash || !totalXrd || !snapshot) {
      return errors.badRequest('txHash, totalXrd, and snapshot are required');
    }

    const airdrop = await prisma.airdrop.create({
      data: {
        txHash,
        totalXrd,
        editorCount: snapshot.length,
        snapshotJson: snapshot,
      },
    });

    return json(airdrop, 201);
  }, 'Failed to record airdrop');
}
