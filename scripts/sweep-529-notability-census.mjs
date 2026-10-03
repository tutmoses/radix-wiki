// Sweep 529: /policy/notability's bulk-import census said "113 of the 151 Ecosystem
// pages" (counted 16 Sep). Re-counted against the database 3 Oct 2026: 152 Ecosystem
// articles (153 rows less the hub at the empty slug), 113 of them created 6 Feb 2026.
// The two since are apollo-pool and radix-arena (20 Sep). The count now carries its date.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'policy';
const SLUG = 'notability';
const FROM = '113 of the 151 <a href="/ecosystem" class="link">Ecosystem</a> pages arrived';
const TO = '113 of the 152 <a href="/ecosystem" class="link">Ecosystem</a> pages (counted 3 October 2026) arrived';
const DRY = process.argv.includes('--dry-run');

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();
try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query('SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes('(counted 3 October 2026)')) { console.log('  already applied – no write'); process.exit(0); }

  const block = blocks.find((b) => b.type === 'content' && b.text?.includes(FROM));
  if (!block) throw new Error('census sentence not found');
  block.text = block.text.replace(FROM, TO);

  const version = '1.3.4';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'patch', AUTHOR_ID,
        'Sweep 529: bulk-import census re-counted against the database on 3 October 2026: 113 of the 152 Ecosystem articles were created on 6 February 2026 (apollo-pool and radix-arena added 20 Sep). The count now carries its date.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
