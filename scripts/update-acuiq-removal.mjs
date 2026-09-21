// Removes AcuiQ from the wiki. It was listed as a project of a Radix-ecosystem
// team, but nothing about it is on Radix: no component, no token, no wallet
// integration — its own page said so under "Relationship to Radix".
//
// Order matters. The operational-status index is rewritten first, then the page
// row is deleted; the delete refuses while anything still links to it. Revisions
// and notifications cascade from the page row, so the delete is not recoverable.

import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG = 'ecosystem';
const SLUG = 'acuiq';
const HREF = '/ecosystem/acuiq';
const INDEX = ['contents/resources', 'radix-ecosystem-operational-status'];

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

const replaceOnce = (haystack, needle, replacement) => {
  if (!haystack.includes(needle)) throw new Error(`not found: ${needle.slice(0, 60)}`);
  return haystack.replace(needle, replacement);
};

try {
  if (isLockedPage(TAG, SLUG)) throw new Error(`${TAG}/${SLUG} is LOCKED`);

  // ---- 1. the operational-status index -------------------------------------
  const { rows: idxRows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', INDEX);
  if (!idxRows.length) throw new Error('operational-status index not found');
  const index = idxRows[0];

  if (JSON.stringify(index.content).includes(HREF)) {
    const blocks = JSON.parse(JSON.stringify(index.content));
    const listing = blocks.find((b) => typeof b.text === 'string' && b.text.includes(HREF));
    if (!listing) throw new Error('index link is not in a top-level content block');

    // AcuiQ is the only Healthcare entry, so the heading goes with it.
    const section = '<h3>Healthcare</h3>\n<ul>\n<li><a href="/ecosystem/acuiq" rel="noopener">AcuiQ</a></li>\n</ul>\n';
    listing.text = replaceOnce(listing.text, section, '');
    listing.text = replaceOnce(listing.text, '<h2>Operational (58)</h2>', '<h2>Operational (57)</h2>');
    if (listing.text.includes('acuiq')) throw new Error('a second AcuiQ reference survived the listing rewrite');
    const li = (listing.text.match(/<li>/g) || []).length;
    if (li !== 57) throw new Error(`listing holds ${li} entries, expected 57`);

    const infobox = blocks[0]?.blocks?.[0];
    if (!infobox) throw new Error('infobox block missing');
    infobox.text = replaceOnce(infobox.text, 'All 150 project pages', 'All 149 project pages');
    infobox.text = replaceOnce(infobox.text,
      '<tr><td><strong>Operational</strong></td><td>58</td></tr>',
      '<tr><td><strong>Operational</strong></td><td>57</td></tr>');

    const version = '1.21.2';
    console.log(`  ${DRY ? '[dry] ' : ''}${index.title}  v${index.version} -> v${version}  (Healthcare row removed, 58 -> 57, 150 -> 149)`);
    if (!DRY) {
      const now = new Date().toISOString();
      const json = JSON.stringify(blocks);
      await client.query('BEGIN');
      await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, version, now, index.id]);
      await client.query(
        `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [cuid(), index.id, json, index.title, version, 'patch', AUTHOR_ID,
         'AcuiQ leaves the wiki: it is a conventional web application with no Radix component, token or wallet integration, so the index drops the Healthcare row it was the only member of and the operational count falls to 57.', now]);
      await client.query('COMMIT');
    }
  } else {
    console.log('  index already free of AcuiQ — no write');
  }

  // ---- 2. the page itself --------------------------------------------------
  const { rows } = await client.query(
    `SELECT p.id, p.title, p.version,
            (SELECT count(*) FROM revisions r WHERE r.page_id = p.id) AS revisions,
            (SELECT count(*) FROM comments c WHERE c.page_id = p.id) AS comments,
            (SELECT count(*) FROM notifications n WHERE n.page_id = p.id) AS notifications
       FROM pages p WHERE p.tag_path = $1 AND p.slug = $2`, [TAG, SLUG]);
  if (!rows.length) { console.log(`  ${TAG}/${SLUG} already gone`); process.exit(0); }
  const page = rows[0];

  const { rows: linkers } = await client.query(
    `SELECT tag_path, slug FROM pages WHERE NOT (tag_path = $1 AND slug = $2) AND content::text LIKE $3`,
    [TAG, SLUG, `%href=\\"${HREF}%`]);
  if (linkers.length && !DRY) {
    throw new Error(`still linked from: ${linkers.map((p) => `${p.tag_path}/${p.slug}`).join(', ')}`);
  }
  if (linkers.length) console.log(`  [dry] would still be linked from: ${linkers.map((p) => `${p.tag_path}/${p.slug}`).join(', ')} (rewritten above, not yet written)`);

  console.log(`  ${DRY ? '[dry] ' : ''}delete ${TAG}/${SLUG} — ${page.title} v${page.version} ` +
    `(${page.revisions} revisions, ${page.comments} comments, ${page.notifications} notifications cascade)`);
  if (DRY) { console.log('\ndry run complete — nothing written'); process.exit(0); }
  await client.query('DELETE FROM pages WHERE id = $1', [page.id]);
  console.log('\ndone');
} finally {
  client.release();
  await pool.end();
}
