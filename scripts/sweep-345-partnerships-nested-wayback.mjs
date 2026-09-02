// Run 345, contents/history rotation. The run-342 Argent repair wrapped a new Wayback
// snapshot around the OLD Wayback URL instead of replacing it, leaving
//   web.archive.org/web/20221205182845/https://web.archive.org/web/20251008090415/https://www.radixdlt.com/blog/...
// which 404s. The single-wrapped 2025 snapshot returns 200 (91,027 bytes, probed
// 2026-09-01 03:0x UTC). Unwrap it.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/history';
const SLUG = 'partnerships';
const BAD = 'https://web.archive.org/web/20221205182845/https://web.archive.org/web/20251008090415/https://www.radixdlt.com/blog/radix-partners-with-argent-the-worlds-easiest-to-use-defi-wallet';
const GOOD = 'https://web.archive.org/web/20251008090415/https://www.radixdlt.com/blog/radix-partners-with-argent-the-worlds-easiest-to-use-defi-wallet';

const DRY = process.argv.includes('--dry-run');
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  let hits = 0;
  for (const b of blocks) {
    if (typeof b.text === 'string' && b.text.includes(BAD)) {
      b.text = b.text.split(BAD).join(GOOD);
      hits++;
    }
  }
  if (!hits) {
    console.log('  no nested Wayback URL found - already applied, no write');
    process.exit(0);
  }

  const version = '1.2.2';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  (${hits} block(s))`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'patch', AUTHOR_ID,
       'Unwrap the Argent partnership citation. The run-342 repair nested the new Wayback snapshot inside the old one; the doubled URL 404s and the single 2026-10 snapshot returns 200.', now]);
    await client.query('COMMIT');
    console.log('  committed');
  }
} finally {
  client.release();
  await pool.end();
}
