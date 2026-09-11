/**
 * sweep 412b — the Ecosystem hub's infobox was a frozen copy of the facet bar.
 *
 * Sweep 412 cut the article to a lead and one section, which left the infobox
 * as the tallest thing above the listing: 754px of a 375px-wide screen, where
 * the first card sat 1,841px down. Four of its six rows are already on the page
 * and always current, so they were height spent on duplicates:
 *   - "Pages 150" is the results bar, which reads "The following 150 pages are
 *     in Ecosystem"
 *   - "By status" and "Largest categories" are the Status and Category facet
 *     groups, which carry the same counts derived per request (58/50/34/4/2/1/1
 *     and Finance 38, Staking 23, Infrastructure 17 when read during this run)
 *
 * Keeps the three rows nothing else on the page states: the scope, the status
 * index, and the network the directory's entries run on.
 *
 * Run:  node scripts/sweep-412b-ecosystem-hub-infobox.mjs [--dry-run]
 */
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ecosystem';
const SLUG = '';
const SENTINEL = '<tr><td><strong>Pages</strong></td>';   // the row this edit removes

const INFOBOX = `<table><tbody>` +
  `<tr><th colspan="2">Radix Ecosystem</th></tr>` +
  `<tr><td><strong>Scope</strong></td><td>Projects built on, or serving, <a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix</a></td></tr>` +
  `<tr><td><strong>Status index</strong></td><td><a href="/contents/resources/radix-ecosystem-operational-status" rel="noopener">Radix Ecosystem Operational Status</a></td></tr>` +
  `<tr><td><strong>Network</strong></td><td>Mainnet restarted 11:35&nbsp;UTC on 11 September 2026, after a 254-hour halt</td></tr>` +
  `</tbody></table>`;

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  ssl: { rejectUnauthorized: false },
});
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${TAG_PATH}/${SLUG} is LOCKED`);

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
    [TAG_PATH, SLUG],
  );
  if (!rows.length) throw new Error(`no hub page at ${TAG_PATH}/${SLUG}`);
  const page = rows[0];

  if (!JSON.stringify(page.content).includes(SENTINEL)) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  const blocks = JSON.parse(JSON.stringify(page.content));
  const infobox = blocks.find((b) => b.type === 'infobox');
  if (!infobox?.blocks?.[0]) throw new Error('no infobox block to rewrite');
  const before = infobox.blocks[0].text.length;
  infobox.blocks[0].text = INFOBOX;

  const version = '2.1.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  infobox ${before} -> ${INFOBOX.length} chars, 6 rows -> 3`);

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content = $1, version = $2, updated_at = $3 WHERE id = $4',
      [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Drop the infobox rows the page already carries: the page count is the results bar, and the status and category splits are the facet groups, which derive their counts per request. The three rows kept are the ones stated nowhere else. Saves roughly 300px above the listing on a phone, and removes a snapshot that had to be re-measured each sweep.',
       now],
    );
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
