// src/app/api/users/search/route.ts

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { json, errors, handleRoute } from '@/lib/api';

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const ids = request.nextUrl.searchParams.get('ids');
    if (ids) {
      const idList = ids.split(',').filter(Boolean).slice(0, 50);
      if (!idList.length) return json([]);
      const users = await prisma.user.findMany({
        where: { id: { in: idList } },
        select: { id: true, displayName: true, radixAddress: true, avatarUrl: true },
      });
      return json(users);
    }

    const q = request.nextUrl.searchParams.get('q')?.trim();
    if (!q || q.length < 2) return json([]);

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { displayName: { contains: q, mode: 'insensitive' } },
          { radixAddress: { startsWith: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, displayName: true, radixAddress: true, avatarUrl: true },
      take: 10,
    });

    return json(users);
  }, 'User search failed');
}
