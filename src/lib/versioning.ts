// src/lib/versioning.ts - Semantic versioning with block-level tracking

import type { Block, BlockType } from '@/types/blocks';

// Semantic version type
export interface SemVer {
  major: number;
  minor: number;
  patch: number;
}

export type ChangeType = 'major' | 'minor' | 'patch' | 'none';

// Block-level change tracking
export interface BlockChange {
  id: string;
  action: 'added' | 'removed' | 'modified' | 'moved';
  type: BlockType;
  path: string; // e.g., "root.0" or "root.1.columns.0.blocks.2"
  attributes?: Record<string, { from: unknown; to: unknown }>;
  contentDiff?: { from: string; to: string };
}

export interface RevisionDiff {
  version: SemVer;
  changeType: ChangeType;
  changes: BlockChange[];
  titleChanged: boolean;
  bannerChanged: boolean;
  summary: string;
}

// Parse/format version strings
export function parseVersion(version: string | null | undefined): SemVer {
  if (!version) return { major: 1, minor: 0, patch: 0 };
  const [major = 1, minor = 0, patch = 0] = version.split('.').map(Number);
  return { major: major || 1, minor: minor || 0, patch: patch || 0 };
}

export function formatVersion(version: SemVer): string {
  return `${version.major}.${version.minor}.${version.patch}`;
}

export function incrementVersion(version: SemVer, changeType: ChangeType): SemVer {
  switch (changeType) {
    case 'major': return { major: version.major + 1, minor: 0, patch: 0 };
    case 'minor': return { ...version, minor: version.minor + 1, patch: 0 };
    case 'patch': return { ...version, patch: version.patch + 1 };
    default: return version;
  }
}

// Normalize blocks for comparison
function normalizeBlock(block: Block): Block {
  const { id, ...rest } = block;
  if (block.type === 'columns') {
    return {
      ...rest,
      id: '',
      columns: block.columns.map(col => ({
        ...col,
        id: '',
        blocks: col.blocks.map(normalizeBlock),
      })),
    } as Block;
  }
  return { ...rest, id: '' } as Block;
}

function blockSignature(block: Block): string {
  const normalized = normalizeBlock(block);
  return JSON.stringify(normalized);
}

// Extract all blocks with paths
interface BlockWithPath {
  block: Block;
  path: string;
}

function extractBlocks(blocks: Block[], basePath = 'root'): BlockWithPath[] {
  const result: BlockWithPath[] = [];
  blocks.forEach((block, i) => {
    const path = `${basePath}.${i}`;
    result.push({ block, path });
    if (block.type === 'columns') {
      block.columns.forEach((col, ci) => {
        result.push(...extractBlocks(col.blocks, `${path}.columns.${ci}.blocks`));
      });
    }
  });
  return result;
}

// Compare block attributes
function diffAttributes(oldBlock: Block, newBlock: Block): Record<string, { from: unknown; to: unknown }> | undefined {
  const diffs: Record<string, { from: unknown; to: unknown }> = {};
  const allKeys = new Set([...Object.keys(oldBlock), ...Object.keys(newBlock)]);
  
  for (const key of allKeys) {
    if (key === 'id' || key === 'type') continue;
    const oldVal = (oldBlock as unknown as Record<string, unknown>)[key];
    const newVal = (newBlock as unknown as Record<string, unknown>)[key];
    
    // Skip nested structures (handled separately)
    if (key === 'columns' || key === 'blocks') continue;
    
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      diffs[key] = { from: oldVal, to: newVal };
    }
  }
  
  return Object.keys(diffs).length > 0 ? diffs : undefined;
}

// Compute content diff - just stores the HTML for client-side diffing
function computeContentDiff(fromHtml: string, toHtml: string): BlockChange['contentDiff'] {
  return { from: fromHtml, to: toHtml };
}

// Compute block-level diff
export function diffBlocks(oldBlocks: Block[], newBlocks: Block[]): BlockChange[] {
  const changes: BlockChange[] = [];
  const oldFlat = extractBlocks(oldBlocks);
  const newFlat = extractBlocks(newBlocks);
  
  // Create maps by signature for matching
  const oldBySignature = new Map<string, BlockWithPath[]>();
  const newBySignature = new Map<string, BlockWithPath[]>();
  
  for (const item of oldFlat) {
    const sig = blockSignature(item.block);
    const list = oldBySignature.get(sig) || [];
    list.push(item);
    oldBySignature.set(sig, list);
  }
  
  for (const item of newFlat) {
    const sig = blockSignature(item.block);
    const list = newBySignature.get(sig) || [];
    list.push(item);
    newBySignature.set(sig, list);
  }
  
  // Track matched blocks
  const matchedOld = new Set<string>();
  const matchedNew = new Set<string>();
  
  // Match by ID first (most reliable)
  const oldById = new Map(oldFlat.map(item => [item.block.id, item]));
  const newById = new Map(newFlat.map(item => [item.block.id, item]));
  
  for (const [id, oldItem] of oldById) {
    const newItem = newById.get(id);
    if (newItem) {
      matchedOld.add(oldItem.path);
      matchedNew.add(newItem.path);
      
      // Check if moved
      if (oldItem.path !== newItem.path) {
        changes.push({
          id,
          action: 'moved',
          type: oldItem.block.type,
          path: newItem.path,
          attributes: { position: { from: oldItem.path, to: newItem.path } },
        });
      }
      
      // Check for modifications
      const attrs = diffAttributes(oldItem.block, newItem.block);
      if (attrs) {
        changes.push({
          id,
          action: 'modified',
          type: newItem.block.type,
          path: newItem.path,
          attributes: attrs,
          contentDiff: oldItem.block.type === 'content' && newItem.block.type === 'content'
            ? computeContentDiff(oldItem.block.text, newItem.block.text)
            : undefined,
        });
      }
    }
  }
  
  // Find removed blocks
  for (const item of oldFlat) {
    if (!matchedOld.has(item.path) && !newById.has(item.block.id)) {
      changes.push({
        id: item.block.id,
        action: 'removed',
        type: item.block.type,
        path: item.path,
      });
    }
  }
  
  // Find added blocks
  for (const item of newFlat) {
    if (!matchedNew.has(item.path) && !oldById.has(item.block.id)) {
      changes.push({
        id: item.block.id,
        action: 'added',
        type: item.block.type,
        path: item.path,
      });
    }
  }
  
  return changes;
}

// Determine change type from diff
export function classifyChanges(
  changes: BlockChange[],
  titleChanged: boolean,
  bannerChanged: boolean
): ChangeType {
  if (changes.length === 0 && !titleChanged && !bannerChanged) return 'none';
  
  // Major: structural changes
  const hasStructural = changes.some(c => 
    c.action === 'added' || c.action === 'removed' || c.action === 'moved'
  );
  if (hasStructural) return 'major';
  
  // Minor: content modifications
  const hasContent = changes.some(c => 
    c.action === 'modified' && (c.contentDiff || c.attributes)
  );
  if (hasContent || titleChanged) return 'minor';
  
  // Patch: metadata only
  if (bannerChanged) return 'patch';
  
  return 'patch';
}

// Generate human-readable summary
export function generateChangeSummary(diff: Omit<RevisionDiff, 'summary'>): string {
  const parts: string[] = [];
  
  if (diff.titleChanged) parts.push('title updated');
  if (diff.bannerChanged) parts.push('banner updated');
  
  const added = diff.changes.filter(c => c.action === 'added');
  const removed = diff.changes.filter(c => c.action === 'removed');
  const modified = diff.changes.filter(c => c.action === 'modified');
  const moved = diff.changes.filter(c => c.action === 'moved');
  
  if (added.length) parts.push(`${added.length} block${added.length > 1 ? 's' : ''} added`);
  if (removed.length) parts.push(`${removed.length} block${removed.length > 1 ? 's' : ''} removed`);
  if (modified.length) parts.push(`${modified.length} block${modified.length > 1 ? 's' : ''} modified`);
  if (moved.length) parts.push(`${moved.length} block${moved.length > 1 ? 's' : ''} reordered`);
  
  return parts.length > 0 ? parts.join(', ') : 'no changes';
}

// Main diff computation
export function computeRevisionDiff(
  currentVersion: string | null,
  oldContent: Block[],
  newContent: Block[],
  oldTitle: string,
  newTitle: string,
  oldBanner: string | null,
  newBanner: string | null
): RevisionDiff {
  const changes = diffBlocks(oldContent, newContent);
  const titleChanged = oldTitle !== newTitle;
  const bannerChanged = oldBanner !== newBanner;
  const changeType = classifyChanges(changes, titleChanged, bannerChanged);
  const version = incrementVersion(parseVersion(currentVersion), changeType);
  
  const partial = { version, changeType, changes, titleChanged, bannerChanged };
  return { ...partial, summary: generateChangeSummary(partial) };
}

// Structural merge for concurrent edits
export interface MergeResult {
  success: boolean;
  content: Block[];
  conflicts: MergeConflict[];
}

export interface MergeConflict {
  path: string;
  base: Block | null;
  ours: Block | null;
  theirs: Block | null;
  resolution?: 'ours' | 'theirs' | 'merged';
}

export function mergeBlockStructures(
  base: Block[],
  ours: Block[],
  theirs: Block[]
): MergeResult {
  const conflicts: MergeConflict[] = [];
  const result: Block[] = [];
  
  // Build maps by ID
  const baseById = new Map(base.map(b => [b.id, b]));
  const oursById = new Map(ours.map(b => [b.id, b]));
  const theirsById = new Map(theirs.map(b => [b.id, b]));
  
  // All unique IDs
  const allIds = new Set([...baseById.keys(), ...oursById.keys(), ...theirsById.keys()]);
  
  // Process each block
  for (const id of allIds) {
    const baseBlock = baseById.get(id);
    const ourBlock = oursById.get(id);
    const theirBlock = theirsById.get(id);
    
    // Added in ours only
    if (!baseBlock && ourBlock && !theirBlock) {
      result.push(ourBlock);
      continue;
    }
    
    // Added in theirs only
    if (!baseBlock && !ourBlock && theirBlock) {
      result.push(theirBlock);
      continue;
    }
    
    // Added in both (conflict)
    if (!baseBlock && ourBlock && theirBlock) {
      conflicts.push({ path: `root.${id}`, base: null, ours: ourBlock, theirs: theirBlock });
      result.push(ourBlock); // Default to ours
      continue;
    }
    
    // Deleted in ours only
    if (baseBlock && !ourBlock && theirBlock) {
      // Check if theirs modified it
      if (blockSignature(baseBlock) !== blockSignature(theirBlock)) {
        conflicts.push({ path: `root.${id}`, base: baseBlock, ours: null, theirs: theirBlock });
      }
      // Default: keep deleted
      continue;
    }
    
    // Deleted in theirs only
    if (baseBlock && ourBlock && !theirBlock) {
      // Check if ours modified it
      if (blockSignature(baseBlock) !== blockSignature(ourBlock)) {
        conflicts.push({ path: `root.${id}`, base: baseBlock, ours: ourBlock, theirs: null });
        result.push(ourBlock); // Keep our modification
      }
      // Default: keep deleted
      continue;
    }
    
    // Modified in both
    if (baseBlock && ourBlock && theirBlock) {
      const baseHash = blockSignature(baseBlock);
      const ourHash = blockSignature(ourBlock);
      const theirHash = blockSignature(theirBlock);
      
      if (ourHash === theirHash) {
        result.push(ourBlock);
      } else if (ourHash === baseHash) {
        result.push(theirBlock); // Only theirs changed
      } else if (theirHash === baseHash) {
        result.push(ourBlock); // Only ours changed
      } else {
        // Both changed differently - conflict
        conflicts.push({ path: `root.${id}`, base: baseBlock, ours: ourBlock, theirs: theirBlock });
        result.push(ourBlock); // Default to ours
      }
    }
  }
  
  // Restore original order (prefer ours)
  const orderedResult = ours.filter(b => result.some(r => r.id === b.id));
  const newInTheirs = result.filter(b => !ours.some(o => o.id === b.id));
  orderedResult.push(...newInTheirs);
  
  return {
    success: conflicts.length === 0,
    content: orderedResult,
    conflicts,
  };
}

// Attribute-aware deep merge for single block
export function mergeBlockAttributes<T extends Block>(base: T, ours: T, theirs: T): T {
  const result = { ...ours } as T;
  
  for (const key of Object.keys(theirs) as (keyof T)[]) {
    if (key === 'id' || key === 'type') continue;
    
    const baseVal = JSON.stringify(base[key]);
    const ourVal = JSON.stringify(ours[key]);
    const theirVal = JSON.stringify(theirs[key]);
    
    // Theirs changed, ours didn't
    if (ourVal === baseVal && theirVal !== baseVal) {
      result[key] = theirs[key];
    }
    // Both changed to same value
    else if (ourVal === theirVal) {
      result[key] = ours[key];
    }
    // Conflict - prefer ours (already set)
  }
  
  return result;
}