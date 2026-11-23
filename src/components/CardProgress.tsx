// src/components/CardProgress.tsx – an Ideas card's progress and target, on the board and on the card

import { categoryLabel } from '@/lib/utils';
import { progressLabel, type Progress } from '@/lib/checklist';
import type { PageMetadata } from '@/types';

/** The ticked share of a card's tick-boxes: "2/5" on the board, "2 of 5 done" with `long`. */
export function CardProgress({ progress, long }: { progress: Progress | null; long?: boolean }) {
  if (!progress) return null;
  return (
    <span className="card-progress">
      <progress value={progress.done} max={progress.total} aria-label={progressLabel(progress)} />
      <span>{long ? progressLabel(progress) : `${progress.done}/${progress.total}`}</span>
    </span>
  );
}

/** A target date before today on a card that is not done. */
export const isOverdue = (meta: PageMetadata, now: number): boolean =>
  !!meta.target && categoryLabel(meta.status) !== 'Done' && meta.target < new Date(now).toISOString().slice(0, 10);

