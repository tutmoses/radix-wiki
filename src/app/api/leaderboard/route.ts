// src/app/api/leaderboard/route.ts

import { prisma } from '@/lib/prisma/client';
import { json, handleRoute, parsePagination, paginatedResponse } from '@/lib/api';
import { totalPoints } from '@/lib/scoring';
import { unstable_cache } from 'next/cache';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

interface LeaderboardRow {
  id: string;
  display_name: string | null;
  radix_address: string;
  avatar_url: string | null;
  created_at: Date;
  page_count: bigint;
  edit_slots: bigint;
  unique_pages: bigint;
  comment_slots: bigint;
}

const getLeaderboardScores = unstable_cache(
  async () => {
    const rows = await prisma.$queryRaw<LeaderboardRow[]>`
      SELECT
        u.id,
        u.display_name,
        u.radix_address,
        u.avatar_url,
        u.created_at,
        (SELECT COUNT(*) FROM pages p WHERE p.author_id = u.id) AS page_count,
        COALESCE(r.edit_slots, 0) AS edit_slots,
        COALESCE(r.unique_pages, 0) AS unique_pages,
        COALESCE(c.comment_slots, 0) AS comment_slots
      FROM users u
      LEFT JOIN LATERAL (
        SELECT
          COUNT(DISTINCT page_id || ':' || EXTRACT(EPOCH FROM date_trunc('hour', created_at))::BIGINT) AS edit_slots,
          COUNT(DISTINCT page_id) AS unique_pages
        FROM revisions WHERE author_id = u.id
      ) r ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(DISTINCT page_id || ':' || EXTRACT(EPOCH FROM date_trunc('hour', created_at))::BIGINT) AS comment_slots
        FROM comments WHERE author_id = u.id
      ) c ON true
    `;

    return rows.map(u => {
      const pages = Number(u.page_count);
      const edits = Number(u.edit_slots);
      const contributions = Number(u.unique_pages);
      const comments = Number(u.comment_slots);
      const ageDays = Math.floor((Date.now() - new Date(u.created_at).getTime()) / 86_400_000);
      const points = totalPoints({ pages, edits, contributions, comments, ageDays });

      return {
        id: u.id,
        displayName: u.display_name,
        radixAddress: u.radix_address,
        avatarUrl: u.avatar_url,
        pages,
        edits,
        contributions,
        comments,
        points,
      };
    }).sort((a, b) => b.points - a.points);
  },
  ['leaderboard-scores'],
  { revalidate: 3600, tags: ['leaderboard'] }
);

export async function GET(request: Request) {
  return handleRoute(async () => {
    const { page, pageSize } = parsePagination(new URL(request.url).searchParams, { pageSize: 25 });
    const scored = await getLeaderboardScores();
    const total = scored.length;
    const slice = scored.slice((page - 1) * pageSize, page * pageSize);
    return json(paginatedResponse(slice, total, page, pageSize));
  }, 'Failed to fetch leaderboard');
}
