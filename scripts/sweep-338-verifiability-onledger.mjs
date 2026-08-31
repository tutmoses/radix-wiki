// Sweep 338 (policy rotation) – Verifiability: a fourth failure mode.
//
// The page already says the Radix ledger is itself a primary source, and lists
// three ways a check goes wrong. Tonight's Weft Finance exploit supplied the
// fourth, and it is the one this wiki is most exposed to, because reading
// component state is how nearly every ecosystem status on the site is settled.
// Weft's own price cache held HUG at 1,330.41 XRD per token on 30 August 2026
// against a market of 0.000131 XRD: a genuine, current, citable on-ledger
// reading that is wrong by about ten million times. The distinction the section
// adds is between a fact about the ledger (a supply, a vault balance,
// is_registered) and a claim the ledger merely stores on someone's behalf
// (a price, a URL, a status label).
//
//   node scripts/sweep-338-verifiability-onledger.mjs --dry-run
//   node scripts/sweep-338-verifiability-onledger.mjs

import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'policy';
const SLUG = 'verifiability';
const SENTINEL = 'An on-ledger reading is not a true one';
const VERSION = '1.6.0';

const OLD_COUNT = 'Three failure modes recur often enough to be worth naming';
const NEW_COUNT = 'Four failure modes recur often enough to be worth naming';

const ANCHOR = '<h3>A failed fetch is not a dead source</h3>';

const SECTION =
  `<h3>${SENTINEL}</h3>` +
  '<p>The ledger is a primary source, but for the right claim. Reading a component&rsquo;s state tells you what that component holds, not what is the case in the world, and where the two are confused the ledger will state a falsehood with perfect precision. On 30 August 2026 <a href="/ecosystem/weft-finance" class="link">Weft Finance</a>&rsquo;s price cache recorded HUG at <strong>1,330.41 XRD</strong> per token. That reading is genuine, current and citable, and it is wrong by about ten million times: HUG traded at <strong>0.000131 XRD</strong> the same day. One transaction turned the gap into 71 million XRD of debt drawn against collateral bought for 70.6 XRD.</p>' +
  '<p>The correction is not to distrust the ledger but to name what a reading is a source for. A resource&rsquo;s supply, a vault balance, an NFT&rsquo;s data, <code>is_registered</code> on a validator: these are facts about the ledger, and the ledger settles them outright. A price, a valuation, a website, a social handle, a status label: these are claims the ledger merely stores on someone&rsquo;s behalf, and a second, independent source settles them. Cite the first as fact. Cite the second as what a named component published, with the time it published it.</p>';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${TAG_PATH}/${SLUG} is LOCKED`);
  for (const s of [OLD_COUNT, ANCHOR]) {
    if (/\u00A0/.test(s)) throw new Error('find-string carries U+00A0');
  }

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
    [TAG_PATH, SLUG],
  );
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied – no write');
    process.exit(0);
  }

  const check = blocks.find((b) => b.text?.includes('Checking a Radix claim'));
  if (!check) throw new Error('"Checking a Radix claim" section not found');
  for (const s of [OLD_COUNT, ANCHOR]) {
    if (!check.text.includes(s)) throw new Error(`find-string not matched: ${s.slice(0, 40)}`);
  }

  check.text = check.text.replace(OLD_COUNT, NEW_COUNT).replace(ANCHOR, SECTION + ANCHOR);
  console.log('  matched: failure-mode count; inserted: on-ledger reading');

  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${VERSION}`);

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [
      json, VERSION, now, page.id,
    ]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        cuid(), page.id, json, page.title, VERSION, 'minor', AUTHOR_ID,
        'Add a fourth failure mode to "Checking a Radix claim": an on-ledger reading is not a true one. Worked from the 30 August 2026 Weft Finance exploit, where the protocol price cache held HUG at 1,330.41 XRD against a market of 0.000131 XRD. Draws the line this wiki needs, between a fact about the ledger (supply, vault balance, is_registered) which the ledger settles, and a claim the ledger stores on someone else behalf (price, website, handle, status label) which needs a second source and a timestamped attribution.',
        now,
      ],
    );
    await client.query('COMMIT');
    console.log('  committed');
  }
} finally {
  client.release();
  await pool.end();
}
