// Run 399. The infobox lesson banked at run 393: a body edit that changes a fact named in
// the facts table is not finished until the row changes too. babylon-node v1.4.0.0 shipped
// final at 03:59:09 UTC on 10 September, so this page's "Latest node release" row - which
// names the RC1 pre-release and says the repository's latest still resolves to
// v1.3.0.5-test.1 - is wrong on both halves.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/tech/releases';
const SLUG = 'protocol-updates';
const SENTINEL = 'releases/tag/v1.4.0.0"';
const DRY = process.argv.includes('--dry-run');

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

const row = (text, label) => {
  const i = text.indexOf(`<tr><th>${label}</th>`);
  if (i < 0) throw new Error(`row not found: ${label}`);
  const j = text.indexOf('</tr>', i);
  if (j < 0) throw new Error(`row unterminated: ${label}`);
  return [i, j];
};

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) { console.log('  already applied - no write'); process.exit(0); }

  const box = blocks.find((b) => b.type === 'infobox');
  const table = box?.blocks?.find((b) => b.text?.includes('Latest node release'));
  if (!table) throw new Error('infobox table not found');

  let [a, b] = row(table.text, 'Latest node release');
  table.text = table.text.slice(0, a)
    + '<tr><th>Latest node release</th><td><a href="https://github.com/radixdlt/babylon-node/releases/tag/v1.4.0.0" target="_blank" rel="noopener">v1.4.0.0</a>, 10 September 2026, the final Eagle Ray release; it tags the same commit as the v1.4.0.0-RC1 candidate of 8 September and carries no pre-release flag, so the repository&rsquo;s <a href="https://api.github.com/repos/radixdlt/babylon-node/releases/latest" target="_blank" rel="noopener">latest release</a> now resolves to it</td>'
    + table.text.slice(b);

  [a, b] = row(table.text, 'Released, not enacted');
  table.text = table.text.slice(0, a)
    + '<tr><th>Released, not enacted</th><td>Eagle Ray &ndash; candidate 8 September 2026, final release 10 September, configured to enact at epoch 339,898. Dugong carries no trigger on any network</td>'
    + table.text.slice(b);

  const version = '1.7.1';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'patch', AUTHOR_ID,
       'Infobox: the final Eagle Ray node release, v1.4.0.0, was published at 03:59:09 UTC on 10 September against the same commit as the candidate, so the Latest node release row no longer names a pre-release and the repository latest no longer resolves to v1.3.0.5-test.1.',
       now]);
    await client.query('COMMIT');
    console.log('  committed');
  }
} finally {
  client.release();
  await pool.end();
}
