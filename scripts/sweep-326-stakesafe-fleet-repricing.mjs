// sweep-326-stakesafe-fleet-repricing.mjs
//
// /ecosystem/stakesafe was written at epoch 336,990 (21 Aug 2026), before the
// Avaunt handover. It records the queued 15% -> 25% rise on Amsterdam and
// Rotterdam and the 100% request on the seed node, and says of the incoming
// node: "the incoming validator's fee after the handover has not been stated."
//
// Re-read live at epoch 339,152 (29 Aug 2026, 07:13 UTC), two things have moved:
//
//   1. The handover is confirmed on ledger by custody rather than by
//      announcement. The Avaunt validator's owner is now
//      account_rdx16xrp5e8faqxfa8j20xh5u29js8umdz7zcu6m0xnjfewkcxkpkdl84f -
//      the SAME account that holds StakeSafe Amsterdam's owner badge.
//      (Rotterdam and the seed node sit in two other accounts.)
//   2. The incoming node's fee HAS now been stated, on ledger: a
//      validator_fee_change_request of 0.02 -> 0.25, effective epoch 342,482.
//
// So the whole fleet converges on 25%. Read from the Gateway validator list:
//   Avaunt/ShardSpace   rank   9   142,170,038 XRD   2% -> 25% @ 342,482
//   StakeSafe Rotterdam rank  22    81,158,617 XRD  15% -> 25% @ 339,609
//   StakeSafe Amsterdam rank  24    76,042,330 XRD  15% -> 25% @ 339,608
//   StakeSafe Seed      rank 126       210,440 XRD  15% -> 100% @ 339,609
//   Fleet 299,581,425 XRD = 6.08% of the 4,928,844,882 XRD staked across 287
//   registered validators.
//
// Every one of the four still DISPLAYS its old fee. The pending value lives in
// effective_fee_factor.pending, which nothing on the validator's public face
// shows - the same blind spot run 321 named for the badge.

import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'ecosystem';
const SLUG = 'stakesafe';
const SENTINEL = 'The fleet after the Avaunt handover';
const DRY = process.argv.includes('--dry-run');

const SECTION_HTML = `<h2>${SENTINEL} (29 August 2026)</h2><p>Read live from the <a href="https://docs.radixdlt.com/docs/network-gateway" target="_blank" rel="noopener">Radix Gateway</a> validator list at <strong>epoch&nbsp;339,152</strong> (29 August 2026, 07:13&nbsp;UTC), the handover announced for 28 August has completed, and the evidence is custody rather than announcement. The <a href="/ecosystem/avaunt-staking" rel="noopener">Avaunt Staking</a> validator's owner is now the account <code>account_rdx16xrp5e8&hellip;kpkdl84f</code> &ndash; the same account that holds <strong>StakeSafe Amsterdam</strong>'s owner badge. Rotterdam and the seed node sit in two further accounts, so the operator does not run its fleet from one key, but the acquired node and Amsterdam share one.</p><p>The second change answers the question this page could not answer on 21 August. The incoming validator's fee <em>has</em> now been stated, and it was stated on ledger: a <code>validator_fee_change_request</code> raising its fee factor from <strong>0.02 to 0.25</strong>, effective at <strong>epoch&nbsp;342,482</strong>. With that request the whole fleet converges on the same number.</p><table><tbody><tr><th>Validator</th><th>Rank</th><th>Staked XRD</th><th>Fee now</th><th>Queued</th><th>Effective epoch</th></tr><tr><td><a href="/ecosystem/avaunt-staking" rel="noopener">⏩ Avaunt Staking ⏩ ShardSpace.app</a></td><td>9</td><td>142,170,038</td><td>2%</td><td><strong>25%</strong></td><td>342,482 (about 9 September 2026)</td></tr><tr><td>StakeSafe Rotterdam</td><td>22</td><td>81,158,617</td><td>15%</td><td><strong>25%</strong></td><td>339,609 (about 30 August 2026)</td></tr><tr><td>StakeSafe Amsterdam</td><td>24</td><td>76,042,330</td><td>15%</td><td><strong>25%</strong></td><td>339,608 (about 30 August 2026)</td></tr><tr><td>StakeSafe Seed Node</td><td>126</td><td>210,440</td><td>15%</td><td><strong>100%</strong></td><td>339,609 (about 30 August 2026)</td></tr></tbody></table><p>That is <strong>299,581,425 XRD</strong> across four validators, or <strong>6.08%</strong> of the 4,928,844,882 XRD staked to the network's 287 registered validators at the same reading &ndash; up from the 157.1 million XRD across two nodes this page recorded eight days earlier. The dates are estimates derived from the five-minute target epoch length; the epoch numbers are the commitment.</p><p>Two of those repricings land within about a day and a half of this reading. None of them is visible on the validators themselves: all four still display the fee they charge today, because a queued change lives in the fee-change request rather than in the fee the validator reports, and a delegator reading the name, the fee and the website sees nothing at all. It is the same shape as the handover itself, where the sale was invisible in every field the validator published and legible only in where the <a href="/ecosystem/avaunt-staking" rel="noopener">owner badge sat</a>.</p>`;

const INFO_FIND_1 = '<tr><td><strong>Status</strong></td><td>🟢 Active – both validators registered and accepting delegations</td></tr>';
const INFO_REPL_1 = '<tr><td><strong>Status</strong></td><td>🟢 Active – three production validators registered and accepting delegations</td></tr>';
const INFO_FIND_2 = '<tr><td><strong>Validators</strong></td><td>StakeSafe Amsterdam &amp; StakeSafe Rotterdam (+ a seed node)</td></tr>';
const INFO_REPL_2 = '<tr><td><strong>Validators</strong></td><td>StakeSafe Amsterdam, StakeSafe Rotterdam and the acquired <a href="/ecosystem/avaunt-staking" rel="noopener">Avaunt Staking</a> node (+ a seed node)</td></tr>';
const INFO_FIND_3 = '<tr><td><strong>Combined stake</strong></td><td>157,127,406 XRD across both nodes (epoch&nbsp;336,990, 21 August 2026)</td></tr>';
const INFO_REPL_3 = '<tr><td><strong>Combined stake</strong></td><td>299,581,425 XRD across four nodes, 6.08% of all staked XRD (epoch&nbsp;339,152, 29 August 2026)</td></tr>';
const INFO_FIND_4 = '<tr><td><strong>Validator fee</strong></td><td>15%, with a rise to <strong>25%</strong> queued on ledger for epochs&nbsp;339,608 / 339,609</td></tr>';
const INFO_REPL_4 = '<tr><td><strong>Validator fee</strong></td><td>Every node queued to <strong>25%</strong> – Amsterdam and Rotterdam from 15% at epochs&nbsp;339,608 / 339,609, the acquired Avaunt node from 2% at epoch&nbsp;342,482 (seed node to 100%)</td></tr>';
const INFO_FIND_5 = `<tr><td><strong>Incoming</strong></td><td><a href="/ecosystem/avaunt-staking" rel="noopener">Avaunt Staking</a>'s validator, announced for 28 August 2026</td></tr>`;
const INFO_REPL_5 = `<tr><td><strong>Acquired</strong></td><td><a href="/ecosystem/avaunt-staking" rel="noopener">Avaunt Staking</a>'s validator – owner badge held by the same account as Amsterdam's, confirmed at epoch&nbsp;339,152</td></tr>`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  const infobox = blocks.find((b) => b.type === 'infobox');
  const nested = infobox?.blocks?.find((n) => n.text?.includes(INFO_FIND_1));
  if (!nested) throw new Error('infobox Status row not found');
  for (const [f, r] of [[INFO_FIND_1, INFO_REPL_1], [INFO_FIND_2, INFO_REPL_2], [INFO_FIND_3, INFO_REPL_3], [INFO_FIND_4, INFO_REPL_4], [INFO_FIND_5, INFO_REPL_5]]) {
    if (!nested.text.includes(f)) throw new Error(`infobox find-string did not match: ${f.slice(0, 60)}`);
    nested.text = nested.text.replace(f, r);
  }

  const ledgerIdx = blocks.findIndex((b) => b.text?.startsWith('<h2>Ledger position and the queued fee increase'));
  if (ledgerIdx < 0) throw new Error('ledger-position block not found');
  blocks.splice(ledgerIdx, 0, { id: uid(), type: 'content', text: SECTION_HTML });

  const version = '2.3.0';
  const before = JSON.stringify(page.content).length;
  const json = JSON.stringify(blocks);
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  ${before} -> ${json.length} B`);

  if (!DRY) {
    const now = new Date().toISOString();
    await client.query('BEGIN');
    await client.query(
      'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'The Avaunt handover completed and the whole fleet is now queued to 25%. Read live from the Gateway validator list at epoch 339,152 (29 Aug 2026, 07:13 UTC): the Avaunt validator’s owner is account_rdx16xrp5e8...kpkdl84f, the same account that holds StakeSafe Amsterdam’s owner badge, so the handover is confirmed by custody rather than by announcement; and the incoming node now carries its own fee request, 0.02 to 0.25 effective epoch 342,482, answering the question this page could not answer on 21 August. Fleet is 299,581,425 XRD across four validators, 6.08% of the 4,928,844,882 XRD staked to 287 registered validators, against the 157.1 million across two recorded eight days ago. All four still display their current fee; the queued value is only in the fee-change request. New section, five infobox rows updated.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
