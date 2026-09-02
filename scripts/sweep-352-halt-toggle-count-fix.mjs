// scripts/sweep-352-halt-toggle-count-fix.mjs — run 352 correction
//
// The section added earlier this run said Babylon was halted by "roughly a hundred node
// runners". The incident page establishes the opposite of a full set: enough independent
// node runners holding enough cumulative stake each accepted the plan, and some did not,
// with their nodes still up. Replace the count with what is established.

import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/tech/research';
const SLUG = 'hyperscale-rs';
const DRY = process.argv.includes('--dry-run');

const FIND = 'Babylon was halted by roughly a hundred node runners each independently stopping their own machine, which is why';
const REPL = 'Babylon was halted by enough of its node runners each independently stopping their own machine to take staked power below the threshold consensus needs, which is why';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));

  if (blocks.some((b) => (b.text || '').includes(REPL))) { console.log('  already applied – no write'); process.exit(0); }
  const i = blocks.findIndex((b) => (b.text || '').includes(FIND));
  if (i === -1) throw new Error('target sentence not found');
  blocks[i].text = blocks[i].text.replace(FIND, REPL);

  const version = '6.19.1';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  block ${i} corrected`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'patch', AUTHOR_ID,
       'Corrects an unverified count in the new halt-toggle section: the incident page establishes that enough node runners holding enough cumulative stake halted the network and that some did not, so "roughly a hundred" overstates it.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
