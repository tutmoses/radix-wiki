// src/app/api/ledger/prepare/route.ts — Build transaction manifest for on-chain backup

import { prisma } from '@/lib/prisma/client';
import { requireAuth, handleRoute, json, errors } from '@/lib/api';
import { buildPageBackupManifest, serializePage, type PageSnapshot } from '@/lib/radix/ledger';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const auth = await requireAuth(request);
    if ('error' in auth) return auth.error;

    const { tagPath, slug } = await request.json() as { tagPath: string; slug: string };
    if (!tagPath || !slug) return errors.badRequest('tagPath and slug are required');

    const page = await prisma.page.findFirst({
      where: { tagPath, slug },
      select: { id: true, slug: true, tagPath: true, title: true, content: true, excerpt: true, version: true, updatedAt: true },
    });
    if (!page) return errors.notFound('Page not found');

    const snapshot: PageSnapshot = {
      id: page.id,
      slug: page.slug,
      tagPath: page.tagPath,
      title: page.title,
      content: page.content,
      excerpt: page.excerpt,
      version: page.version,
      updatedAt: page.updatedAt.toISOString(),
    };

    const manifest = buildPageBackupManifest(auth.session.radixAddress, snapshot);
    const sizeKB = Math.round(serializePage(snapshot).length / 1024);

    return json({
      manifest,
      title: page.title,
      sizeKB,
      timestamp: new Date().toISOString(),
    });
  }, 'Failed to prepare ledger backup');
}
