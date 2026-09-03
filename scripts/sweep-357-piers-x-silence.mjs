import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

// Run 357, community rotation staleness head (the true head, /community/cryptoants, is the standing
// FLAG FOR A HUMAN auth-route shell and cannot be edited by this routine). This page carried an
// undated "He remains active on X" claim. Measured 3 September 2026 with X recent search, which the
// same call proves returns replies as well as originals (a control query on another account returned
// 40 posts over the identical seven-day window, replies included):
//   from:PiersRidyard -> 0 results, window 27 August to 3 September 2026
// The window contains the Hyperlane asset drain and the whole of the network halt to date.

const TAG_PATH = 'community';
const SLUG = 'piers-ridyard';
const VERSION = '1.0.1';
const SENTINEL = 'returned no post from the account';
const BLOCK_ID = '5665ae61-37d0-479f-ae34-252ef8511d8c';

const OLD = 'He remains active on X as <a href="https://x.com/PiersRidyard" target="_blank" rel="noopener">@PiersRidyard</a>, where he posts about the Radix ecosystem.</p>';
const NEW = 'His X account, <a href="https://x.com/PiersRidyard" target="_blank" rel="noopener">@PiersRidyard</a>, remains open and has carried his commentary on the Radix ecosystem. A search of the account on <strong>3 September 2026</strong> returned no post from the account, reply or original, in the preceding seven days. That window contains the <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">Hyperlane asset drain of 31 August 2026</a> and every day of the network halt that followed it, on which he has made no public comment.</p>';

const MESSAGE = 'Dates an undated claim. "He remains active on X" is replaced by the measurement behind it: a search of @PiersRidyard on 3 September 2026 returns no post, reply or original, in the preceding seven days, a window that contains the Hyperlane asset drain and the whole of the network halt to date. The same query shape returns replies as well as originals on a control account over the identical window, so the silence is a reading rather than an artefact of the index.';

const DRY = process.argv.includes('--dry-run');
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  for (const [label, s] of [['NEW', NEW], ['MESSAGE', MESSAGE]]) {
    if (s.includes(' ')) throw new Error(`${label} carries a literal U+00A0`);
    if (s.includes('—')) throw new Error(`${label} carries an em dash`);
  }
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${TAG_PATH}/${SLUG} is LOCKED`);

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) { console.log('  already applied - no write'); process.exit(0); }

  const target = blocks.find((b) => b.id === BLOCK_ID);
  if (!target) throw new Error('other-activity block not found by id');
  if (!target.text.includes(OLD)) throw new Error('find-string did not match');
  target.text = target.text.replace(OLD, NEW);

  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${VERSION}  1 substitution in block ${BLOCK_ID.slice(0, 8)}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, VERSION, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, VERSION, 'patch', AUTHOR_ID, MESSAGE, now]);
    await client.query('COMMIT');
    console.log('    written');
  }
} finally {
  client.release();
  await pool.end();
}
