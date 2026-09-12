/**
 * Sweep 415 — /policy/conflict-of-interest, the rotating `policy` audit.
 *
 * The page's "How this has worked here" section is four measurements of the wiki's
 * own editing record, and three of them had moved since they were taken. Re-run
 * against the database on 12 September 2026:
 *   Ecosystem articles 151 (was 150); Notion import still 111 of them, all six
 *     seconds of 2026-02-06T16:07:52Z
 *   All-time revisions 3,553 on 376 pages from 10 distinct accounts (was 2,818 /
 *     364 / 16 — the wiki has lost thirteen pages since, the Community section
 *     having been retired on 9 September, and a deleted page takes its revisions)
 *   90-day revisions 2,340, of which 2,319 from the maintenance account (99.1%)
 *   Banners still exactly five, same five pages; comments still four, latest
 *     2026-04-05 — both claims re-measured and left as written
 */
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'policy';
const SLUG = 'conflict-of-interest';
const BLOCK = '291e951c-f292-4d47-84ac-f2e798074aa3';
const SENTINEL = 'Across 3,553 revisions';
const DRY = process.argv.includes('--dry-run');

const edits = [
  {
    find: 'Of the 150 pages under <a href="/ecosystem" class="link">Ecosystem</a>, 111 arrived in a single import on 6 February 2026',
    replace: 'Of the 151 pages under <a href="/ecosystem" class="link">Ecosystem</a>, 111 arrived in a single import inside six seconds on 6 February 2026',
  },
  {
    find: "Across 2,818 revisions on 364 pages, written by the 16 accounts that have ever saved one, no message states the writer's relationship to the subject.",
    replace: "Across 3,553 revisions on 376 pages, written by the ten accounts that have ever saved one, no message states the writer's relationship to the subject.",
  },
  {
    find: 'Of the 1,579 revisions saved in the last 90 days, 1,554 come from the maintenance account – 98.4 per cent –',
    replace: 'Of the 2,340 revisions saved in the last 90 days, 2,319 come from the maintenance account – 99.1 per cent, a share that has risen in every re-count –',
  },
  {
    find: 'The three things this policy asks of a conflicted editor have a thinner record.',
    replace: 'The three things this policy asks of a conflicted editor have a thinner record. All four counts below were re-measured on 12 September 2026; two of them have moved and two have not.',
  },
];

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (/ /.test(JSON.stringify(edits))) throw new Error('script carries a raw U+00A0');
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
    [TAG_PATH, SLUG]
  );
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  const b = blocks.find((x) => x.id === BLOCK);
  if (!b) throw new Error('block not found');
  for (const [i, e] of edits.entries()) {
    const hits = b.text.split(e.find).length - 1;
    if (hits !== 1) throw new Error(`edit ${i + 1}: matched ${hits} times, expected 1`);
    b.text = b.text.replace(e.find, e.replace);
    console.log(`  edit ${i + 1}: ok`);
  }

  const version = '1.4.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [
      json,
      version,
      now,
      page.id,
    ]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        cuid(),
        page.id,
        json,
        page.title,
        version,
        'minor',
        AUTHOR_ID,
        'Re-measured the four counts in "How this has worked here" against the database on 12 September 2026. Ecosystem is 151 articles, of which the 6 February Notion import is still 111. All-time revisions 3,553 on 376 pages from ten accounts, against 2,818 on 364 from sixteen when the section was written. The maintenance account wrote 2,319 of the last 90 days’ 2,340 revisions, 99.1 per cent, up from 98.4. Banner count and comment count re-run and left as written: still exactly five banners on the same five pages, still four comments with the newest from April.',
        now,
      ]
    );
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
