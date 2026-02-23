// src/lib/identicon.ts — Deterministic 5x5 mirrored identicon from address hash

import { hashStr, seededRandom } from '@/lib/utils';

export function generateIdenticon(address: string): { cells: boolean[]; fg: string; bg: string } {
  const h = hashStr(address);
  const cells: boolean[] = [];
  for (let i = 0; i < 15; i++) cells.push(((h >> (i % 30)) & 1) === 1);
  const rand = seededRandom(h);
  const hue = Math.floor(rand() * 360);
  return { cells, fg: `hsl(${hue}, 65%, 65%)`, bg: `hsl(${hue}, 25%, 20%)` };
}
