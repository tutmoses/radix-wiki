// sweep-364: re-measure /policy/editorial-notices.
//
// Every figure on this page is a count read on 26 August 2026, so it goes stale
// by construction. Re-read on 4 September: the wiki has grown 370 -> 380 pages
// while still carrying exactly the same five editor-placed notices; verification
// stamps are up 224/369 -> 283/379; the orphaned queue has fallen 19 -> 13 and
// the unsourced queue has risen 13 -> 16. The one finding that is more than a
// number: the two oldest pages by last check are the two entries in
// LOCKED_PAGES, so the first synthetic "outdated" notice this wiki raises will
// land on an article the maintenance sweep is not permitted to rewrite.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'policy';
const SLUG = 'editorial-notices';
const SENTINEL = 'down from 19 nine days earlier';
const DRY = process.argv.includes('--dry-run');

const EDITS = [
  { from: 'Read at 26 August 2026, the whole wiki carries <strong>five</strong> of them across 370 pages:',
    to: 'Read again at 4 September 2026, the whole wiki carries <strong>five</strong> of them across 380 pages &ndash; the same five, on the same five pages, nine days and ten new articles later:' },
  { from: '<strong>224 of the 369</strong> pages under a category now carry an explicit verification stamp, and <strong>none</strong> of the 369 is past the threshold. The oldest page on the wiki was checked 150 days ago, which leaves it about a month before it raises the notice by itself.',
    to: '<strong>283 of the 379</strong> pages under a category now carry an explicit verification stamp, and <strong>none</strong> of the 379 is past the threshold. The oldest page on the wiki was checked 159 days ago, which leaves it about three weeks before it raises the notice by itself.</p><p>Which page that is complicates the rule. The two oldest by last check are <a href="/ecosystem/xrd-domains" class="link">XRD Domains</a> at 159 days and <a href="/ecosystem/radix-namespace" class="link">Radix Namespace</a> at 67, and both sit in <code>LOCKED_PAGES</code> &ndash; the two-entry list the wiki&rsquo;s write path refuses to edit, and which a maintenance script is required to check for itself. The first outdated notice this wiki raises will therefore land on an article the sweep cannot rewrite. Clearing it by stamping would still work, because <code>mark-verified.mjs</code> writes the date and never consults the lock, and it would assert a check the editor had no power to act on had anything turned out to be wrong. Where the notice fires on a locked page, leave it standing and refer the article to whoever holds the lock.' },
  { from: '<strong>19 pages</strong> on 26 August 2026, the largest queue.',
    to: '<strong>13 pages</strong> on 4 September 2026, still the largest queue and down from 19 nine days earlier.' },
  { from: 'standard treats as a page that cites nothing. <strong>13 pages</strong>.',
    to: 'standard treats as a page that cites nothing. <strong>16 pages</strong>, and the only one of the four queues that grew.' },
  { from: 'its infobox and its category facets are incomplete. <strong>2 pages</strong>.',
    to: 'its infobox and its category facets are incomplete. <strong>2 pages</strong>, unchanged.' },
];

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  for (const e of EDITS) for (const [k, s] of Object.entries(e)) {
    if ([...s].some((ch) => ch.charCodeAt(0) === 0x00a0)) throw new Error(`literal U+00A0 in ${k}: ${s.slice(0, 60)}`);
  }

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (blocks.some((b) => b.text?.includes(SENTINEL))) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  for (const { from, to } of EDITS) {
    const idx = blocks.findIndex((b) => typeof b.text === 'string' && b.text.includes(from));
    if (idx === -1) throw new Error(`find-string not present, aborting: ${from.slice(0, 70)}`);
    blocks[idx].text = blocks[idx].text.replace(from, to);
    console.log(`  block ${idx}: ${from.slice(0, 58)}...`);
  }

  const version = '1.1.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Re-measure every count at 4 September 2026: 380 pages, still five editor-placed notices; stamps 224/369 -> 283/379; orphaned 19 -> 13, unsourced 13 -> 16, metadata 2 unchanged (cross-checked against /maintenance). Adds the finding that the two oldest pages by last check are the two LOCKED_PAGES, so the first outdated notice will fire on an article the sweep cannot rewrite.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
