// Sweep 404 — /ecosystem/stakesafe: correct what the dashboard's percentage base is.
//
// Sweep 403 published the right number and the wrong reason for it. It said the
// percentages are computed on 4,663,021,341 XRD, "the stake held by the 94
// validators the explorer reports a node version for". Re-read at 03:05 UTC on
// 11 September the explorer carries 287 rows, 154 of them reporting a version,
// and those 154 sum to 4,849,978,082 XRD - not the base. What does reproduce the
// base, at both reads, is the dashboard's own stake-up plus stake-down:
//   23:08 UTC 10 Sep  1,519,267,322 + 3,143,754,018 = 4,663,021,340
//   03:05 UTC 11 Sep  1,642,251,851 + 3,020,769,489 = 4,663,021,340
// which is what the dashboard labels the active validator set, the top 100 by
// stake. The count of rows carrying a version was a coincidence, and the same
// coincidence carried the "28 of those 94" sentence, so both are repaired.
//
// The number, the 4,877,281,907 contrast, the 214,260,566 difference and the 4.4%
// are unchanged and correct. This is a patch: one clause and one noun phrase.
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, withClient } from './seed-utils.mjs';
config();

const TAG_PATH = 'ecosystem';
const SLUG = 'stakesafe';
const VERSION = '2.4.1';
const DRY = process.argv.includes('--dry-run');

const EDITS = [
  { from: '&ndash; the stake held by the 94 validators the explorer reports a node version for &ndash;',
    to: "&ndash; the active validator set, the top 100 by stake, which is the dashboard's own online and offline figures added together &ndash;" },
  { from: '<strong>28</strong> of those 94 validators read v1.4.0.0',
    to: '<strong>28</strong> rows in the explorer table read v1.4.0.0' },
];
const SENTINEL = 'the active validator set, the top 100 by stake';

await withClient(async (client) => {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${TAG_PATH}/${SLUG} is LOCKED`);

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied — no write');
    return;
  }

  let hits = 0;
  for (const b of blocks) {
    if (typeof b.text !== 'string') continue;
    for (const e of EDITS) {
      if (b.text.includes(e.from)) { b.text = b.text.replace(e.from, e.to); hits++; }
    }
  }
  if (hits !== EDITS.length) throw new Error(`expected ${EDITS.length} replacements, made ${hits}`);

  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${VERSION}  (${hits} replacements)`);
  if (DRY) return;

  const now = new Date().toISOString();
  const json = JSON.stringify(blocks);
  await client.query('BEGIN');
  await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
    [json, VERSION, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, VERSION, 'patch', AUTHOR_ID,
     'Corrects what the dashboard computes its percentages on: the active validator set (top 100), which its online and offline figures reproduce exactly at both the 23:08 UTC and 03:05 UTC reads, not the count of explorer rows carrying a node version (287 rows, 154 with a version, summing to 4,849,978,082 XRD). The base figure, the contrast and the 4.4% are unchanged.', now]);
  await client.query('COMMIT');
  console.log('  written');
});
