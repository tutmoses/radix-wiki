import pg from 'pg';
import { config } from 'dotenv';
import { isLockedPage, meta } from './seed-utils.mjs';
config();

// The History hub had no excerpt, so /contents/history published its first
// sentence as its description: "Dan Hughes began working on what would become
// Radix in 2013 under the name eMunie..." - the article's opening, not an
// account of what the page is.
//
// Metadata only. Content, version and updated_at are untouched and no revision
// row is written: nothing a reader sees on the page changes, and bumping
// updated_at would report a thirteen-year timeline as freshly edited.
const TAG_PATH = 'contents/history';
const SLUG = '';
const DRY = process.argv.includes('--dry-run');

const EXCERPT = 'Radix from Dan Hughes’s 2013 eMunie prototype through Olympia and Babylon to his death in 2025, the 2026 halt, and the composability gap under all of it.';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error('history hub is LOCKED');
  const { rows } = await client.query(
    'SELECT id, title, version, metadata FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('history hub not found');
  const page = rows[0];
  const md = meta(page);

  if (md.excerpt) {
    console.log('  already has an excerpt - no write');
    process.exit(0);
  }
  if (EXCERPT.length > 160) throw new Error(`excerpt is ${EXCERPT.length} chars, over the 160 limit`);

  const metadata = { ...md, excerpt: EXCERPT };
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title} (v${page.version}, unchanged)  excerpt ${EXCERPT.length} chars`);
  console.log(`  ${EXCERPT}`);
  if (!DRY) {
    await client.query('UPDATE pages SET metadata=$1 WHERE id=$2', [JSON.stringify(metadata), page.id]);
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
