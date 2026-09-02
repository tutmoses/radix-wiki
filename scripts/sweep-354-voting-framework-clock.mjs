import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'ideas';
const SLUG = 'dao-proposal-voting-framework';
const SENTINEL = 'RadixAccountabilityCouncil/958';
const DRY = process.argv.includes('--dry-run');

const FIND = 'and has been in its seven-day Discussion phase since 30 August 2026. It is not in force.';
const REPLACE = 'and has been in its Discussion phase since 30 August 2026. That phase was announced with a seven-day limit that would have closed it on 6 September; at 13:49&nbsp;UTC on <strong>2 September 2026</strong> the Transition RAC <a href="https://t.me/RadixAccountabilityCouncil/958" target="_blank" rel="noopener">removed the limit</a>, on the ground that <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">the halted network</a> offers no technical conditions to move to a Temperature Check or a ballot, and the discussion now runs for as long as it is needed. It is not in force.';

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
  const flat = (b) => b.text || (b.blocks || []).map((x) => x.text || '').join('');
  if (blocks.some((b) => flat(b).includes(SENTINEL))) {
    console.log('  already applied, no write');
    process.exit(0);
  }

  const target = blocks.find((b) => (b.text || '').includes(FIND));
  if (!target) throw new Error('find string did not match; inspect codepoints before retrying');
  target.text = target.text.replace(FIND, REPLACE);

  const version = '2.1.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  replacement present: ${target.text.includes('removed the limit')}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'The card said the framework was in a seven-day Discussion phase. The Transition RAC removed the seven days at 13:49 UTC on 2 September 2026 (t.me/RadixAccountabilityCouncil/958) because the halted network cannot hold a vote, so the phase now has no closing date.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
