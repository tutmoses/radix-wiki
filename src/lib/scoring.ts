// src/lib/scoring.ts — Single source of truth for contribution scoring

import { prisma } from '@/lib/prisma/client';
import { unstable_cache } from 'next/cache';

export const WEIGHTS = { page: 150, edit: 80, contribution: 80, comment: 70, tenure: 50 } as const;

export interface ScoreInput {
  pages: number;
  edits: number;
  contributions: number;
  comments: number;
  ageDays: number;
}

export function computePoints(s: ScoreInput) {
  return {
    pages: s.pages * WEIGHTS.page,
    edits: s.edits * WEIGHTS.edit,
    contributions: s.contributions * WEIGHTS.contribution,
    comments: s.comments * WEIGHTS.comment,
    tenure: Math.floor(s.ageDays / 30) * WEIGHTS.tenure,
  };
}

export function totalPoints(s: ScoreInput): number {
  const b = computePoints(s);
  return b.pages + b.edits + b.contributions + b.comments + b.tenure;
}

// --- Shared leaderboard query ---

interface EditorRow {
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

export interface EditorScore {
  id: string;
  displayName: string | null;
  radixAddress: string;
  avatarUrl: string | null;
  pages: number;
  edits: number;
  contributions: number;
  comments: number;
  points: number;
}

export const getEditorScores = unstable_cache(
  async (): Promise<EditorScore[]> => {
    const rows = await prisma.$queryRaw<EditorRow[]>`
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
        pages, edits, contributions, comments, points,
      };
    }).sort((a, b) => b.points - a.points);
  },
  ['editor-scores'],
  { revalidate: 3600, tags: ['leaderboard'] },
);

// --- Distribution dedup ---

export async function getRecentPostSlugs(type: string | string[], days: number): Promise<Set<string>> {
  const types = Array.isArray(type) ? type : [type];
  const rows = await prisma.tweet.findMany({
    where: { type: { in: types }, createdAt: { gte: new Date(Date.now() - days * 86_400_000) } },
    select: { pageSlug: true, pageTagPath: true },
  });
  return new Set(rows.map(r => `${r.pageTagPath}/${r.pageSlug}`));
}

/** Log-dampened 0-100 ring score for profile display */
export function ringScore(s: ScoreInput): number {
  const dampen = (v: number, base: number) => v > 0 ? Math.log(v + 1) / Math.log(base) : 0;
  const hasActivity = (s.edits + s.comments) > 0 ? 1 : 0;
  return Math.min(Math.round(
    15 * dampen(s.pages, 10) +
     8 * dampen(s.edits, 5) +
     8 * dampen(s.contributions, 5) +
     7 * dampen(s.comments, 8) +
    10 * dampen(s.ageDays, 50) * hasActivity
  ), 100);
}
