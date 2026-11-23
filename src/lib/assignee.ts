// src/lib/assignee.ts – a `user` metadata value, read once for the board, the editor, the infobox, MCP and JSON-LD

/**
 * Nobody; a member picked from the user search, stored as the JSON the picker
 * writes (`{ id, name, address }`); or a name typed before there was a picker.
 */
type Assignee =
  | { kind: 'none' }
  | { kind: 'member'; id: string; name: string; address: string }
  | { kind: 'named'; name: string };

export function readAssignee(raw: unknown): Assignee {
  if (typeof raw !== 'string' || !raw.trim()) return { kind: 'none' };
  const text = raw.trim();
  // Only an object is a pick: a typed name such as "42" parses as JSON too.
  if (!text.startsWith('{')) return { kind: 'named', name: text };
  try {
    const pick = JSON.parse(text) as { id?: unknown; name?: unknown; address?: unknown };
    return typeof pick?.name === 'string' && pick.name.trim()
      ? { kind: 'member', id: typeof pick.id === 'string' ? pick.id : '', name: pick.name.trim(), address: typeof pick.address === 'string' ? pick.address : '' }
      : { kind: 'none' };
  } catch {
    return { kind: 'none' };
  }
}

/** The name to print, or null for nobody. */
export const assigneeName = (raw: unknown): string | null => {
  const a = readAssignee(raw);
  return a.kind === 'none' ? null : a.name;
};
