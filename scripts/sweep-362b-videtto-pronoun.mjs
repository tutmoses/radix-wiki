// Sweep 362, follow-up patch. Michael Videtto's pronouns are not stated in any source this
// run loaded, so the sentence introduced by sweep-362 should not carry one.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const OLD = `during the USDA stablecoin period in 2023; he is not listed on the team page.`;
const NEW = `during the USDA stablecoin period in 2023, and does not appear on the team page.`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();
try {
  if (isLockedPage('ecosystem', 'astrolescent')) throw new Error('LOCKED');
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path=$1 AND slug=$2', ['ecosystem', 'astrolescent']);
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes('does not appear on the team page')) { console.log('  already applied'); process.exit(0); }
  const i = blocks.findIndex((b) => (b.text || '').includes(OLD));
  if (i < 0) throw new Error('find-string not found');
  blocks[i].text = blocks[i].text.replace(OLD, NEW);
  const version = '3.3.1';
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
       'Overview: drop a pronoun for Michael Videtto that no loaded source states.', now]);
    await client.query('COMMIT');
  }
} finally { client.release(); await pool.end(); }
