// Run 327, contents/tech rotation. /contents/tech/core-concepts/badges cited
// https://docs.radixdlt.com/docs/access-rules, which returns HTTP 404 (10,050 B
// Docusaurus 404 shell) on 29 Aug 2026. The live equivalent is
// /docs/advanced-accessrules — 200, 124,614 B, <h1>Advanced AccessRules</h1>,
// docs-doc-id build/authorization/... — the same doc under its current path.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/tech/core-concepts';
const SLUG = 'badges';
const DEAD = 'https://docs.radixdlt.com/docs/access-rules';
const LIVE = 'https://docs.radixdlt.com/docs/advanced-accessrules';
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
  const before = JSON.stringify(blocks);
  if (before.includes(LIVE)) { console.log('  already applied — no write'); process.exit(0); }
  if (!before.includes(DEAD)) { console.log('  dead URL not present — no write'); process.exit(0); }

  let hits = 0;
  for (const b of blocks) {
    if (b.type !== 'content' || typeof b.text !== 'string') continue;
    if (!b.text.includes(DEAD)) continue;
    hits += b.text.split(DEAD).length - 1;
    b.text = b.text
      .split(`href="${DEAD}" target="_blank" rel="noopener">Radix Docs: Access rules<`)
      .join(`href="${LIVE}" target="_blank" rel="noopener">Radix Docs: Advanced AccessRules<`)
      .split(DEAD).join(LIVE);
  }

  const version = '2.0.1';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  (${hits} occurrence(s) repointed)`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'patch', AUTHOR_ID,
       'Repoint the dead Radix Docs access-rules citation. docs.radixdlt.com/docs/access-rules returns 404; the same document is live at /docs/advanced-accessrules ("Advanced AccessRules").', now]);
    await client.query('COMMIT');
    console.log('  committed');
  }
} finally {
  client.release();
  await pool.end();
}
