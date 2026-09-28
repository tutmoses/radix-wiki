// src/app/api/leaderboard/route.ts

import { json, handleRoute, parsePagination, paginatedResponse } from '@/lib/api';
import { getEditorScores, publicScore } from '@/lib/scoring';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

export async function GET(request: Request) {
  return handleRoute(async () => {
    const { page, pageSize } = parsePagination(new URL(request.url).searchParams, { pageSize: 25 });
    const scored = await getEditorScores();
    const slice = scored.slice((page - 1) * pageSize, page * pageSize).map(publicScore);
    return json(paginatedResponse(slice, scored.length, page, pageSize));
  }, 'Failed to fetch leaderboard');
}
