// src/app/api/users/[id]/stats/route.ts

import { prisma } from '@/lib/prisma/client';
import { json, errors, handleRoute, type RouteContext } from '@/lib/api';

type PathParams = { id: string };

function dampen(value: number, base = 10): number {
  return value > 0 ? Math.log(value + 1) / Math.log(base) : 0;
}

interface AggRow {
  edit_slots: bigint;
  unique_pages: bigint;
  comment_slots: bigint;
}

export async function GET(_request: Request, context: RouteContext<PathParams>) {
  return handleRoute(async () => {
    const { id } = await context.params;

    const [user, agg] = await Promise.all([
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
      prisma.$queryRaw<AggRow[]>`
        SELECT
          COALESCE((
            SELECT COUNT(DISTINCT page_id || ':' || EXTRACT(EPOCH FROM date_trunc('hour', created_at))::BIGINT)
            FROM revisions WHERE author_id = ${id}
          ), 0) AS edit_slots,
          COALESCE((
            SELECT COUNT(DISTINCT page_id)
            FROM revisions WHERE author_id = ${id}
          ), 0) AS unique_pages,
          COALESCE((
            SELECT COUNT(DISTINCT page_id || ':' || EXTRACT(EPOCH FROM date_trunc('hour', created_at))::BIGINT)
            FROM comments WHERE author_id = ${id}
          ), 0) AS comment_slots
      `,
    ]);

    if (!user) return errors.notFound('User not found');

    const { edit_slots, unique_pages, comment_slots } = agg[0];
    const accountAgeDays = Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24));

    const stats = {
      pages: user._count.pages,
      comments: Number(comment_slots),
      edits: Number(edit_slots),
      uniqueContributions: Number(unique_pages),
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

    const breakdown = {
      pages: stats.pages * 150,
      edits: stats.edits * 80,
      contributions: stats.uniqueContributions * 80,
      comments: stats.comments * 70,
      tenure: Math.floor(accountAgeDays / 30) * 50,
    };
    const points = Object.values(breakdown).reduce((a, b) => a + b, 0);

    return json({ userId: user.id, displayName: user.displayName, radixAddress: user.radixAddress, avatarUrl: user.avatarUrl, memberSince: user.createdAt, stats, score, points, breakdown });
  }, 'Failed to fetch user stats');
}
