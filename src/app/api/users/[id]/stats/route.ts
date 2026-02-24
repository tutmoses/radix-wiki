// src/app/api/users/[id]/stats/route.ts

import { prisma } from '@/lib/prisma/client';
import { json, errors, handleRoute, type RouteContext } from '@/lib/api';

type PathParams = { id: string };

function dampen(value: number, base = 10): number {
  return value > 0 ? Math.log(value + 1) / Math.log(base) : 0;
}

export async function GET(_request: Request, context: RouteContext<PathParams>) {
  return handleRoute(async () => {
    const { id } = await context.params;

    const [user, revisions, comments] = await Promise.all([
      prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          displayName: true,
          radixAddress: true,
          avatarUrl: true,
          createdAt: true,
          _count: { select: { pages: true } },
        },
      }),
      prisma.revision.findMany({
        where: { authorId: id },
        select: { pageId: true, createdAt: true },
      }),
      prisma.comment.findMany({
        where: { authorId: id },
        select: { pageId: true, createdAt: true },
      }),
    ]);

    if (!user) return errors.notFound('User not found');

    // Aggregate edits into 1-hour slots per page
    const editSlots = new Set<string>();
    const uniquePages = new Set<string>();
    for (const rev of revisions) {
      uniquePages.add(rev.pageId);
      const hourSlot = Math.floor(rev.createdAt.getTime() / (1000 * 60 * 60));
      editSlots.add(`${rev.pageId}:${hourSlot}`);
    }

    // Aggregate comments into 1-hour slots per page
    const commentSlots = new Set<string>();
    for (const comment of comments) {
      const hourSlot = Math.floor(comment.createdAt.getTime() / (1000 * 60 * 60));
      commentSlots.add(`${comment.pageId}:${hourSlot}`);
    }

    const accountAgeDays = Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24));

    const stats = {
      pages: user._count.pages,
      comments: commentSlots.size,
      edits: editSlots.size,
      uniqueContributions: uniquePages.size,
      accountAgeDays,
    };

    const hasActivity = (stats.edits + stats.comments) > 0 ? 1 : 0;

    const score = Math.min(Math.round(
      15 * dampen(stats.pages, 10) +
       8 * dampen(stats.edits, 5) +
       8 * dampen(stats.uniqueContributions, 5) +
       7 * dampen(stats.comments, 8) +
      10 * dampen(accountAgeDays, 50) * hasActivity
    ), 100);

    return json({ userId: user.id, displayName: user.displayName, radixAddress: user.radixAddress, avatarUrl: user.avatarUrl, memberSince: user.createdAt, stats, score });
  }, 'Failed to fetch user stats');
}