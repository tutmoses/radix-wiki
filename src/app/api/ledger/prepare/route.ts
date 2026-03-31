// src/app/api/ledger/prepare/route.ts — Build transaction manifest for on-chain backup

import { prisma } from '@/lib/prisma/client';
import { requireAuth, handleRoute, json } from '@/lib/api';
import { buildBackupManifest, compressPage, type PageSnapshot } from '@/lib/radix/ledger';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const auth = await requireAuth(request);
    if ('error' in auth) return auth.error;

    const pages = await prisma.page.findMany({
      select: { id: true, slug: true, tagPath: true, title: true, content: true, excerpt: true, version: true, updatedAt: true },
      orderBy: { id: 'asc' },
    });

    const snapshots: PageSnapshot[] = pages.map(p => ({
      id: p.id,
      slug: p.slug,
      tagPath: p.tagPath,
      title: p.title,
      content: p.content,
      excerpt: p.excerpt,
      version: p.version,
      updatedAt: p.updatedAt.toISOString(),
    }));

    // Write to the user's own account
    const manifest = buildBackupManifest(auth.session.radixAddress, snapshots);

    const totalCompressedBytes = snapshots.reduce((sum, p) => sum + compressPage(p).length / 2, 0);

    return json({
      manifest,
      pageCount: snapshots.length,
      compressedSizeKB: Math.round(totalCompressedBytes / 1024),
      timestamp: new Date().toISOString(),
    });
  }, 'Failed to prepare ledger backup');
}
