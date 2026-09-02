// The incident page rendered "RSwap" over a link to /ecosystem/reddicks, the DCKS
// token page, in the list of front ends that answered 200 during the halt. The DEX
// now has its own page. Last of the four such anchors found this run.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/history';
const SLUG = 'hyperlane-asset-drain-2026';
const FROM = '<a href="/ecosystem/reddicks" rel="noopener">RSwap</a>';
const TO = '<a href="/ecosystem/rswap" rel="noopener">RSwap</a>';

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

  if (JSON.stringify(page.content).includes('/ecosystem/rswap')) {
    console.log('  already applied - no write');
    process.exit(0);
  }

  const blocks = JSON.parse(JSON.stringify(page.content));
  let hits = 0;
  for (const b of blocks) {
    if (typeof b.text === 'string' && b.text.includes(FROM)) { b.text = b.text.split(FROM).join(TO); hits++; }
  }
  if (!hits) { console.log('  anchor not found verbatim - no write'); process.exit(0); }

  // version is read live: another sweep bumped this page mid-run, so derive rather than hard-code
  const [maj, min, pat] = page.version.split('.').map(Number);
  const version = `${maj}.${min}.${pat + 1}`;
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
       'Point the RSwap mention at /ecosystem/rswap. It rendered the DEX’s name over a link to the DCKS token page.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
