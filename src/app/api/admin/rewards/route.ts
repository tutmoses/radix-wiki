// src/app/api/admin/rewards/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { json, errors, requireAuth } from '@/lib/api';
import { totalPoints } from '@/lib/scoring';
import { getTreasuryBalance, getTreasuryAddress } from '@/lib/radix/treasury';
import { unstable_cache } from 'next/cache';

export const dynamic = 'force-dynamic';

const ADMIN_ADDRESS = process.env.ADMIN_ADDRESS || '';

interface LeaderboardRow {
  id: string;
  display_name: string | null;
  radix_address: string;
  created_at: Date;
  page_count: bigint;
  edit_slots: bigint;
  unique_pages: bigint;
  comment_slots: bigint;
}

const getEditorScores = unstable_cache(
  async () => {
    const rows = await prisma.$queryRaw<LeaderboardRow[]>`
      SELECT
        u.id,
        u.display_name,
        u.radix_address,
        u.created_at,
        (SELECT COUNT(*) FROM pages p WHERE p.author_id = u.id) AS page_count,
        COALESCE(r.edit_slots, 0) AS edit_slots,
        COALESCE(r.unique_pages, 0) AS unique_pages,
        COALESCE(c.comment_slots, 0) AS comment_slots
      FROM users u
      LEFT JOIN LATERAL (
        SELECT
          COUNT(DISTINCT page_id || ':' || EXTRACT(EPOCH FROM date_trunc('hour', created_at))::BIGINT) AS edit_slots,
          COUNT(DISTINCT page_id) AS unique_pages
        FROM revisions WHERE author_id = u.id
      ) r ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(DISTINCT page_id || ':' || EXTRACT(EPOCH FROM date_trunc('hour', created_at))::BIGINT) AS comment_slots
        FROM comments WHERE author_id = u.id
      ) c ON true
    `;

    return rows.map(u => {
      const pages = Number(u.page_count);
      const edits = Number(u.edit_slots);
      const contributions = Number(u.unique_pages);
      const comments = Number(u.comment_slots);
      const ageDays = Math.floor((Date.now() - new Date(u.created_at).getTime()) / 86_400_000);
      const points = totalPoints({ pages, edits, contributions, comments, ageDays });
      return { id: u.id, displayName: u.display_name, radixAddress: u.radix_address, points };
    }).filter(e => e.points > 0).sort((a, b) => b.points - a.points);
  },
  ['editor-scores'],
  { revalidate: 3600, tags: ['leaderboard'] }
);

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
    const { editors, totalPoints: tp } = computeShares(scored);

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
