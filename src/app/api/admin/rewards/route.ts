// src/app/api/admin/rewards/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { json, errors, requireAuth } from '@/lib/api';
import { getEditorScores } from '@/lib/scoring';
import { getTreasuryBalance, getTreasuryAddress } from '@/lib/radix/treasury';

export const dynamic = 'force-dynamic';

const ADMIN_ADDRESS = process.env.ADMIN_ADDRESS || '';

function computeShares(editors: { id: string; displayName: string | null; radixAddress: string; points: number }[]) {
  const total = editors.reduce((sum, e) => sum + e.points, 0);
  if (total === 0) return { editors: [], totalPoints: 0 };
  return {
    editors: editors.map(e => ({ ...e, share: e.points / total })),
    totalPoints: total,
  };
}

function buildCsv(editors: { radixAddress: string; amount: number }[]): string {
  const lines = ['Address,Amount'];
  for (const e of editors) {
    lines.push(`${e.radixAddress},${e.amount}`);
  }
  return lines.join('\n');
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if ('error' in auth) return auth.error;
    if (auth.session.radixAddress !== ADMIN_ADDRESS) return errors.forbidden('Admin access required');

    const format = new URL(request.url).searchParams.get('format');
    const [balance, scored] = await Promise.all([getTreasuryBalance(), getEditorScores()]);
    const active = scored.filter(e => e.points > 0);
    const { editors, totalPoints: tp } = computeShares(active);

    if (format === 'csv') {
      const withAmounts = editors.map(e => ({ radixAddress: e.radixAddress, amount: Math.floor(balance * e.share * 100) / 100 }));
      const csv = buildCsv(withAmounts.filter(e => e.amount >= 1));
      return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="airdrop.csv"' } });
    }

    const airdrops = await prisma.airdrop.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });

    return json({
      treasury: { address: getTreasuryAddress(), balance },
      totalPoints: tp,
      editors: editors.map(e => ({
        ...e,
        amountXrd: Math.floor(balance * e.share * 100) / 100,
      })),
      airdrops,
    });
  } catch (error) {
    console.error('Failed to fetch rewards:', error);
    return errors.internal('Failed to fetch rewards');
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if ('error' in auth) return auth.error;
    if (auth.session.radixAddress !== ADMIN_ADDRESS) return errors.forbidden('Admin access required');

    const body = await request.json();
    const { txHash, totalXrd, snapshot } = body;

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
  } catch (error) {
    console.error('Failed to record airdrop:', error);
    return errors.internal('Failed to record airdrop');
  }
}
