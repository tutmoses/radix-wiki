// src/app/api/users/search/route.ts

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { json, errors, handleRoute } from '@/lib/api';

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
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
