// The maintenance log is rendered from metadata.state, so the retirement has to
// be recorded there or the next sweep writes the stale text back. Two things go:
// the rotation slot for a section that will not exist, and two backlog items
// about pages that are being deleted — including the run-232 human flag, which
// the deletion answers.

import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  const { rows } = await client.query(
    `SELECT id, title, version, metadata FROM pages
      WHERE tag_path = 'contents/tech/operations' AND slug = 'wiki-maintenance-log'`);
  if (!rows.length) throw new Error('maintenance log not found');
  const page = rows[0];
  const metadata = JSON.parse(JSON.stringify(page.metadata ?? {}));
  const state = metadata.state ?? {};

  const NOTE = 'The Community section was retired on 9 September 2026';
  if (JSON.stringify(state).includes(NOTE)) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  // The rotation must stop visiting a section that has no pages.
  const before = [...(state.rotation?.order ?? [])];
  state.rotation.order = before.filter((s) => s !== 'community');
  if (state.rotation.next === 'community') state.rotation.next = state.rotation.order[0];
  console.log(`  rotation: ${before.length} slots -> ${state.rotation.order.length} (next: ${state.rotation.next})`);

  // Two backlog items are about pages that are going away.
  const stale = (state.backlog ?? []).filter((e) => JSON.stringify(e).includes('/community/'));
  state.backlog = (state.backlog ?? []).filter((e) => !JSON.stringify(e).includes('/community/'));
  console.log(`  backlog: dropped ${stale.length} stale item${stale.length === 1 ? '' : 's'}`);
  state.backlog.unshift({
    date: '2026-09-09',
    item: `${NOTE}. All twelve profiles and the section hub were deleted, the tag node removed from src/lib/tags.ts, and the rotation slot dropped. The Dan Hughes biography moved to /contents/history/dan-hughes and keeps its history. Two facts that only lived on a profile were folded onto the pages that had deferred to them: the governance quorum recomputation onto /contents/tech/core-concepts/radix-governance, and the validator-badge concentration plus the $4,000 funding proposal onto /contents/tech/releases/stokenet. This closes the run-232 FLAG FOR A HUMAN on /community/cryptoants, which was the last auth-route shell. No page on the wiki links into /community any more; names that were linked are now plain text.`,
  });

  metadata.state = state;
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} (metadata only)`);
  if (!DRY) {
    const now = new Date().toISOString();
    await client.query('UPDATE pages SET metadata = $1, updated_at = $2 WHERE id = $3',
      [JSON.stringify(metadata), now, page.id]);
    console.log('  state written — run `node scripts/maintenance-log.mjs compact` to re-render the page');
  }
} finally {
  client.release();
  await pool.end();
}
