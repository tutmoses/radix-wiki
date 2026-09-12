// sweep-418: the node-operator page that still told operators the restart had no
// date, twenty-seven hours after the restart.
//
// /developers/infrastructure/01-running-a-node v2.7.0 was written at 02:10 UTC on
// 11 September. Mainnet certified its first round at 11:35:28.96 UTC that morning
// and user transactions resumed at 11:39:25.129 UTC. Backlog item (run 408) named
// this page "most urgent" and three rotations passed it — it is a developers page
// and the rotation has been on ecosystem, ideas, policy and contents/tech. Taken
// here out of category because the audience is node operators and the claim is
// operational.
//
// Two halt-era sections (blocks 4 and 5, 11.7 KB) stay as a dated record; what
// changes is every present-tense assertion inside them, the halt boundary itself
// (557,840,627 at 21:19:48.939 UTC, not the Gateway status endpoint's 557,840,622
// at 21:19:06.179), and a closing paragraph giving the outcome.
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const NBSP = ' ';
const TAG_PATH = 'developers/infrastructure';
const SLUG = '01-running-a-node';
const VERSION = '2.8.0';
const SENTINEL = 'sweep418-how-the-halt-ended';

const REPLACEMENTS = [
  {
    from: '<h2>Operating Through a Halted Network</h2>\n<p>Mainnet stopped committing rounds at <strong>21:19:06.179 UTC on 31 August 2026</strong>, at epoch 339,896, round 102, after the <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">Hyperlane asset drain</a>. The halt is not a mode the network',
    to: '<h2 id="sweep418-halt-record">Operating Through the Network Halt (31 August &ndash; 11 September 2026)</h2>\n<p><em>This section and the one below it were written while mainnet was down. They are kept as an operator&rsquo;s record of the outage; <a href="#sweep418-how-the-halt-ended" rel="noopener">how it ended</a> is at the foot of it.</em></p>\n<p>Mainnet stopped committing rounds at <strong>21:19:48.939 UTC on 31 August 2026</strong>, at epoch 339,897, round 4, state version 557,840,627, after the <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">Hyperlane asset drain</a>. The halt was not a mode the network',
  },
  {
    from: 'The restart itself has no published date. Since 20:18&nbsp;UTC on 10 September it has a published threshold instead.',
    to: 'The restart itself had no published date. From 20:18&nbsp;UTC on 10 September it had a published threshold instead.',
  },
  {
    from: 'None of this has moved the ledger. <a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">gateway-status</a> at 07:07:53 UTC on 10 September still returns state version 557,840,622 at epoch 339,896, round 102, unchanged for 225 hours and 48 minutes, and three hours after the final release an',
    to: 'None of this had moved the ledger. <a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">gateway-status</a> at 07:07:53 UTC on 10 September still returned state version 557,840,622 at epoch 339,896, round 102 &ndash; the aggregator&rsquo;s position rather than the ledger&rsquo;s, five states short of the tip &ndash; unchanged for 225 hours and 48 minutes, and three hours after the final release an',
  },
  {
    from: '<h3>No epochs means no emissions</h3>\n<p><a href="/contents/tech/core-concepts/network-emissions" rel="noopener">Staking emissions</a> are minted per epoch, and the epoch counter has not moved since the halt. Nothing accrues to validators or their delegators while the network is stopped, and nothing is lost in arrears either – the ledger simply has no epochs to pay out for.',
    to: '<h3>No epochs means no emissions</h3>\n<p><a href="/contents/tech/core-concepts/network-emissions" rel="noopener">Staking emissions</a> are minted per epoch, and the epoch counter did not move for the length of the halt. Nothing accrued to validators or their delegators while the network was stopped, and nothing was lost in arrears either – the ledger simply had no epochs to pay out for. The rule is general rather than particular to this outage: a stopped ledger pays nobody, and it owes nobody afterwards.',
  },
  {
    from: 'Adoption is moving. Four hours earlier',
    to: 'Adoption was moving. Four hours earlier',
  },
  {
    from: '<a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">gateway-status</a> at 03:04:56&nbsp;UTC on 11 September still returns state version 557,840,622 at epoch 339,896, round 102, now 245 hours and 45 minutes without a committed round.</p>',
    to: '<a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">gateway-status</a> at 03:04:56&nbsp;UTC on 11 September still returned state version 557,840,622 at epoch 339,896, round 102, 245 hours and 45 minutes without a committed round. Eight and a half hours later it was over.</p>',
  },
];

const CLOSING = `<h3 id="sweep418-how-the-halt-ended">How the halt ended (11 September 2026)</h3>
<p>Enough of the set came back. Radix mainnet certified a round at <strong>11:35:28.96&nbsp;UTC on 11 September 2026</strong> &ndash; state version 557,840,628, epoch 339,897 round 5, its first in ten days, fourteen hours and sixteen minutes. Epoch 339,897 then ran to its end producing rounds and refusing user transactions under the moratorium <code>v1.4.0.0</code> declares, and at <strong>11:39:25.129&nbsp;UTC</strong> epoch 339,898 opened at round 2 with the <a href="/contents/tech/releases/protocol-updates" rel="noopener">Eagle Ray</a> fork enacted and the moratorium lifted in the same second. Read from <a href="https://mainnet.radixdlt.com/stream/transactions" target="_blank" rel="noopener">the transaction stream</a>, the outage is three consecutive entries: 557,840,627 at 21:19:48.939&nbsp;UTC on 31 August, 557,840,628 at 11:35:28.96&nbsp;UTC on 11 September, and sixty-five further round changes before the first user transaction at 557,840,694.</p>
<p>Two things in the sections above are worth carrying forward rather than filing. The fork enacted <strong>unconditionally at the start of epoch 339,898</strong> rather than on a validator readiness signal, which is unique in Radix&rsquo;s mainnet history and is why no restart date could be published: a halted network completes no epochs, so it can hold no readiness vote. And an operator still on <code>v1.3</code> when the fork enacted was not merely late; the release the threshold counted is the one the network forked to. The <a href="https://validators.stakesafe.net" target="_blank" rel="noopener">adoption dashboard</a> read 32.77% of active-set stake on Eagle Ray at 11:05&nbsp;UTC and the fork enacted at 80.85%, so the last forty-eight points arrived in half an hour when the largest validators booted together. The full sequence is on <a href="/contents/resources/radix-ecosystem-operational-status#sweep408-status-restored" rel="noopener">Radix Ecosystem Operational Status</a>.</p>`;

const MESSAGE = 'The page told node operators the restart had no published date; mainnet restarted at 11:35:28.96 UTC on 11 September, twenty-seven hours before this edit. Past-tensed the two halt sections and retitled them as a dated record, corrected the halt boundary to state version 557,840,627 at 21:19:48.939 UTC (21:19:06.179 / 557,840,622 is the Gateway status endpoint’s position, five states short), and added a closing section giving the restart from /stream/transactions: rounds resumed in epoch 339,897 under the moratorium, Eagle Ray enacted unconditionally at the start of 339,898 at 11:39:25.129 UTC, ten days fourteen hours and sixteen minutes without a round.';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

for (const r of REPLACEMENTS) {
  if (r.from.includes(NBSP)) throw new Error('find-string carries a real U+00A0');
}

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${TAG_PATH}/${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  for (const r of REPLACEMENTS) {
    let hits = 0;
    for (const b of blocks) {
      if (typeof b.text !== 'string' || !b.text.includes(r.from)) continue;
      b.text = b.text.split(r.from).join(r.to);
      hits += 1;
    }
    if (hits !== 1) throw new Error(`expected 1 match for "${r.from.slice(0, 52)}…", found ${hits}`);
  }
  blocks.splice(6, 0, { id: uid(), type: 'content', text: CLOSING });

  console.log(`  ${DRY ? '[dry] ' : ''}${TAG_PATH}/${SLUG}  v${page.version} -> v${VERSION}  (${blocks.length} blocks)`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query(
      'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, VERSION, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, VERSION, 'minor', AUTHOR_ID, MESSAGE, now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
