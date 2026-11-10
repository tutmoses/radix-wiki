// src/app/api/users/[id]/stats/route.ts

import { json, errors, handleRoute } from 'wiki-formant/http';
import { type RouteContext } from '@/lib/api';
import { getEditorScores, computePoints, totalPoints, ringScore, ageDays } from '@/lib/scoring';

type PathParams = { id: string };

export async function GET(_request: Request, context: RouteContext<PathParams>) {
  return handleRoute(async () => {
    const { id } = await context.params;
    // The leaderboard scores every user, so a profile reads its row from the same cache.
    const user = (await getEditorScores()).find(e => e.id === id);
    if (!user) return errors.notFound('User not found');

    const accountAgeDays = ageDays(user.createdAt);
    const stats = {
      pages: user.pages,
      comments: user.comments,
      edits: user.edits,
      uniqueContributions: user.contributions,
      accountAgeDays,
    };

    const input = { ...user, ageDays: accountAgeDays };
    const score = ringScore(input);
    const breakdown = computePoints(input);
    const points = totalPoints(input);

    return json({ userId: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl, memberSince: user.createdAt, stats, score, points, breakdown });
  }, 'Failed to fetch user stats');
}
