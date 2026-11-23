// src/lib/checklist.ts – a page's tick-box lists counted, for the Ideas board, the card and MCP

export type Progress = { done: number; total: number };

const ITEM = /<li\b[^>]*\bdata-type="taskItem"[^>]*>/g;

/** Every HTML string in a block tree: content blocks, and the blocks nested in columns or an infobox. */
function htmlOf(node: unknown): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(htmlOf).join('');
  if (node && typeof node === 'object') return Object.values(node).map(htmlOf).join('');
  return '';
}

/** How many of a page's tick-box items are ticked; null for a page with none. */
export function checklistProgress(content: unknown): Progress | null {
  const items = htmlOf(content).match(ITEM) ?? [];
  return items.length ? { done: items.filter(li => li.includes('data-checked="true"')).length, total: items.length } : null;
}

/** "3 of 5 done" */
export const progressLabel = ({ done, total }: Progress) => `${done} of ${total} done`;
