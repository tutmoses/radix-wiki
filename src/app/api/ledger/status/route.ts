// src/app/api/ledger/status/route.ts — On-chain backup status

import { prisma } from '@/lib/prisma/client';
import { handleRoute, cachedJson, errors, CACHE } from '@/lib/api';
import { readAnchorFromLedger } from '@/lib/radix/ledger';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const address = request.nextUrl.searchParams.get('address');
    if (!address) return errors.badRequest('address query parameter required');

    const [anchor, dbCount, latestPage] = await Promise.all([
      readAnchorFromLedger(address),
      prisma.page.count(),
      prisma.page.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
    ]);

    const hoursSinceAnchor = anchor
      ? (Date.now() - new Date(anchor.timestamp).getTime()) / 3_600_000
      : null;

    return cachedJson({
      anchor,
      db: {
        pageCount: dbCount,
        latestUpdate: latestPage?.updatedAt.toISOString() ?? null,
      },
      hoursSinceAnchor: hoursSinceAnchor ? Math.round(hoursSinceAnchor * 10) / 10 : null,
    }, CACHE.short);
  }, 'Failed to read ledger status');
}
