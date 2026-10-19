// src/app/api/notifications/route.ts

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { json, handleRoute } from 'wiki-formant/http';
import { parsePagination, paginatedResponse } from 'wiki-formant/pagination';
import { requireAuth } from '@/lib/api';
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
        include: { actor: AUTHOR_SELECT },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId: auth.session.userId, read: false } }),
    ]);

    // Notification.pageId names a WikiPage row without a relation, so the pages are joined here.
    const pages = await prisma.wikiPage.findMany({
      where: { id: { in: [...new Set(notifications.map(n => n.pageId))] } },
      select: { id: true, title: true, tagPath: true, slug: true },
    });
    const byId = new Map(pages.map(p => [p.id, p]));
    const items = notifications.flatMap(n => (byId.has(n.pageId) ? [{ ...n, page: byId.get(n.pageId)! }] : []));
    return json({ ...paginatedResponse(items, total, page, pageSize), unreadCount });
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
