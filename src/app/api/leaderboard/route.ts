// src/app/api/leaderboard/route.ts

import { prisma } from '@/lib/prisma/client';
import { json, handleRoute, parsePagination, paginatedResponse } from '@/lib/api';

export const revalidate = 300;

const WEIGHTS = { page: 150, edit: 80, contribution: 80, comment: 70, tenure: 50 } as const;

export async function GET(request: Request) {
  return handleRoute(async () => {
    const { page, pageSize } = parsePagination(new URL(request.url).searchParams, { pageSize: 25 });

    const users = await prisma.user.findMany({
      select: {
        id: true,
        displayName: true,
        radixAddress: true,
        avatarUrl: true,
        createdAt: true,
        _count: { select: { pages: true } },
        revisions: { select: { pageId: true, createdAt: true } },
        comments: { select: { pageId: true, createdAt: true } },
      },
    });

    const scored = users.map(u => {
      const editSlots = new Set<string>();
      const uniquePages = new Set<string>();
      for (const rev of u.revisions) {
        uniquePages.add(rev.pageId);
        editSlots.add(`${rev.pageId}:${Math.floor(rev.createdAt.getTime() / 3_600_000)}`);
      }
      const commentSlots = new Set<string>();
      for (const c of u.comments) {
        commentSlots.add(`${c.pageId}:${Math.floor(c.createdAt.getTime() / 3_600_000)}`);
      }
      const ageDays = Math.floor((Date.now() - u.createdAt.getTime()) / 86_400_000);
      const points =
        u._count.pages * WEIGHTS.page +
        editSlots.size * WEIGHTS.edit +
        uniquePages.size * WEIGHTS.contribution +
        commentSlots.size * WEIGHTS.comment +
        Math.floor(ageDays / 30) * WEIGHTS.tenure;

      return {
        id: u.id,
        displayName: u.displayName,
        radixAddress: u.radixAddress,
        avatarUrl: u.avatarUrl,
        pages: u._count.pages,
        edits: editSlots.size,
        contributions: uniquePages.size,
        comments: commentSlots.size,
        points,
      };
    });

    scored.sort((a, b) => b.points - a.points);
    const total = scored.length;
    const slice = scored.slice((page - 1) * pageSize, page * pageSize);

    return json(paginatedResponse(slice, total, page, pageSize));
  }, 'Failed to fetch leaderboard');
}
