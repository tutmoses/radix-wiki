// src/app/api/users/[id]/stats/route.ts

import { prisma } from '@/lib/prisma/client';
import { json, errors, handleRoute } from 'wiki-formant/http';
import { type RouteContext } from '@/lib/api';
import { computePoints, totalPoints, ringScore } from '@/lib/scoring';

type PathParams = { id: string };

interface AggRow {
  edit_slots: bigint;
  unique_pages: bigint;
  comment_slots: bigint;
}

export async function GET(_request: Request, context: RouteContext<PathParams>) {
  return handleRoute(async () => {
    const { id } = await context.params;

    const [user, pageCount, agg] = await Promise.all([
      prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
          createdAt: true,
        },
      }),
      prisma.wikiPage.count({ where: { authorId: id } }),
      prisma.$queryRaw<AggRow[]>`
        SELECT
          COALESCE((
            SELECT COUNT(DISTINCT "pageId" || ':' || EXTRACT(EPOCH FROM date_trunc('hour', "createdAt"))::BIGINT)
            FROM "WikiRevision" WHERE "authorId" = ${id}
          ), 0) AS edit_slots,
          COALESCE((
            SELECT COUNT(DISTINCT "pageId")
            FROM "WikiRevision" WHERE "authorId" = ${id}
          ), 0) AS unique_pages,
          COALESCE((
            SELECT COUNT(DISTINCT page_id || ':' || EXTRACT(EPOCH FROM date_trunc('hour', created_at))::BIGINT)
            FROM comments WHERE author_id = ${id}
          ), 0) AS comment_slots
      `,
    ]);

    if (!user) return errors.notFound('User not found');

    const { edit_slots, unique_pages, comment_slots } = agg[0]!; // Scalar SELECT (no FROM) always returns one row
    const accountAgeDays = Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24));

    const stats = {
      pages: pageCount,
      comments: Number(comment_slots),
      edits: Number(edit_slots),
      uniqueContributions: Number(unique_pages),
      accountAgeDays,
    };

    const input = { pages: stats.pages, edits: stats.edits, contributions: stats.uniqueContributions, comments: stats.comments, ageDays: accountAgeDays };
    const score = ringScore(input);
    const breakdown = computePoints(input);
    const points = totalPoints(input);

    return json({ userId: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl, memberSince: user.createdAt, stats, score, points, breakdown });
  }, 'Failed to fetch user stats');
}
