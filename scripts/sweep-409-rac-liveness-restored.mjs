// sweep 409 — the council announced the restart, so the page's account of the
// official silence is no longer true.
//
// At 14:37:08 UTC on 11 September the Radix Accountability Council posted
// "LIVENESS RESTORED" to its channel (t.me/RadixAccountabilityCouncil/1026),
// three hours and two minutes after mainnet committed its first round. The
// same message says the council attempted the exploit on mainnet itself and
// that every attempt failed, asks for a few days before a report, notes that
// re-enabling deposits and withdrawals is each exchange's own decision, and
// leaves the Governance Framework ratification in its discussion phase.
//
// The article closed on "No official channel announced any of it" and the
// unresolved section on "The council said the official report waits for
// liveness". Both were written before 14:37 and both are now wrong.
//
// The Foundation's blog still carries nothing about the restart (checked
// 15:24 UTC: four posts, most recent "Foundation Update: Moving to Maintenance
// Mode"), and docs.radixdlt.com/docs/eagle-ray still answers 404, so the two
// absences that survive are named once and dated rather than dropped.
//
// Run:  node scripts/sweep-409-rac-liveness-restored.mjs [--dry-run]

import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'contents/history';
const SLUG = 'hyperlane-asset-drain-2026';
const SENTINEL = 'RadixAccountabilityCouncil/1026';
const NEXT_VERSION = '3.2.0';

const RAC = 'https://t.me/RadixAccountabilityCouncil/1026';

const EDITS = [
  {
    block: 12,
    find:
      `<p>No official channel announced any of it. The council's most recent message is still the upgrade instruction of 10 September, and <a href="https://docs.radixdlt.com/docs/eagle-ray" target="_blank" rel="noopener">the documentation page for Eagle Ray</a> still answered HTTP 404 hours after the update it is supposed to document enacted on mainnet.</p>`,
    replace:
      `<p>The council announced the restart at <strong>14:37&nbsp;UTC</strong>, three hours after it happened, in <a href="${RAC}" target="_blank" rel="noopener">a message</a> that credits the node runners and says the restart arrived earlier than it had expected. It adds that the council had itself attempted the exploit against mainnet, and that every attempt failed. It asks for a few days before it publishes a report, says the Foundation is working with the exchanges and market makers but that when deposits and withdrawals return is each exchange's own decision, and says the Governance Framework ratification stays in its discussion phase, which the incident had pushed aside. The Foundation's own blog still carries nothing about any of it, and <a href="https://docs.radixdlt.com/docs/eagle-ray" target="_blank" rel="noopener">the documentation page for Eagle Ray</a> still answered HTTP 404 at 15:24&nbsp;UTC.</p>`,
  },
  {
    block: 14,
    find:
      'What has not been published is any account of the flaw. The council said the official report waits for liveness, and liveness arrived at 11:35&nbsp;UTC that morning.',
    replace:
      'What has not been published is any account of the flaw. Announcing the restart, the council asked for a few days to prepare one.',
  },
];

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

  for (const e of EDITS) {
    const b = blocks[e.block];
    if (!b?.text?.includes(e.find)) {
      throw new Error(`block ${e.block}: find-string absent - ${e.find.slice(0, 70)}`);
    }
    b.text = b.text.replace(e.find, e.replace);
    console.log(
      `  block ${e.block}: ${page.content[e.block].text.length} -> ${b.text.length} chars`,
    );
  }

  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${NEXT_VERSION}`);

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
        'The Radix Accountability Council announced the restart at 14:37 UTC on 11 September 2026, three hours after it happened, and the page still said no official channel had. The announcement also states that the council attempted the exploit against mainnet itself and that every attempt failed, asks for a few days before a report, leaves exchange deposits and withdrawals to the exchanges, and reopens the Governance Framework ratification discussion. Source: t.me/RadixAccountabilityCouncil/1026. The Foundation blog and the Eagle Ray documentation page are both still silent and are now dated rather than described as ongoing.',
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
