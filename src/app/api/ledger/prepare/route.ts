// src/app/api/ledger/prepare/route.ts — Build transaction manifest for on-chain backup

import { prisma } from '@/lib/prisma/client';
import { requireAuth, handleRoute, json, errors } from '@/lib/api';
import { buildPageBackupManifest } from '@/lib/radix/ledger';
import { blocksToMdx } from '@/lib/mdx';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const auth = await requireAuth(request);
    if ('error' in auth) return auth.error;

    const { tagPath, slug } = await request.json() as { tagPath: string; slug: string };
    if (!tagPath || !slug) return errors.badRequest('tagPath and slug are required');

    const page = await prisma.page.findFirst({
      where: { tagPath, slug },
      select: {
        slug: true, tagPath: true, title: true, content: true,
        version: true, updatedAt: true, createdAt: true,
        bannerImage: true,
        author: { select: { displayName: true, radixAddress: true } },
      },
    });
    if (!page) return errors.notFound('Page not found');

    const mdx = blocksToMdx(page);
    const manifest = buildPageBackupManifest(
      auth.session.radixAddress,
      { slug: page.slug, pageVersion: page.version },
      mdx,
    );
    const sizeKB = Math.round(mdx.length / 1024);

    return json({
      manifest,
      title: page.title,
      sizeKB,
      timestamp: new Date().toISOString(),
    });
  }, 'Failed to prepare ledger backup');
}
