// src/lib/versioning.ts — page revision semver and the diff behind the bump.
//
// Both halves are `wiki-formant`: the arithmetic is `wiki-formant/versioning`
// and the block-tree walk is `wiki-formant/revisions`, shared with caper.
//
// What stays here is what is this repo's: the leaf diff its history view
// renders, and the positional signature its four call sites already use. Its
// containers are the core two, which is the walk's default.

import {
  computeRevisionDiff as sharedRevisionDiff,
  type BlockChange as SharedBlockChange,
  type RevisionDiff as SharedRevisionDiff,
} from 'wiki-formant/revisions';
import fastDiff from 'fast-diff';
import { stripHtml } from 'wiki-formant/text';
import type { Block, ContentBlock } from '@/types/blocks';

export { formatVersion, incrementVersion, parseVersion } from 'wiki-formant/versioning';

/** The history view renders both sides, so the leaf diff is the raw HTML. */
interface ContentDiff {
  from: string;
  to: string;
}

export type BlockChange = SharedBlockChange<ContentDiff>;
export type RevisionDiff = SharedRevisionDiff<ContentDiff>;

/** A stripped-text diff as the history view draws it: -1 removed, 0 kept, 1 added. */
export type DiffPart = [-1 | 0 | 1, string];
/** A change as the history page ships it: the diff it draws, not the two HTML bodies behind it. */
export type HistoryChange = SharedBlockChange<DiffPart[]>;

const text = (block: Block | null): string =>
  block?.type === 'content' ? (block as ContentBlock).text : '';

/**
 * Only `content` blocks carry prose worth diffing. A modification needs both
 * sides to be content: an id whose block type changed is a replacement, and
 * showing one side's HTML against the other's would read as an edit.
 */
const leafDiff = (from: Block | null, to: Block | null): ContentDiff | undefined => {
  if (from && to) {
    return from.type === 'content' && to.type === 'content' ? { from: text(from), to: text(to) } : undefined;
  }
  return (from ?? to)?.type === 'content' ? { from: text(from), to: text(to) } : undefined;
};

export function computeRevisionDiff(
  currentVersion: string | null,
  oldContent: Block[],
  newContent: Block[],
  oldTitle: string,
  newTitle: string,
  oldBanner: string | null = null,
  newBanner: string | null = null,
): RevisionDiff {
  return sharedRevisionDiff<Block, ContentDiff>({
    currentVersion,
    oldContent,
    newContent,
    oldTitle,
    newTitle,
    oldMeta: oldBanner,
    newMeta: newBanner,
    leafDiff,
  });
}

/** The view lists leaves; a container's own entry only restates its children. */
const CONTAINER_TYPES = new Set(['infobox', 'columns']);
/** Kept text is context, so a long run keeps only its ends. */
const KEPT_MAX = 60;
const clip = (t: string) => (t.length > KEPT_MAX ? `${t.slice(0, 30)}…${t.slice(-30)}` : t);

/**
 * The history page's change list, diffed on the server. It used to ship both
 * HTML bodies of every modified block in every revision and diff them in the
 * browser on expand: 870 KB of payload for a 13-revision page whose rendered
 * diffs come to 25 KB. `attributes.text` is where diffs stored before
 * `leafDiff` existed kept the same pair.
 */
export function historyChanges(changes: readonly BlockChange[]): HistoryChange[] {
  return changes.filter(c => !CONTAINER_TYPES.has(c.type)).map(({ attributes, leafDiff, ...change }) => {
    const stored = attributes?.text as ContentDiff | undefined;
    const from = stripHtml(leafDiff?.from ?? stored?.from ?? '');
    const to = stripHtml(leafDiff?.to ?? stored?.to ?? '');
    if (from === to) return change;
    const parts = fastDiff(from, to)
      .filter(([, t]) => t.trim())
      .map(([op, t]): DiffPart => [op, op === 0 ? clip(t) : t]);
    return parts.length ? { ...change, leafDiff: parts } : change;
  });
}
