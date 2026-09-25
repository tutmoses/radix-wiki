// sweep 487: Hyperlane Asset Drain – "The trapped USDC" states that the Foundation will not reopen
// the Hyperlane routes until the collateral is secured, citing nothing. The Foundation's own
// announcement of temperature check #7 (t.me/RadixAnnouncements/2781, 11:30 UTC 22 September 2026)
// says it; this links the sentence to it. The rest of the section was checked against the
// announcement and agrees with it.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'contents/history';
const SLUG = 'hyperlane-asset-drain-2026';
const SENTINEL = 't.me/RadixAnnouncements/2781';
const FROM = 'It will not reopen the Hyperlane routes until the assets are secured.';
const TO = `It <a href="https://${SENTINEL}" target="_blank" rel="noopener">will not reopen the Hyperlane routes</a> until the assets are secured.`;

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
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied – no write');
    process.exit(0);
  }

  const block = blocks.find((b) => b.text?.includes('id="the-trapped-usdc"'));
  if (!block?.text.includes(FROM)) throw new Error('anchor not found');
  block.text = block.text.replace(FROM, TO);

  const version = '3.4.1';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'patch', AUTHOR_ID,
        'The trapped USDC: the statement that the Foundation will not reopen the Hyperlane routes until the collateral is secured now cites its source, the Foundation announcement of temperature check #7 (t.me/RadixAnnouncements/2781, 22 Sep). Section otherwise checked against it and unchanged.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
