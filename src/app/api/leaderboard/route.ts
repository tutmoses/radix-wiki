// src/app/api/leaderboard/route.ts

import { json, handleRoute, parsePagination, paginatedResponse } from '@/lib/api';
import { getEditorScores } from '@/lib/scoring';
import { shortenAddress, pagePath } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

export async function GET(request: Request) {
  return handleRoute(async () => {
    const { page, pageSize } = parsePagination(new URL(request.url).searchParams, { pageSize: 25 });
    const scored = await getEditorScores();
    const total = scored.length;
    // Public shape: the wallet address leaves the server truncated only; the full
    // one stays in getEditorScores for the admin rewards CSV.
    const slice = scored.slice((page - 1) * pageSize, page * pageSize).map(e => ({
      id: e.id,
      displayName: e.displayName,
      shortAddress: shortenAddress(e.radixAddress),
      avatarUrl: e.avatarUrl,
      profilePath: e.subjectPage ? pagePath(e.subjectPage.tagPath, e.subjectPage.slug) : null,
      pages: e.pages,
      edits: e.edits,
      contributions: e.contributions,
      comments: e.comments,
      points: e.points,
    }));
    return json(paginatedResponse(slice, total, page, pageSize));
  }, 'Failed to fetch leaderboard');
}
