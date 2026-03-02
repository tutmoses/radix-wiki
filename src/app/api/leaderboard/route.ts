// src/app/api/leaderboard/route.ts

import { json, handleRoute, parsePagination, paginatedResponse } from '@/lib/api';
import { getEditorScores } from '@/lib/scoring';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

export async function GET(request: Request) {
  return handleRoute(async () => {
    const { page, pageSize } = parsePagination(new URL(request.url).searchParams, { pageSize: 25 });
    const scored = await getEditorScores();
    const total = scored.length;
    const slice = scored.slice((page - 1) * pageSize, page * pageSize);
    return json(paginatedResponse(slice, total, page, pageSize));
  }, 'Failed to fetch leaderboard');
}
