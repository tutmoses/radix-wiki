// scripts/sweep-373-two-incidents-distinguished.mjs
//
// The drain page took 517 of the wiki's 1,237 visitors in the week to 5 September
// and the Weft page took 46, while the main Telegram channel spent the week unable
// to agree whether Radix had suffered two exploits or three. Both pages already
// name the other incident; only the Weft page says what separates them. This adds
// that one line to the high-traffic side, so a reader arriving at the drain learns
// the 30 August exploit was a different kind of failure without leaving the page.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/history';
const SLUG = 'hyperlane-asset-drain-2026';
const SENTINEL = 'The two are different in kind';

const ANCHOR = 'whose attacker also left through a Hyperlane warp route.';
const ADDITION =
  ' The two are different in kind, and that difference is most of what a reader ' +
  'needs: the Weft attacker manipulated the price of a listed collateral inside ' +
  'one application’s own contracts, which that application could change and ' +
  'has changed; this one needed no application, no oracle and no price feed, ' +
  'because the authorization it defeated belonged to the engine.';

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
  if (blocks.some((b) => (b.text || '').includes(SENTINEL))) {
    console.log('  already applied - no write');
    process.exit(0);
  }

  const target = blocks.find((b) => (b.text || '').includes(ANCHOR));
  if (!target) throw new Error('anchor sentence not found - inspect before rerunning');
  target.text = target.text.replace(ANCHOR, ANCHOR + ADDITION);

  const version = '2.12.1';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log('  ' + target.text.slice(target.text.indexOf(ANCHOR) - 80, target.text.indexOf(ANCHOR) + ADDITION.length + 60));

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'patch', AUTHOR_ID,
       'Name what separates this incident from the Weft exploit of the previous day. The page already dated the two and shared their exit route; it never said that one turned on a collateral price inside a single application and the other on an engine authorization, which is the question the main Telegram channel spent 5 September arguing over.',
       now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
