// scripts/sweep-361-merge-where-to-start.mjs
//
// "Where to start" and "The route to mastery" said the same thing twice — a
// hundred words of prose enumerating the seven sections, then a figure drawing
// them. seed-infographics now owns the merged section (heading "Where to start",
// a four-line lead, and the clickable map), so the standalone prose block goes.
//
// Its links are not lost: the lead carries Installing Scrypto, Stokenet,
// manifests and the wallet, and every section link is now a box in the figure.

import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG = 'developers';
const OLD_HEADING = '<h2>Where to start</h2>';
const FIGURE_MARKER = 'data-graphic="radix-developer-path"';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG, '')) throw new Error('developers hub is LOCKED');
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG, '']);
  if (!rows.length) throw new Error('developers hub not found');
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));

  const isFigure = (b) => b.type === 'content' && typeof b.text === 'string' && b.text.includes(FIGURE_MARKER);
  const merged = blocks.find(isFigure);
  if (!merged) throw new Error('merged figure block not found — run seed-infographics.mjs first');
  if (!merged.text.includes(OLD_HEADING)) throw new Error('the figure block does not carry the "Where to start" heading');

  // The block to drop is the one carrying that heading which is NOT the figure.
  const stale = blocks.filter((b) => b.type === 'content' && typeof b.text === 'string'
    && b.text.includes(OLD_HEADING) && !isFigure(b));
  if (!stale.length) {
    console.log('  already merged — no write');
    process.exit(0);
  }
  if (stale.length > 1) throw new Error(`${stale.length} stale "Where to start" blocks, expected 1`);

  const kept = blocks.filter((b) => b !== stale[0]);
  const version = '3.0.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  ${blocks.length} -> ${kept.length} blocks`);
  console.log(`  ${DRY ? '[dry] ' : ''}dropped ${stale[0].text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90)}…`);
  if (DRY) process.exit(0);

  const now = new Date().toISOString();
  const json = JSON.stringify(kept);
  await client.query('BEGIN');
  await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, version, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, version, 'major', AUTHOR_ID,
     'Merge "Where to start" into "The route to mastery": one section, a four-line lead and the clickable path map, replacing a prose enumeration of the same seven sections.', now]);
  await client.query('COMMIT');
  console.log('  committed');
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
