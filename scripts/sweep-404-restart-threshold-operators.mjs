// Sweep 404 — /developers/infrastructure/01-running-a-node gains the restart condition.
//
// The developers rotation and the live story met on the same page this run. The
// node-operator page already carried the halt, the patched release, the CLI
// install gap and the Accountability Council's 16:15 UTC instruction to upgrade,
// and it closed on the sentence "The restart itself has no published date." That
// became incomplete four hours later: at 20:18 UTC on 10 September StakeSafe's
// Bart Roozeboom published a threshold instead of a date, and it is the number an
// operator reading this page most needs.
//
// Every figure below was read from validators.stakesafe.net's served HTML at
// 03:05 UTC on 11 September 2026, and the arithmetic was done on those figures:
//   Eagle-Ray stake 1,419,724,715 (30.45%)   no Eagle-Ray 3,243,296,625 (69.55%)
//   stake up        1,642,251,851 (35.22%)   stake down   3,020,769,489 (64.78%)
//   panel headline "Total" 4,877,281,907 = every row in the explorer table
// up + down = 4,663,021,340, which is the base every percentage above is computed
// on (1,419,724,715 / 4,663,021,340 = 30.4463%), and it is the same total the
// 23:08 UTC reading produced. 36 explorer rows read v1.4.0.0 and their stake sums
// to the panel's Eagle-Ray figure exactly.
//
// The load-bearing claim is the one that needs no assumption about which nodes are
// online: online stake is 35.22% of the active set, so even the whole of it on the
// patched release falls short of >67%. The threshold is gated on offline operators
// returning, not on online operators upgrading.
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage, withClient } from './seed-utils.mjs';
config();

const TAG_PATH = 'developers/infrastructure';
const SLUG = '01-running-a-node';
const VERSION = '2.7.0';
const SENTINEL = 'sweep404-restart-threshold';
const DRY = process.argv.includes('--dry-run');

const OLD_LINE = 'The restart itself has no published date.';
const NEW_LINE = 'The restart itself has no published date. Since 20:18&nbsp;UTC on 10 September it has a published threshold instead.';

const SECTION = `<h3 id="${SENTINEL}">The restart condition, and the gap it has to close</h3>
<p>At <strong>20:18&nbsp;UTC on 10 September 2026</strong>, in the main Radix Telegram group, Bart Roozeboom of the validator operator <a href="/ecosystem/stakesafe" rel="noopener">StakeSafe</a> announced that its free <a href="https://validators.stakesafe.net" target="_blank" rel="noopener">Radix Network Dashboard</a> now <a href="https://t.me/radix_dlt/1002910" target="_blank" rel="noopener">tracks Eagle-Ray adoption live</a>, and stated the condition in one line: <q>Once more than 67% of active stake is on Eagle-Ray, network liveness resumes and the network forks to a patched version.</q> The dashboard repeats it in a banner above its charts. The 67% is not a StakeSafe rule. It is the ordinary two-thirds quorum <a href="/contents/tech/core-protocols/cerberus-consensus-protocol" rel="noopener">Radix's consensus</a> needs to commit a round, which is why the same fraction of stake could stop the network in the first place.</p>
<p>Read from the dashboard's served page at <strong>03:05&nbsp;UTC on 11 September 2026</strong>, eleven hours after operators were cleared to upgrade:</p>
<table><tbody>
<tr><th>Reading</th><th>XRD</th><th>Share of the active set</th></tr>
<tr><td>Stake running Eagle-Ray (v1.4.0.0)</td><td>1,419,724,715</td><td><strong>30.45%</strong></td></tr>
<tr><td>Stake not running Eagle-Ray</td><td>3,243,296,625</td><td>69.55%</td></tr>
<tr><td>Stake whose node is online</td><td>1,642,251,851</td><td>35.22%</td></tr>
<tr><td>Stake whose node is offline</td><td>3,020,769,489</td><td>64.78%</td></tr>
<tr><td>Threshold for liveness to resume</td><td>more than 3,124,224,298</td><td>more than 67%</td></tr>
</tbody></table>
<p>Adoption is moving. Four hours earlier, at 23:08&nbsp;UTC on 10 September, the same panel read 1,260,200,690&nbsp;XRD and 27.03%, so roughly 160 million&nbsp;XRD came onto the patched release overnight. Thirty-six rows in the dashboard's validator table report v1.4.0.0 and their delegated stake sums to the adoption figure exactly.</p>
<p><strong>Upgrades among operators who are already running cannot close the gap.</strong> Online stake is 1,642,251,851&nbsp;XRD, 35.22% of the active set. Every online validator could be on Eagle Ray tomorrow and the total would still sit around half of the 67% the restart needs, because the other 3,020,769,489&nbsp;XRD is behind nodes that are switched off. The council's instruction reflects that: it asks operators to leave a fully upgraded node <em>online and working</em>, not merely to install the release. If your node is one of the ones that stopped, starting it again on <code>v1.4.0.0</code> is the step the threshold is actually waiting on.</p>
<p>One caveat on reading the dashboard. Its percentages are computed on the active validator set, the top 100 by stake, whose total it reports as <strong>4,663,021,340&nbsp;XRD</strong> &ndash; the online and offline figures added together. The panel heads with a different number, <strong>4,877,281,907&nbsp;XRD</strong>, which is every row in the explorer table including validators outside the active set. Quoted against that base the adoption reading is 29.11% rather than 30.45%, so say which base a figure came from. The dashboard refreshes every five minutes, and every reading here is a snapshot.</p>
<p><a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">gateway-status</a> at 03:04:56&nbsp;UTC on 11 September still returns state version 557,840,622 at epoch 339,896, round 102, now 245 hours and 45 minutes without a committed round.</p>`;

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

  // The halt narrative lives in one block that ends on the coordinated deployment.
  // The threshold continues it, so the new section goes immediately after it as its
  // own block rather than growing an already 8 KB block further.
  const halt = blocks.findIndex((b) => typeof b.text === 'string' && b.text.includes(OLD_LINE));
  if (halt < 0) throw new Error('halt block not found (OLD_LINE missing)');
  blocks[halt].text = blocks[halt].text.replace(OLD_LINE, NEW_LINE);
  blocks.splice(halt + 1, 0, { id: uid(), type: 'content', text: SECTION });

  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${VERSION}`);
  console.log(`  halt block index ${halt}, new block at ${halt + 1}, ${blocks.length} blocks total`);
  if (DRY) return;

  const now = new Date().toISOString();
  const json = JSON.stringify(blocks);
  await client.query('BEGIN');
  await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
    [json, VERSION, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, VERSION, 'minor', AUTHOR_ID,
     'Adds the restart condition an operator needs: >67% of active validator-set stake on babylon-node v1.4.0.0 (Bart Roozeboom, t.me/radix_dlt/1002910, 20:18 UTC 10 September), the 03:05 UTC 11 September reading of 30.45% from validators.stakesafe.net, and the arithmetic that online stake is 35.22% of the active set so the threshold is gated on offline operators returning rather than on online operators upgrading.', now]);
  await client.query('COMMIT');
  console.log('  written');
});
