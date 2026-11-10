// src/app/api/users/search/route.ts

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { json, handleRoute } from 'wiki-formant/http';
import { AUTHOR_SELECT, authorsOf } from '@/lib/wiki';

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const ids = request.nextUrl.searchParams.get('ids');
    if (ids) return json([...(await authorsOf(ids.split(',').filter(Boolean).slice(0, 50))).values()]);

    const q = request.nextUrl.searchParams.get('q')?.trim();
    if (!q || q.length < 2) return json([]);

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { displayName: { contains: q, mode: 'insensitive' } },
          // A whole address only: a prefix match let `?q=` grow a prefix one character
          // at a time into the full address that `shortAddress` exists to withhold.
          { radixAddress: q.toLowerCase() },
        ],
      },
      ...AUTHOR_SELECT,
      take: 10,
    });

    return json(users);
  }, 'User search failed');
}
