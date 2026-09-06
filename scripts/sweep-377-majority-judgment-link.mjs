// scripts/sweep-377-majority-judgment-link.mjs
//
// Run 377. /contents/tech/core-concepts/majority-judgment was created this run.
// Radix Governance is the page that most needs to point at it: it is where the
// method is named, and until now a reader met "Majority Judgment is deployed,
// not merely drafted" with nowhere to go and find out what it is.
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/tech/core-concepts';
const SLUG = 'radix-governance';
const SENTINEL = '/contents/tech/core-concepts/majority-judgment';

const FIND = '<p><strong>Majority Judgment is deployed, not merely drafted.</strong>';
const REPLACE =
  '<p><strong><a href="/contents/tech/core-concepts/majority-judgment" class="link">Majority Judgment</a> is deployed, not merely drafted.</strong>';

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
  if (blocks.some((b) => typeof b.text === 'string' && b.text.includes(SENTINEL))) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  const at = blocks.findIndex((b) => typeof b.text === 'string' && b.text.includes(FIND));
  if (at < 0) throw new Error('anchor not found — check for U+00A0 or a rewritten block');
  blocks[at] = { ...blocks[at], text: blocks[at].text.replace(FIND, REPLACE) };

  const version = '1.9.2';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  (block ${at})`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'patch', AUTHOR_ID,
       'Link the first mention of Majority Judgment to its own article, created this run at /contents/tech/core-concepts/majority-judgment.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
