/**
 * sweep 416 — ecosystem rotation: the halt is over, and five ecosystem pages still say it isn't.
 *
 * Radix mainnet stopped committing rounds at 21:19 UTC on 31 August 2026 and resumed on
 * 11 September. Measured from the ledger itself (POST /stream/transactions from state
 * version 557,840,620, asc):
 *
 *   557,840,627  epoch 339,897 round 4    2026-08-31T21:19:48.939Z   last pre-halt round
 *   557,840,628  epoch 339,897 round 5    2026-09-11T11:35:28.960Z   rounds resume, moratorium
 *   557,840,693  epoch 339,898 round 2    2026-09-11T11:39:25.129Z   fork enacted
 *   557,840,694  epoch 339,898 round 2    2026-09-11T11:39:25.129Z   first user transaction
 *
 * Note the boundary: state version 557,840,622 is NOT the last state the ledger committed
 * before the halt. Five more states followed it, three of them user transactions, in epoch
 * 339,897 at 21:19:48.939Z. Pages that read pinned to 557,840,622 are fine; pages that call
 * it "the last state before the halt" are not. That second class is banked for a later run —
 * this one takes the present-tense assertions that the network is still down.
 *
 * Five pages, one clause each except leafnode, whose whole section was an argument from a
 * stopped epoch counter that is now moving again.
 */
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG = 'ecosystem';

const EDITS = [
  {
    slug: 'hyperlane',
    version: '1.2.0',
    changeType: 'minor',
    sentinel: '557,909,564',
    message:
      'Network restart: the infobox and the drain section said Radix mainnet was still halted. Corrected to the measured boundary (last pre-halt round 21:19:48.939 UTC 31 August, first user transaction 11:39:25.129 UTC 11 September) and added a Gateway read at state version 557,909,564 showing all six warp-route supplies unchanged since the drain.',
    subs: [
      [
        'and Radix mainnet has been halted since 21:19 UTC that day',
        'and none has minted or burned since; Radix mainnet was halted from 21:19 UTC that day until 11 September 2026',
      ],
      [
        "Node runners halted Radix mainnet at 21:19 UTC the same evening and it has not restarted. Hyperlane's routes are intact and the protocol continues to operate on its other chains; on Radix they have nothing to move, and until the network resumes nothing can be minted or burned through them.",
        "Node runners halted Radix mainnet at 21:19 UTC the same evening, and it stayed down for ten days. The first user transaction after the restart was committed at <strong>11:39:25 UTC on 11 September 2026</strong>, at epoch 339,898. Hyperlane's routes are intact and the protocol continues to operate on its other chains; on Radix they have nothing to move. Read from the <a href=\"https://mainnet.radixdlt.com/state/entity/details\" target=\"_blank\" rel=\"noopener\">Radix Gateway</a> at state version 557,909,564 on 12 September 2026, twenty hours after transactions resumed, every one of the six supplies stands exactly where the drain left it: 1,092.793964 hUSDC, 0.036292 hUSDT, 0.010278271499053527 hETH, 0.00559963 hWBTC, 0.13633755 hSOL and 0.002104956585023754 hBNB. Nothing has been minted or burned through a Radix warp route since the network came back.",
      ],
    ],
  },
  {
    slug: 'leafnode',
    version: '4.2.0',
    changeType: 'minor',
    sentinel: 'around 16 September 2026',
    message:
      'Network restart: the fee-switch section argued from a stopped epoch counter, which is moving again. Rewritten against a Gateway read of the validator at 07:49 UTC 12 September — fee change request still new_fee_factor 1 at epoch 341,223, current fee 0.01, still registered — and the epoch rate measured since the restart (242 epochs in 20h10m, 300.0s each), which dates epoch 341,223 to around 16 September 2026. The unstaking window that was shut for ten days is open.',
    subs: [
      [
        '<h2>The fee change the stopped ledger cannot deliver (2 September 2026)</h2>',
        '<h2>The 100% fee switch, and the window to leave it (12 September 2026)</h2>',
      ],
      [
        'The 100% fee described above is queued for epoch 341,223. Radix mainnet has committed no round since 21:19:06 UTC on 31 August 2026. Read at <strong>23:04 UTC on 2 September 2026</strong>, <a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">the Gateway status endpoint</a> still returns epoch 339,896 at state version 557,840,622, and <code>/state/validators/list</code> answers HTTP 500 because the Gateway\'s database is 179,118 seconds behind the ledger against a permitted 720.',
        'The 100% fee described above is queued for epoch 341,223, and it is still queued. Read from the <a href="https://mainnet.radixdlt.com/state/entity/details" target="_blank" rel="noopener">Radix Gateway</a> at <strong>07:49 UTC on 12 September 2026</strong>, the validator\'s <code>validator_fee_change_request</code> carries <code>new_fee_factor</code> 1 with <code>epoch_effective</code> 341,223, its live <code>validator_fee_factor</code> is <code>0.01</code>, and it is still registered and still accepting delegated stake.',
      ],
      [
        'An epoch ends when rounds are produced, and none are being produced. The queued fee therefore sits <strong>1,327 epochs</strong> beyond a counter that has stopped, and it will arrive whenever the network restarts rather than in the first week of September. The interval before a queued fee applies is the window in which a delegator who does not want the new rate unstakes. Unstaking is a transaction, and the ledger is accepting none. Anyone still delegated to Leaf Node is held in a validator whose fee switch is armed, on a network where neither the switch nor the exit from it can move until the <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">halt</a> ends. Every queued fee change on Radix is in the same position; this one is dated and on the record.',
        'For ten days that queue could not move. An epoch ends when rounds are produced, none were being produced, and the counter sat at 339,896 &ndash; so an earlier reading of this page recorded the fee change as 1,327 epochs beyond a stopped clock, arriving whenever the network restarted rather than in the first week of September. The clock restarted. The first user transaction after the upgrade moratorium was committed at 11:39:25 UTC on <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">11 September 2026</a>, and epochs have since advanced at the protocol\'s ordinary cadence: 242 of them in the twenty hours and ten minutes to 07:49 UTC on 12 September, an average of 300.0 seconds each.</p><p>At that rate epoch 341,223 arrives <strong>around 16 September 2026</strong>. The interval before a queued fee applies is the window in which a delegator who does not want the new rate unstakes, and unstaking is a transaction the ledger will now accept. The window that was shut for ten days is open, and on current epoch timing it is about four days wide. Every queued fee change on Radix works this way; this one is dated, on the record, and takes the whole reward.',
      ],
    ],
  },
  {
    slug: 'oter',
    version: '2.4.2',
    changeType: 'patch',
    sentinel: 'halted from 31 August to 11 September 2026',
    message:
      'Network restart: "mainnet has been halted since 31 August" was a present-tense assertion that stopped being true at 11:39 UTC on 11 September 2026. Bounded to the dates. The point the sentence supports — that the three ballots came from a private Stokenet deployment — is unaffected.',
    subs: [
      [
        'mainnet has been <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">halted since 31 August</a>, so the three ballots',
        'mainnet was <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">halted from 31 August to 11 September 2026</a>, so the three ballots',
      ],
    ],
  },
  {
    slug: 'miow',
    version: '2.2.0',
    changeType: 'minor',
    sentinel: 'no longer serves as one',
    message:
      'Network restart, and it changes what this page can claim: the halt was offered here as context for the outage, and Radix mainnet resumed committing transactions at 11:39 UTC on 11 September 2026 while miow.me answered the same DEPLOYMENT_NOT_FOUND on 12 September that it answered on 4 September. Re-probed and recorded.',
    subs: [
      [
        'nobody has said the project has ended, and the network it builds on has itself been <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">halted since 31 August 2026</a>. What can be measured is that the platform is not currently operable, which is what the status field on this page now records.',
        'nobody has said the project has ended. The <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">network halt of 31 August 2026</a> was offered here as context while it lasted, and it no longer serves as one: Radix mainnet resumed committing transactions at 11:39 UTC on 11 September 2026, and re-probed at 07:52 UTC on <strong>12 September 2026</strong>, <code>miow.me</code> returned the same HTTP 404 and <code>x-vercel-error: DEPLOYMENT_NOT_FOUND</code> it returned on 4 September. What can be measured is that the platform is not operable, which is what the status field on this page records.',
      ],
    ],
  },
  {
    slug: 'radix-accountability-council',
    version: '2.8.0',
    changeType: 'minor',
    sentinel: 'refocused on the ratification process',
    message:
      'Network restart: the Discussion phase was described as open because a stopped ledger cannot hold a vote, and the ledger restarted on 11 September 2026. The council addressed it the same day (t.me/RadixAccountabilityCouncil/1026, embed-verified) and gave a different reason for keeping the phase open. Recorded with the quotation.',
    subs: [
      [
        'Ratification of the Governance Framework is Activation Condition 6 of the Operating Agreement and needs a vote a stopped ledger cannot hold, so the council removed the seven-day limit on the Discussion phase and left it open-ended;',
        'Ratification of the Governance Framework is Activation Condition 6 of the Operating Agreement and needs a vote, which is why the council removed the seven-day limit on the Discussion phase and left it open-ended while the ledger was stopped. The ledger stopped being the obstacle at 11:39 UTC on 11 September 2026. In a <a href="https://t.me/RadixAccountabilityCouncil/1026" target="_blank" rel="noopener">status update</a> posted three hours later the council said it is "keeping the Discussion phase open for now" and gave a different reason, that "we have all been too focused on the incident and mainnet and there is still time and need to have it refocused on the ratification process". The phase is therefore open by choice rather than by necessity;',
      ],
    ],
  },
];

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

let applied = 0, skipped = 0;
try {
  for (const edit of EDITS) {
    if (isLockedPage(TAG, edit.slug)) throw new Error(`${TAG}/${edit.slug} is LOCKED`);

    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
      [TAG, edit.slug]
    );
    if (!rows.length) throw new Error(`page not found: ${TAG}/${edit.slug}`);
    const page = rows[0];

    const blocks = JSON.parse(JSON.stringify(page.content));
    if (JSON.stringify(blocks).includes(edit.sentinel)) {
      console.log(`  ${edit.slug}: already applied (sentinel present) — no write`);
      skipped++;
      continue;
    }

    let hits = 0;
    const walk = (bs) => {
      for (const b of bs) {
        if (typeof b.text === 'string') {
          for (const [from, to] of edit.subs) {
            if (b.text.includes(from)) { b.text = b.text.split(from).join(to); hits++; }
          }
        }
        if (Array.isArray(b.blocks)) walk(b.blocks);
        if (Array.isArray(b.columns)) b.columns.forEach((c) => walk(c.blocks || []));
      }
    };
    walk(blocks);

    if (hits !== edit.subs.length) {
      throw new Error(`${edit.slug}: matched ${hits} of ${edit.subs.length} find-strings — aborting before any write`);
    }

    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${edit.version}  (${hits} substitutions)`);
    if (!DRY) {
      const now = new Date().toISOString();
      const json = JSON.stringify(blocks);
      await client.query('BEGIN');
      await client.query(
        'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
        [json, edit.version, now, page.id]
      );
      await client.query(
        `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [cuid(), page.id, json, page.title, edit.version, edit.changeType, AUTHOR_ID, edit.message, now]
      );
      await client.query('COMMIT');
    }
    applied++;
  }
} catch (err) {
  try { await client.query('ROLLBACK'); } catch {}
  console.error('FAILED:', err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
console.log(`${DRY ? '[dry] ' : ''}applied ${applied}, skipped ${skipped}`);
