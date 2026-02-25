// src/app/api/notifications/route.ts

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { json, errors, handleRoute, requireAuth, parsePagination, paginatedResponse } from '@/lib/api';
import { AUTHOR_SELECT } from '@/lib/wiki';

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const auth = await requireAuth(request);
    if ('error' in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const { page, pageSize } = parsePagination(searchParams, { pageSize: 20 });

    const where = { userId: auth.session.userId };
    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        include: {
          actor: AUTHOR_SELECT,
          page: { select: { id: true, title: true, tagPath: true, slug: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId: auth.session.userId, read: false } }),
    ]);

    return json({ ...paginatedResponse(notifications, total, page, pageSize), unreadCount });
  }, 'Failed to fetch notifications');
}

export async function PATCH(request: NextRequest) {
  return handleRoute(async () => {
    const auth = await requireAuth(request);
    if ('error' in auth) return auth.error;

    const body = await request.json();
    const { ids } = body as { ids?: string[] };

    if (ids?.length) {
      await prisma.notification.updateMany({
        where: { id: { in: ids }, userId: auth.session.userId },
        data: { read: true },
      });
    } else {
      await prisma.notification.updateMany({
        where: { userId: auth.session.userId, read: false },
        data: { read: true },
      });
    }

    return json({ success: true });
  }, 'Failed to update notifications');
}
