// src/lib/scoring.ts — Single source of truth for contribution scoring

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
