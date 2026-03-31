// src/app/api/ledger/recover/route.ts — Read wiki pages back from the Radix ledger

import { handleRoute, json, errors } from '@/lib/api';
import { readAnchorFromLedger, readAllPagesFromLedger } from '@/lib/radix/ledger';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const address = request.nextUrl.searchParams.get('address');
    if (!address) return errors.badRequest('address query parameter required');

    const [anchor, pages] = await Promise.all([
      readAnchorFromLedger(address),
      readAllPagesFromLedger(address),
    ]);

    return json({ anchor, pages, recoveredCount: pages.length });
  }, 'Failed to recover from ledger');
}
