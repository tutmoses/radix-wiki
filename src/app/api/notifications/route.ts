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

    // Notification.pageId names a WikiPage row without a relation, so the pages are
    // joined here, and a deleted page's rows are dropped before the list, its total
    // and the unread count are taken, so all three count the same rows.
    const { userId } = auth.session;
    const pageIds = await prisma.notification.findMany({ where: { userId }, distinct: ['pageId'], select: { pageId: true } });
    const pages = await prisma.wikiPage.findMany({
      where: { id: { in: pageIds.map(n => n.pageId) } },
      select: { id: true, title: true, tagPath: true, slug: true },
    });
    const byId = new Map(pages.map(p => [p.id, p]));

    const where = { userId, pageId: { in: [...byId.keys()] } };
    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        include: { actor: AUTHOR_SELECT },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { ...where, read: false } }),
    ]);

    const items = notifications.map(n => ({ ...n, page: byId.get(n.pageId)! }));
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
