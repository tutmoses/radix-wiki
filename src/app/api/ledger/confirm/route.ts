// src/app/api/ledger/confirm/route.ts — Store backup tx hash on page record

import { prisma } from '@/lib/prisma/client';
import { requireAuth, handleRoute, json, errors } from '@/lib/api';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const auth = await requireAuth(request);
    if ('error' in auth) return auth.error;

    const { tagPath, slug, txHash } = await request.json() as { tagPath: string; slug: string; txHash: string };
    if (!tagPath || !slug || !txHash) return errors.badRequest('tagPath, slug, and txHash are required');

    await prisma.page.update({
      where: { tagPath_slug: { tagPath, slug } },
      data: { backupTxHash: txHash },
    });

    return json({ ok: true });
  }, 'Failed to confirm backup');
}
