// sweep-364 (patch): date the threshold crossing rather than approximating it.
// /policy/freshness already carries 24 September 2026 for the same page; this
// page said "about three weeks", which is the same fact stated less usefully.
// xrd-domains effective date 2026-03-28T15:56:48Z + 180 days = 2026-09-24.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'policy';
const SLUG = 'editorial-notices';
const FROM = 'which leaves it about three weeks before it raises the notice by itself.';
const TO = 'so it raises the notice by itself on <strong>24 September 2026</strong> unless someone acts first.';
const DRY = process.argv.includes('--dry-run');

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes('24 September 2026')) { console.log('  already applied — no write'); process.exit(0); }

  const idx = blocks.findIndex((b) => typeof b.text === 'string' && b.text.includes(FROM));
  if (idx === -1) throw new Error('find-string not present, aborting');
  blocks[idx].text = blocks[idx].text.replace(FROM, TO);

  const version = '1.1.1';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  (block ${idx})`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'patch', AUTHOR_ID,
       'Give the date the first outdated notice fires (24 September 2026, from xrd-domains at 2026-03-28T15:56:48Z + 180 days) instead of "about three weeks", matching /policy/freshness.', now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally { client.release(); await pool.end(); }
