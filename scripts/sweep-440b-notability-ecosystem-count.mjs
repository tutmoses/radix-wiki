// sweep 440b - policy rotation, the second dated figure in the category.
//
// /policy/notability says 113 of the 150 Ecosystem pages arrived in the
// 6 February 2026 bulk import. The 113 is unchanged, re-counted against the
// pages table on 16 September 2026; the denominator is now 151, one page having
// been added to the section since the 8 September count. Counts exclude the
// category hub at the empty slug, as the run-437 count did.
//
//   node scripts/sweep-440b-notability-ecosystem-count.mjs --dry-run

import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, withClient } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'policy';
const SLUG = 'notability';
const OLD = '113 of the 150 <a href="/ecosystem" class="link">Ecosystem</a> pages';
const NEW = '113 of the 151 <a href="/ecosystem" class="link">Ecosystem</a> pages';

await withClient(async (client) => {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);

  // Re-count rather than trust the constant, and refuse to write a figure the
  // database does not support.
  const c = await client.query(
    `SELECT count(*) FILTER (WHERE slug <> '') total,
            count(*) FILTER (WHERE slug <> '' AND created_at::date = '2026-02-06') imported
     FROM pages WHERE tag_path = 'ecosystem'`);
  const { total, imported } = c.rows[0];
  console.log(`  ecosystem: ${imported} of ${total} created 2026-02-06`);
  if (Number(total) !== 151 || Number(imported) !== 113)
    throw new Error(`census moved again (${imported} of ${total}) - rewrite the sentence, do not run this script`);

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (blocks.some((b) => b.text?.includes(NEW))) {
    console.log('  already applied - no write');
    return;
  }
  const i = blocks.findIndex((b) => b.text?.includes(OLD));
  if (i < 0) throw new Error('census sentence not found - inspect the stored HTML before rewriting');
  blocks[i] = { ...blocks[i], text: blocks[i].text.replace(OLD, NEW) };

  const version = '1.3.3';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  block ${i}`);
  if (DRY) return;

  const now = new Date().toISOString();
  const json = JSON.stringify(blocks);
  await client.query('BEGIN');
  await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
    [json, version, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, version, 'patch', AUTHOR_ID,
     'Bulk-import census re-counted against the database on 16 September 2026: 113 of the 151 Ecosystem articles were created on 6 February 2026, not 113 of 150. The imported count is unchanged and the section has gained one page since 8 September. The hub article at the empty slug is excluded.',
     now]);
  await client.query('COMMIT');
  console.log('  written and stamped');
});
