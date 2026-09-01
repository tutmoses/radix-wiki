// sweep-346 — /contents/history/hyperlane-asset-drain-2026 printed its date twice
// in the same sidebar: `contents/history` declares a `date` metadata key, which
// BlockRenderer renders as its own table above the infobox block, and the page's
// hand-written facts table opened with a Date row of its own. The metadata row is
// the one that sorts the category (sort: 'newest') and cannot be dropped, so the
// hand-written row goes.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/history';
const SLUG = 'hyperlane-asset-drain-2026';
const DUP_ROW = '<tr><td><strong>Date</strong></td><td>31 August 2026</td></tr>';
const DRY = process.argv.includes('--dry-run');

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);

  const { rows } = await client.query(
    'SELECT id, title, version, metadata, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  if (!page.metadata?.date) throw new Error('metadata.date absent — the hand-written row is the only one, do not remove it');

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (!JSON.stringify(blocks).includes('<strong>Date</strong>')) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  let hit = 0;
  for (const b of blocks) {
    if (b.type !== 'infobox') continue;
    for (const nb of b.blocks ?? []) {
      if (nb.text?.includes(DUP_ROW)) { nb.text = nb.text.replace(DUP_ROW, ''); hit++; }
    }
  }
  if (hit !== 1) throw new Error(`duplicate Date row hit ${hit} times`);

  const version = '2.2.2';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  (metadata.date = ${page.metadata.date} stays)`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'patch', AUTHOR_ID,
       'Removed the hand-written Date row from the infobox table: contents/history declares a date metadata key that BlockRenderer already renders above it, so the sidebar printed the date twice.', now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
