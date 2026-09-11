// sweep 410 — blog rotation. Score the halt prediction, and correct what the halt
// taught this page to say about state version 557,840,622.
//
// /blog/week-in-review carried an open claim, recorded 6 September and due 20 September:
// "Radix mainnet commits a round again, ending the halt that began on 31 August 2026."
// It hit on 11 September, nine days early. Scored here on the check as the claim wrote it:
//
//   POST https://mainnet.radixdlt.com/state/validators/list  (no at_ledger_state)
//   read 17:05 UTC 11 Sep -> HTTP 200, ledger_state.epoch 339,963, 287 validators
//   hit condition: HTTP 200 with ledger_state.epoch above 339,896.  HIT.
//
// The second half is a correction run 408 opened on the history pages and which lands
// here too: 557,840,622 is the last state the GATEWAY STATUS ENDPOINT reported, not the
// last the ledger reached. /stream/transactions shows the ledger ran on to 557,840,627 at
// epoch 339,897 round 4, timestamped 2026-08-31T21:19:48.939Z. The pinned reads taken at
// 557,840,622 are unaffected and the claims they settled stay settled; only the
// characterisation of that state version was wrong.
//
// Run:  node scripts/sweep-410-score-halt-prediction.mjs [--dry-run]

import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const SENTINEL = 'sweep410-halt-scored';

const OLD_SCORING_NOTE =
  '<h2>Open predictions</h2><p id="halt-and-scoring"><strong>Scoring is no longer suspended.</strong> Radix mainnet <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">halted at 21:19:06 UTC on 31 August 2026</a> and had still produced no round when this page was re-read at 03:08 UTC on 10 September, nine days and five hours later. The 30 August note recorded three claims as unscorable for the duration, on the ground that the Gateway answers <code>/state/validators/list</code> with HTTP 500 while its database is behind the network. That was wrong. The freshness guard is skipped for any request carrying <code>at_ledger_state</code>, so a read pinned to state version 557,840,622 returns HTTP 200 with the full validator set as it stood when the network stopped. Any on-ledger claim whose settling epoch fell before 339,896 can therefore be scored now, which is how the StakeSafe fee claim scores below. What cannot be scored is anything needing a transaction after the halt, because nothing has executed since.</p>';

const NEW_SCORING_NOTE =
  '<h2>Open predictions</h2><p id="halt-and-scoring"><strong>Scoring is unrestricted again.</strong> Radix mainnet <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">halted on 31 August 2026</a> and restarted at 11:35:28.96&nbsp;UTC on 11 September, 254 hours and 15 minutes later, so a claim needing a transaction after the halt settles like any other from here. Two notes on what this page wrote while it was down. The 30 August note recorded three claims as unscorable for the duration, on the ground that the Gateway answers <code>/state/validators/list</code> with HTTP 500 while its database is behind the network; that was wrong, because the freshness guard is skipped for any request carrying <code>at_ledger_state</code>, and a read pinned to state version 557,840,622 returned HTTP 200 with the full validator set throughout. Those pinned reads stand and the claims they settled stay settled. What this page called that state version does not: 557,840,622 is the last state the Gateway’s status endpoint reported, not the last the ledger reached, and <a href="https://mainnet.radixdlt.com/stream/transactions" target="_blank" rel="noopener">the transaction stream</a> shows the ledger ran on to state version 557,840,627 at epoch 339,897 round 4, timestamped 21:19:48.939&nbsp;UTC. The halt claim below had that distinction right from the day it was recorded, because its check names the unpinned endpoint and says in terms that <code>/status/gateway-status</code> answers 200 from the frozen ledger and cannot tell a restart from its absence.</p>';

const OLD_INLINE_B2 =
  'epoch 339,896, the final state the ledger reached at 21:19:06.179 UTC on 31 August 2026, which is the only read the halted Gateway will answer';
const NEW_INLINE_B2 = 'epoch 339,896, the last state the Gateway’s status endpoint reported during the halt';

const OLD_INLINE_B3 = 'epoch 339,896, the final state the ledger reached at 21:19:06.179 UTC on 31 August 2026:';
const NEW_INLINE_B3 = 'epoch 339,896, the last state the Gateway’s status endpoint reported during the halt:';

const OLD_INFOBOX_SCORING =
  'Ledger-scored claims still resolve during the halt: the Gateway answers any read pinned to the final state version';
const NEW_INFOBOX_SCORING =
  'Unrestricted. The network restarted at 11:35 UTC on 11 September 2026; during the halt, claims resolved against reads pinned to state version 557,840,622';

const RESOLVED_ROW = `<tr id="${SENTINEL}"><td>Radix mainnet commits a round again, ending the halt that began on 31 August 2026.</td><td>2026-09-20</td><td><strong>Hit</strong></td><td>Hit at <strong>11:35:28.96&nbsp;UTC on 11 September 2026</strong>, nine days before the due date, and scored on the check exactly as the claim wrote it. Gateway POST <code>/state/validators/list</code> with no <code>at_ledger_state</code>, read at 17:05&nbsp;UTC on 11 September, answers HTTP 200 with <code>ledger_state.epoch</code> 339,963 and all 287 validators, against a hit condition of any epoch above 339,896. The restart itself is two consecutive entries in <a href="https://mainnet.radixdlt.com/stream/transactions" target="_blank" rel="noopener">the transaction stream</a> with nothing between them: state version 557,840,627 at epoch 339,897 round 4, timestamped 21:19:48.939&nbsp;UTC on 31 August, then 557,840,628 at epoch 339,897 round 5, timestamped 11:35:28.96&nbsp;UTC on 11 September, which is 254 hours, 15 minutes and 40 seconds apart. Consensus resumed under a user transaction moratorium that held epoch 339,897 to empty blocks, and the Eagle Ray fork enacted at the start of epoch 339,898, where round 2 committed 17 user transactions at 11:39:25.129&nbsp;UTC. The <a href="https://t.me/RadixAccountabilityCouncil/1026" target="_blank" rel="noopener">Radix Accountability Council confirmed liveness restored</a> at 14:37&nbsp;UTC, three hours after the fact. The claim named the node runners and they are who settled it: adoption of babylon-node v1.4.0.0 stood at 31.22% of active validator-set stake at 07:12&nbsp;UTC and cleared two thirds inside the next four hours.</td><td>Wiki maintenance sweep, 11 September 2026</td></tr>`;

const OLD_TALLY = '3 of 3 predictions hit (100%), 5 still open.';
const NEW_TALLY = '4 of 4 predictions hit (100%), 4 still open.';

const OLD_WIR06 = 'state version 557,840,622, the last state the network reached, and';
const NEW_WIR06 = 'state version 557,840,622, the last state the Gateway’s status endpoint reported, and';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  ssl: { rejectUnauthorized: false },
});
const client = await pool.connect();

const swap = (s, oldText, newText, label) => {
  if (!s.includes(oldText)) throw new Error(`not found (${label}): ${oldText.slice(0, 70)}…`);
  return s.replace(oldText, newText);
};

try {
  for (const slug of ['week-in-review', 'week-in-review-2026-09-06']) {
    if (isLockedPage('blog', slug)) throw new Error(`${slug} is LOCKED`);
  }

  // ---------- 1. the running ledger page ----------
  const { rows: wr } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
    ['blog', 'week-in-review'],
  );
  if (!wr.length) throw new Error('week-in-review not found');
  const page = wr[0];
  const blocks = JSON.parse(JSON.stringify(page.content));

  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  // infobox: counts and the scoring row
  const tbl = blocks[0].blocks[0];
  tbl.text = swap(tbl.text, '<th>Open predictions</th><td>5</td>', '<th>Open predictions</th><td>4</td>', 'open count');
  tbl.text = swap(tbl.text, '<th>Resolved</th><td>3</td>', '<th>Resolved</th><td>4</td>', 'resolved count');
  tbl.text = swap(tbl.text, OLD_INFOBOX_SCORING, NEW_INFOBOX_SCORING, 'infobox scoring');

  // block 2: the note, the inline characterisation, and lift the row out of Open
  let b2 = blocks[2].text;
  b2 = swap(b2, OLD_SCORING_NOTE, NEW_SCORING_NOTE, 'scoring note');
  b2 = swap(b2, OLD_INLINE_B2, NEW_INLINE_B2, 'b2 inline');
  const i = b2.indexOf('Radix mainnet commits a round again');
  if (i < 0) throw new Error('halt claim row not found in Open predictions');
  const rowStart = b2.lastIndexOf('<tr>', i);
  const rowEnd = b2.indexOf('</tr>', i) + 5;
  const lifted = b2.slice(rowStart, rowEnd);
  if (!lifted.includes('2026-09-20') || !lifted.includes('Radix node runners')) {
    throw new Error('lifted row does not look like the halt claim');
  }
  b2 = b2.slice(0, rowStart) + b2.slice(rowEnd);
  blocks[2].text = b2;

  // block 3: the new Resolved row at the top of the table, and the inline characterisation
  let b3 = blocks[3].text;
  b3 = swap(b3, OLD_INLINE_B3, NEW_INLINE_B3, 'b3 inline');
  const hdr = '<th>Scored in</th></tr>';
  b3 = swap(b3, hdr, hdr + RESOLVED_ROW, 'resolved header');
  blocks[3].text = b3;

  // block 4: the tally
  blocks[4].text = swap(blocks[4].text, OLD_TALLY, NEW_TALLY, 'tally');

  // ---------- 2. the archived issue that used the same phrase ----------
  const { rows: ar } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
    ['blog', 'week-in-review-2026-09-06'],
  );
  if (!ar.length) throw new Error('week-in-review-2026-09-06 not found');
  const arch = ar[0];
  const archBlocks = JSON.parse(JSON.stringify(arch.content));
  const ai = archBlocks.findIndex((b) => typeof b.text === 'string' && b.text.includes(OLD_WIR06));
  if (ai < 0) throw new Error('archived issue phrase not found');
  archBlocks[ai].text = swap(archBlocks[ai].text, OLD_WIR06, NEW_WIR06, 'archived issue');

  const v1 = '1.23.0';
  const v2 = '5.1.2';
  console.log(`  ${DRY ? '[dry] ' : ''}blog/week-in-review          v${page.version} -> v${v1}`);
  console.log(`      halt claim lifted from Open (${lifted.length} chars) and scored Hit in Resolved`);
  console.log(`      open 5 -> 4, resolved 3 -> 4, tally "${NEW_TALLY}"`);
  console.log(`  ${DRY ? '[dry] ' : ''}blog/week-in-review-2026-09-06 v${arch.version} -> v${v2} (block ${ai}, phrase corrected)`);

  if (!DRY) {
    const now = new Date().toISOString();
    const j1 = JSON.stringify(blocks);
    const j2 = JSON.stringify(archBlocks);
    await client.query('BEGIN');

    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [
      j1, v1, now, page.id,
    ]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        cuid(), page.id, j1, page.title, v1, 'minor', AUTHOR_ID,
        'Scored the halt prediction Hit. "Radix mainnet commits a round again, ending the halt that began on 31 August 2026" (recorded 6 September, due 20 September) hit at 11:35:28.96 UTC on 11 September, nine days early, on the check as written: unpinned /state/validators/list returns HTTP 200 at epoch 339,963 with 287 validators against a hit condition of any epoch above 339,896. Moved from Open to Resolved with the ledger boundary, the moratorium, the Eagle Ray enactment and the council confirmation. Open 5 -> 4, resolved 3 -> 4, hit rate still 100%. Also corrects this page’s characterisation of state version 557,840,622 in three places: it is the last state the Gateway status endpoint reported, not the last the ledger reached, which ran on to 557,840,627 at epoch 339,897 round 4 at 21:19:48.939 UTC. The pinned reads taken at 557,840,622 are unaffected.',
        now,
      ],
    );

    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [
      j2, v2, now, arch.id,
    ]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        cuid(), arch.id, j2, arch.title, v2, 'patch', AUTHOR_ID,
        'Corrects one phrase: state version 557,840,622 was called "the last state the network reached". It is the last state the Gateway status endpoint reported; the ledger ran on to 557,840,627 at epoch 339,897 round 4, timestamped 21:19:48.939 UTC on 31 August 2026, per /stream/transactions. The pinned read this issue took at that state version, and every number derived from it, are unaffected.',
        now,
      ],
    );

    await client.query('COMMIT');
    console.log('    written (2 pages, 2 revisions)');
  }
} finally {
  client.release();
  await pool.end();
}
