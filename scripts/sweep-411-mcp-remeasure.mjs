/**
 * sweep 411 — contents/resources rotation, second item.
 *
 * The MCP server reference carried five figures measured on 26 August 2026 and
 * had never been freshness-stamped. Re-measured live on 11 September 2026:
 * serverInfo 3.1.0, protocol 2025-03-26, eleven tools and a 60/min budget all
 * unchanged, so only the counts that move are rewritten — 369 pages -> 371,
 * llms-full.txt 3.1 MB -> 3.4 MB, and the traffic sentence, where /api/mcp has
 * gone from 219 of 1,657 visitors to 571 of 3,438 over the trailing 30 days.
 */
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/resources';
const SLUG = 'mcp-server';
const SENTINEL = '11 September 2026';
const DRY = process.argv.includes('--dry-run');

const EDITS = [
  ['<tr><td><strong>Measured</strong></td><td>26 August 2026</td></tr>',
   '<tr><td><strong>Measured</strong></td><td>11 September 2026</td></tr>'],
  ["over the thirty days to 26 August 2026 the endpoint drew 219 of the wiki's 1,657 visitors, ahead of the",
   "over the thirty days to 11 September 2026 the endpoint drew 571 of the wiki's 3,438 visitors, third behind only the homepage and the account of the Hyperlane asset drain, and more than triple the"],
  ['<p>Eleven tools, measured from a live <code>tools/list</code> call on 26 August 2026.',
   '<p>Eleven tools, measured from a live <code>tools/list</code> call on 11 September 2026.'],
  ['The tag hierarchy with a page count per category. 369 pages at the time of writing.',
   'The tag hierarchy with a page count per category. 371 pages at the time of writing.'],
  ['Sizes below are as served on 26 August 2026.',
   'Sizes below are as served on 11 September 2026.'],
  ['<td>3.1 MB</td><td>The full text of the whole wiki in one file.</td>',
   '<td>3.4 MB</td><td>The full text of the whole wiki in one file.</td>'],
];

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
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  const apply = (b) => {
    for (const [from, to] of EDITS) {
      if (b.text.includes(from)) { b.text = b.text.split(from).join(to); hits.add(from); }
    }
  };
  const hits = new Set();
  for (const b of blocks) {
    if (b.type === 'content') apply(b);
    else if (Array.isArray(b.blocks)) b.blocks.forEach((n) => n.type === 'content' && apply(n));
  }
  const missed = EDITS.filter(([from]) => !hits.has(from));
  if (missed.length) throw new Error(`unmatched find-strings:\n  ${missed.map(([f]) => f.slice(0, 70)).join('\n  ')}`);

  const version = '1.1.0';
  const now = new Date().toISOString();
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  (${hits.size}/${EDITS.length} replacements)`);

  if (!DRY) {
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query(
      'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Re-measured the server live on 11 Sep 2026: 3.1.0, protocol 2025-03-26, eleven tools and the 60/min budget unchanged; corpus 369 -> 371 pages, llms-full.txt 3.1 -> 3.4 MB, and /api/mcp now draws 571 of 3,438 30-day visitors against 219 of 1,657.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
