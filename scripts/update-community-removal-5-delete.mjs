// Deletes the Community section. Revisions, comments and notifications cascade
// from the page row, so this is not recoverable from the database afterwards.
// Everything that linked into the section was rewritten by scripts 1-4 first.

import pg from 'pg';
import { config } from 'dotenv';
import { isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  // Refuse to run while anything still points into the section.
  const { rows: linkers } = await client.query(
    `SELECT tag_path, slug FROM pages WHERE tag_path <> 'community' AND content::text LIKE '%href=\\"/community%'`);
  if (linkers.length) {
    throw new Error(`${linkers.length} page(s) still link into /community — run script 3 first: ` +
      linkers.map((p) => `${p.tag_path}/${p.slug}`).join(', '));
  }

  const { rows } = await client.query(
    `SELECT p.id, p.slug, p.title,
            (SELECT count(*) FROM revisions r WHERE r.page_id = p.id) AS revisions,
            (SELECT count(*) FROM comments c WHERE c.page_id = p.id) AS comments
       FROM pages p WHERE p.tag_path = 'community' ORDER BY p.slug`);
  if (!rows.length) { console.log('  nothing left under community — already deleted'); process.exit(0); }

  let revs = 0, cmts = 0;
  for (const r of rows) {
    if (isLockedPage('community', r.slug)) throw new Error(`community/${r.slug} is LOCKED`);
    revs += Number(r.revisions); cmts += Number(r.comments);
    console.log(`  ${DRY ? '[dry] ' : ''}delete community/${r.slug || '(hub)'} — ${r.title} (${r.revisions} revisions, ${r.comments} comments)`);
  }
  console.log(`\n  ${rows.length} pages, ${revs} revisions, ${cmts} comments`);

  if (DRY) { console.log('\ndry run complete — nothing deleted'); process.exit(0); }
  const { rowCount } = await client.query(`DELETE FROM pages WHERE tag_path = 'community'`);
  console.log(`\ndeleted ${rowCount} pages`);
} finally {
  client.release();
  await pool.end();
}
