// src/app/[[...path]]/assignee.ts – a `user` metadata value, as the board and the editor read it

/** The JSON a pick stores (`{ id, name, address }`), or a bare name typed before there was a picker. */
export function parseAssignee(raw?: string): { name: string; address: string } | null {
  if (!raw) return null;
  try { const p = JSON.parse(raw); return p.name ? p : null; } catch { return { name: raw, address: '' }; }
}
