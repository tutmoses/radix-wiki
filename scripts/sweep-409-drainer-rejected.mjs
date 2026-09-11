// sweep 409 — the first exploit aimed at the fix, and what the ledger says happened.
//
// Run 409 had already recorded that a package whose blueprint is named
// VaultDrainer was published to mainnet at 12:35 UTC on 11 September, and left
// it there: a publish succeeding is not a drain succeeding, and the result was
// not yet on the ledger.
//
// It is now. The transaction that calls the blueprint is permanently rejected,
// and the Gateway gives the engine's reason as
// ErrorBeforeLoanAndDeferredCostsRepaid(SystemError(InvalidInvokeAccess)) —
// the receiver check Eagle Ray exists to carry, refusing the invoke before the
// transaction repaid its fee loan, so it never reached the ledger at all.
//
// Read 2026-09-11 15:20 UTC:
//   POST https://mainnet.radixdlt.com/transaction/status
//     {"intent_hash":"txid_rdx15cnw85zja5jdm5l0uus2vul8cp49u06yvjxvu3eyk4judtcrwgdsytta86"}
//   -> status Rejected / intent_status PermanentlyRejected
//
// It also fixes one thing run 409 got backwards. The page says the operator
// announced the publish in the developer group "a minute earlier". The publish
// committed at 12:35:05.915 UTC; the message (t.me/RadixDevelopers/66391) is
// timestamped 13:03:50 UTC, twenty-eight minutes after it.
//
// Run:  node scripts/sweep-409-drainer-rejected.mjs [--dry-run]

import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'contents/history';
const SLUG = 'hyperlane-asset-drain-2026';
// The page already names SystemError::InvalidInvokeAccess where it explains the
// Eagle Ray check, so the sentinel has to be the transaction, not the error.
const SENTINEL = 'txid_rdx15cnw85z';
const NEXT_VERSION = '3.1.0';

const TX = 'txid_rdx15cnw85zja5jdm5l0uus2vul8cp49u06yvjxvu3eyk4judtcrwgdsytta86';

const RESULT = `<p>The drain itself was refused. <a href="https://dashboard.radixscan.io/transaction/${TX}/summary" target="_blank" rel="noopener">The transaction</a> that calls the blueprint is permanently rejected on mainnet, and the reason the Gateway gives for it is <code>SystemError::InvalidInvokeAccess</code>, the check Eagle Ray turned on that morning, firing on a live attempt. It failed before repaying its fee loan, so it was rejected rather than committed as a failure and left no entry on the ledger. The operator reported the result in the developer group at 14:12&nbsp;UTC.</p>`;

// --- the three edits, as exact find/replace pairs -------------------------
const EDITS = [
  {
    block: 12,
    find: 'said so in the developer group a minute earlier:',
    replace: 'said so in the developer group at 13:03&nbsp;UTC:',
  },
  {
    block: 14,
    find: 'the fork enacted at 11:39&nbsp;UTC on 11 September with 80.85% of active stake on the release.',
    replace:
      'the fork enacted at 11:39&nbsp;UTC on 11 September with 80.85% of active stake on the release, and the first exploit aimed at them was rejected the same afternoon.',
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
    console.log('  already applied — no write');
    process.exit(0);
  }

  // 1. the new paragraph, appended to the "11 September" block
  const restart = blocks[12];
  if (!restart?.text?.includes('VaultDrainer')) {
    throw new Error('block 12 is not the restart section (no VaultDrainer) — aborting');
  }
  restart.text = restart.text.replace(
    /(<p>No official channel announced any of it\.)/,
    `${RESULT}\n$1`,
  );
  if (!restart.text.includes(SENTINEL)) throw new Error('failed to insert the result paragraph');

  // 2 & 3. the two corrections
  for (const e of EDITS) {
    const b = blocks[e.block];
    if (!b?.text?.includes(e.find)) {
      throw new Error(`block ${e.block}: find-string absent — ${e.find.slice(0, 60)}`);
    }
    b.text = b.text.replace(e.find, e.replace);
  }

  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${NEXT_VERSION}`);
  console.log(`  block 12: ${page.content[12].text.length} -> ${restart.text.length} chars`);
  console.log(`  block 14: ${page.content[14].text.length} -> ${blocks[14].text.length} chars`);

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
        'The first exploit aimed at the fix was rejected. The transaction calling the VaultDrainer blueprint is permanently rejected on mainnet with SystemError(InvalidInvokeAccess), read from the Gateway transaction/status endpoint at 15:20 UTC on 11 September 2026; it failed before repaying its fee loan, so it left no ledger entry. Also corrects the publish announcement, which the page placed a minute before the transaction and which is timestamped twenty-eight minutes after it.',
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
