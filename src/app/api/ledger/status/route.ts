// src/app/api/ledger/status/route.ts — On-chain backup status

import { handleRoute, cachedJson, errors, CACHE } from '@/lib/api';
import { prisma } from '@/lib/prisma/client';
import { readAnchorFromLedger } from '@/lib/radix/ledger';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const address = request.nextUrl.searchParams.get('address');
    if (!address) return errors.badRequest('address query parameter required');
    const tagPath = request.nextUrl.searchParams.get('tagPath');
    const slug = request.nextUrl.searchParams.get('slug');

    const anchor = await readAnchorFromLedger(address);

    const hoursSinceAnchor = anchor
      ? (Date.now() - new Date(anchor.timestamp).getTime()) / 3_600_000
      : null;

    // Look up current page version + backup tx hash if a page is specified
    let currentPageVersion: string | null = null;
    let backupTxHash: string | null = null;
    if (tagPath && slug) {
      const page = await prisma.page.findUnique({
        where: { tagPath_slug: { tagPath, slug } },
        select: { version: true, backupTxHash: true },
      });
      currentPageVersion = page?.version ?? null;
      backupTxHash = page?.backupTxHash ?? null;
    }

    return cachedJson({
      anchor,
      hoursSinceAnchor: hoursSinceAnchor ? Math.round(hoursSinceAnchor * 10) / 10 : null,
      currentPageVersion,
      backupTxHash,
    }, CACHE.short);
  }, 'Failed to read ledger status');
}
