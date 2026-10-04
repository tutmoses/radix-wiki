// Sweep 531: /developers/ai-agents/radix-skills recorded its adoption figures as of 29 Aug.
// Re-read 4 Oct 2026: skills.sh shows 14 installs and the same three audits (Gen Agent Trust
// Hub pass, Socket pass, Snyk warn); the GitHub API shows 2 stars, 1 fork, still the two
// 21 June commits and no LICENSE file. One dated sentence appended to Provenance and Caveats.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'developers/ai-agents';
const SLUG = 'radix-skills';
const ANCHOR = 'so the announcement moved the install count by three and the code not at all.';
const SENTINEL = 'Re-read on 4 October 2026';
const ADD = ` ${SENTINEL}: <strong>14 installs</strong>, two stars and one fork, the same three audit results, and still the two June commits and no licence.`;
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
  if (JSON.stringify(blocks).includes(SENTINEL)) { console.log('  already applied – no write'); process.exit(0); }

  const block = blocks.find((b) => b.type === 'content' && b.text?.includes(ANCHOR));
  if (!block) throw new Error('anchor sentence not found');
  block.text = block.text.replace(ANCHOR, ANCHOR + ADD);

  const version = '1.1.3';
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
        'Sweep 531: adoption figures re-read 4 October 2026 – skills.sh 14 installs (9 on 29 Aug), same three audit results; GitHub 2 stars, 1 fork, still the two 21 June commits and no LICENSE file.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
