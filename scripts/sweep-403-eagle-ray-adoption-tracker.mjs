// Sweep 403 — /ecosystem/stakesafe gains the Eagle-Ray adoption tracker.
//
// On 10 September 2026 at 20:18 UTC, Bart Roozeboom announced in the main Radix
// Telegram group that StakeSafe's free Radix Network Dashboard now tracks the
// share of active validator-set stake running babylon-node v1.4.0.0, against the
// >67% at which the halted network resumes producing rounds. The page already
// listed the dashboard as free tooling; what is new is that during a halt with no
// published restart date the tooling reports the one number that decides it.
//
// Every figure below was read from the dashboard's own served HTML at 23:08 UTC
// on 10 September 2026 and cross-checked: the 28 validator-explorer rows reading
// v1.4.0.0 sum to 1,260,200,692 XRD (the panel's 1,260,200,690), and the 94 rows
// carrying any version sum to 4,663,021,341 XRD, which is the base the panel's
// percentages are computed on rather than the 4,877,281,907 it heads with.
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage, withClient } from './seed-utils.mjs';
config();

const TAG_PATH = 'ecosystem';
const SLUG = 'stakesafe';
const VERSION = '2.4.0';
const SENTINEL = 'sweep403-eagle-ray-adoption';
const DRY = process.argv.includes('--dry-run');

const SECTION = `<h2 id="${SENTINEL}">The Eagle-Ray adoption tracker (10 September 2026)</h2>
<p>Radix mainnet has produced no rounds since <strong>21:19:06&nbsp;UTC on 31 August 2026</strong>, when validators holding more than two thirds of stake <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">broke liveness deliberately</a> after every Hyperlane-bridged asset on the network was drained. The fix shipped as <a href="https://github.com/radixdlt/babylon-node/releases/tag/v1.4.0.0" target="_blank" rel="noopener">babylon-node v1.4.0.0, &ldquo;Eagle Ray&rdquo;</a> on 10 September, and at <a href="https://t.me/RadixAccountabilityCouncil/1019" target="_blank" rel="noopener">16:15&nbsp;UTC that day</a> the Radix Accountability Council told node operators to install it. No restart date has been published. What has been published is a threshold.</p>
<p>At <strong>20:18&nbsp;UTC on 10 September 2026</strong>, in the main Radix Telegram group, StakeSafe's Bart Roozeboom announced that the operator's free <a href="https://validators.stakesafe.net" target="_blank" rel="noopener">Radix Network Dashboard</a> now <a href="https://t.me/radix_dlt/1002910" target="_blank" rel="noopener">tracks Eagle-Ray adoption live</a>: the share of active validator-set stake already running v1.4.0.0 against the share still on older versions, as a chart and a breakdown table. The announcement states the condition in one line &ndash; <q>Once more than 67% of active stake is on Eagle-Ray, network liveness resumes and the network forks to a patched version</q> &ndash; and the dashboard repeats it in a banner above the charts. The message is authorship-verified as Bart Roozeboom at its <a href="https://t.me/radix_dlt/1002910?embed=1&amp;mode=tme" target="_blank" rel="noopener">public embed</a>. The 67% is not a StakeSafe rule: it is the ordinary two-thirds quorum <a href="/contents/tech/core-protocols/cerberus-consensus-protocol" rel="noopener">Radix's consensus</a> needs to commit a round, which is the same reason the network could be stopped by the same fraction of stake in the first place.</p>
<p>Read from the dashboard's served page at <strong>23:08&nbsp;UTC on 10 September 2026</strong>, seven hours after operators were cleared to upgrade:</p>
<table><tbody>
<tr><th>Reading</th><th>XRD</th><th>Share of the active set</th></tr>
<tr><td>Stake running Eagle-Ray (v1.4.0.0)</td><td>1,260,200,690</td><td><strong>27.03%</strong></td></tr>
<tr><td>Stake not running Eagle-Ray</td><td>3,402,820,650</td><td>72.97%</td></tr>
<tr><td>Stake whose node is online</td><td>1,519,267,322</td><td>32.58%</td></tr>
<tr><td>Stake whose node is offline</td><td>3,143,754,018</td><td>67.42%</td></tr>
<tr><td>Threshold for liveness to resume</td><td>&ndash;</td><td>more than 67%</td></tr>
</tbody></table>
<p>Two details in that table are worth stating precisely, because the dashboard does not. The percentages are computed on <strong>4,663,021,341&nbsp;XRD</strong> &ndash; the stake held by the 94 validators the explorer reports a node version for &ndash; and not on the <strong>4,877,281,907&nbsp;XRD</strong> the same panel heads with as total delegated stake; the two differ by 214,260,566&nbsp;XRD, so a figure quoted against the wrong base runs about 4.4% high. And the upgraded stake is concentrated: <strong>28</strong> of those 94 validators read v1.4.0.0, and their delegated stake sums to the 1,260,200,692&nbsp;XRD the panel rounds to 1,260,200,690.</p>
<p>The gap is forty percentage points, and most of it sits behind nodes that are switched off rather than behind nodes running the wrong version: two thirds of the active set's stake is offline. Restarting therefore asks operators to come back and to come back upgraded, which is why the council's instruction is to leave a fully upgraded node online and working rather than merely to install the release. The dashboard refreshes itself every five minutes, so any reading of it &ndash; including this one &ndash; is a snapshot rather than a settled figure.</p>`;

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

  // The new section goes immediately after the infobox, ahead of the August
  // fleet/fee history: it is the live reading, and the rest of the page is record.
  const at = blocks.findIndex((b) => b.type === 'infobox');
  blocks.splice(at + 1, 0, { id: uid(), type: 'content', text: SECTION });

  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${VERSION}  (${blocks.length} blocks, +1)`);
  if (DRY) return;

  const now = new Date().toISOString();
  const json = JSON.stringify(blocks);
  await client.query('BEGIN');
  await client.query(
    'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
    [json, VERSION, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, VERSION, 'minor', AUTHOR_ID,
     'Adds the Eagle-Ray adoption tracker StakeSafe published on 10 September 2026 (t.me/radix_dlt/1002910), the >67% threshold at which liveness resumes, and the 23:08 UTC reading: 27.03% of active-set stake on v1.4.0.0, 28 of 94 validators, on a 4,663,021,341 XRD base rather than the 4,877,281,907 XRD the panel heads with.',
     now]);
  await client.query('COMMIT');
  console.log('  written');
});
