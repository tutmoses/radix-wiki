// sweep 409 - the operational status index closed on "No official channel has
// announced the restart", written before the council announced it.
//
// The Radix Accountability Council posted "LIVENESS RESTORED" at 14:37:08 UTC
// on 11 September (t.me/RadixAccountabilityCouncil/1026), three hours after the
// first committed round. The same message says the council attempted the
// exploit against mainnet itself and that every attempt failed; asks for a few
// days before a report; and says the Foundation is working with exchanges and
// market makers, while when deposits and withdrawals return is each exchange's
// own decision. That last part is what this page is for, so it goes in.
//
// This page carries the exchange table, so the exchange sentence is the one
// that has to be here. The fuller account of the announcement belongs to
// contents/history/hyperlane-asset-drain-2026 and is not repeated.
//
// Run:  node scripts/sweep-409-status-index-announcement.mjs [--dry-run]

import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'contents/resources';
const SLUG = 'radix-ecosystem-operational-status';
const SENTINEL = 'RadixAccountabilityCouncil/1026';
const NEXT_VERSION = '1.20.0';

const FIND =
  'No official channel has announced the restart, which is also what they said would happen.';

const REPLACE =
  'The <a href="/ecosystem/radix-accountability-council" rel="noopener">Radix Accountability Council</a> announced the restart at <strong>14:37&nbsp;UTC</strong>, three hours later, in <a href="https://t.me/RadixAccountabilityCouncil/1026" target="_blank" rel="noopener">a message</a> that also reports its own attempts to run the exploit against mainnet, all of which failed. On the exchanges it says only that the Foundation is working with them and with the market makers, and that when deposits and withdrawals return is each exchange\'s own decision, so the table below reports what each exchange currently does rather than when it will change.';

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
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied - no write');
    process.exit(0);
  }

  const b = blocks[2];
  if (!b?.text?.includes(FIND)) throw new Error('find-string absent in block 2');
  b.text = b.text.replace(FIND, REPLACE);

  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${NEXT_VERSION}`);
  console.log(`  block 2: ${page.content[2].text.length} -> ${b.text.length} chars`);

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query(
      'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, NEXT_VERSION, now, page.id],
    );
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        cuid(),
        page.id,
        json,
        page.title,
        NEXT_VERSION,
        'minor',
        AUTHOR_ID,
        'The Radix Accountability Council announced the restart at 14:37 UTC on 11 September 2026 and this index still closed on "No official channel has announced the restart". Replaces that with the announcement, the council\'s statement that its own attempts to run the exploit against mainnet all failed, and the part that bears on the exchange table: the Foundation is working with exchanges and market makers, but re-enabling deposits and withdrawals is each exchange\'s own decision. Source: t.me/RadixAccountabilityCouncil/1026.',
        now,
      ],
    );
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
