// src/app/api/wiki/by-ids/route.ts — Batch page lookup by IDs

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { json, errors, handleRoute } from '@/lib/api';
import { AUTHOR_SELECT } from '@/lib/wiki';

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const ids = request.nextUrl.searchParams.get('ids')?.split(',').filter(Boolean);
    if (!ids?.length) return errors.badRequest('ids parameter required');
    if (ids.length > 50) return errors.badRequest('Maximum 50 IDs per request');

    const pages = await prisma.page.findMany({
      where: { id: { in: ids } },
      select: {
        id: true, slug: true, title: true, excerpt: true, bannerImage: true,
        tagPath: true, metadata: true, version: true, createdAt: true, updatedAt: true,
        author: AUTHOR_SELECT,
      },
    });

    return json(pages);
  }, 'Failed to fetch pages by IDs');
}
