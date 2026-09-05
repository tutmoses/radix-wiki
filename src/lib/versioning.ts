// src/lib/versioning.ts — page revision semver and the diff behind the bump.
//
// Both halves are `wiki-formant` now: the arithmetic is `wiki-formant/versioning`
// and the block-tree walk is `wiki-formant/revisions`, shared with caper, which
// had written the same `extractBlocks` character for character.
//
// What stays here is what is this repo's: the shape of its containers, the leaf
// diff its history view renders, and the positional signature its four call
// sites already use.
//
// The shared walk also drops something this file used to carry: two Maps keyed
// by a recursive JSON.stringify of every block, rebuilt on every save and read
// by nothing. Matching is by id and always was.

import {
  computeRevisionDiff as sharedRevisionDiff,
  type BlockChange as SharedBlockChange,
  type BlockGroup,
  type RevisionDiff as SharedRevisionDiff,
} from 'wiki-formant/revisions';
import type { Block, ContentBlock } from '@/types/blocks';

export { formatVersion, incrementVersion, parseVersion } from 'wiki-formant/versioning';

/** The history view renders both sides, so the leaf diff is the raw HTML. */
interface ContentDiff {
  from: string;
  to: string;
}

export type BlockChange = SharedBlockChange<ContentDiff>;
export type RevisionDiff = SharedRevisionDiff<ContentDiff>;

/** This wiki's two container types, and the paths that address their children. */
const containers = (block: Block): BlockGroup<Block>[] | null => {
  if (block.type === 'columns') {
    return block.columns.map((col, i) => ({ path: `columns.${i}.blocks`, blocks: col.blocks }));
  }
  if (block.type === 'infobox') return [{ path: 'blocks', blocks: block.blocks }];
  return null;
};

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
    containers,
    leafDiff,
  });
}
