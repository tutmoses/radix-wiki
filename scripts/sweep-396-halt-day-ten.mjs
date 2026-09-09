// Sweep 396 (contents/history): day ten of the halt. The Radix Accountability
// Council reports the first milestone - the fix deployed and validated end to
// end on Stokenet - while mainnet returns the same frozen ledger it has
// returned since 31 August. Stokenet's continuity is measured here rather than
// taken on trust: twelve epochs an hour, every hour, across 28 hourly readings.
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/history';
const SLUG = 'hyperlane-asset-drain-2026';
const SENTINEL = 'day-ten-stokenet';
const DRY = process.argv.includes('--dry-run');

const SECTION = `<h2 id="${SENTINEL}">Day ten: the fix runs, and not here</h2>
<p>Read at <strong>19:04:37&nbsp;UTC on 9 September 2026</strong>, <a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">the Gateway status endpoint</a> returns the ledger it has returned since the halt: state version 557,840,622, epoch 339,896, round 102, proposer round timestamp 21:19:06.179&nbsp;UTC. That is <strong>213 hours and 45 minutes</strong> without a committed round. Five minutes later <code>/state/validators/list</code> answers HTTP 500 and counts the gap itself, <q>it is currently 8 days, 21 hours, 50 minutes, 3 seconds behind</q>, with <code>current_sync_delay_seconds</code> 769,803 against a <code>max_allowed_sync_delay_seconds</code> of 720.</p>
<p>Twenty-one minutes before that reading, at <strong>18:43&nbsp;UTC</strong>, the <a href="https://t.me/RadixAccountabilityCouncil/1012" target="_blank" rel="noopener">Radix Accountability Council</a> posted the first forward movement since the network stopped. The update, by projectShift as the council's updates have been throughout, is headed <q>First milestone reached - STOKENET</q> and says that <q>a successful deployment of the new versions of software and protocol were achieved in Stokenet and the whole scenario was validated from end to end</q>. The next steps it names are, in that order, a final commit for the official release, a date, and a plan for mainnet. It also asks node operators to leave the release candidate alone: <q>do not use RC versions to test out on your nodes or similar ideas</q>.</p>
<h3 id="what-stokenet-shows-from-outside">What the test network shows from outside</h3>
<p>Stokenet's own ledger corroborates the deployment in the way that matters to someone waiting on mainnet: it never stopped. Sampled hourly through <code>/state/entity/details</code> pinned by timestamp &ndash; the same <a href="/contents/tech/core-protocols/radix-gateway-api#pinned-reads" rel="noopener">pinned read</a> that gets an answer out of mainnet's frozen Gateway &ndash; <a href="/contents/tech/releases/stokenet" rel="noopener">Stokenet</a> reports exactly <strong>twelve epochs in every one of the 28 hours</strong> from 15:00&nbsp;UTC on 8 September to 19:00&nbsp;UTC on 9 September, committing between 13,507 and 18,372 state versions an hour. At 19:05:34&nbsp;UTC it was still committing about five state versions a second, at state version 7,346,809 in epoch 3,543.</p>
<p>That is what a protocol update is meant to look like from outside. It enacts at an epoch boundary on nodes that already carry the code, so a network that adopts one correctly shows no interruption &ndash; which is also why an unbroken ledger is not by itself proof the update enacted. The council's statement is the source for the deployment; the ledger is the source for the fact that nothing broke around it.</p>
<h3 id="the-release-that-is-still-not-there">The release that is still not there</h3>
<p>Nothing has been published on the mainnet side since. <a href="https://github.com/radixdlt/babylon-node/releases" target="_blank" rel="noopener">babylon-node</a>'s newest release is still <a href="https://github.com/radixdlt/babylon-node/releases/tag/v1.4.0.0-RC1" target="_blank" rel="noopener"><code>v1.4.0.0-RC1</code></a> of 15:35:42&nbsp;UTC on 8 September, still flagged a pre-release, so <code>/releases/latest</code> still resolves to <code>v1.3.0.5-test.1</code> &ndash; the rebuild of the halted version, and the one the <code>babylonnode</code> CLI installs. The newest commit on <code>main</code> is still <code>7400951e</code> of 15:28:10&nbsp;UTC on 8 September, the merge of the fix itself. The final commit the council names as its next step had not been made twenty-seven hours later.</p>
<p>So the schedule now has everything in it except a date. <a href="/contents/tech/releases/protocol-updates" rel="noopener">Eagle Ray</a> enacts on mainnet at the start of epoch <strong>339,898</strong> unconditionally, with user transactions refused through epoch 339,897, the only update in Radix's mainnet history that does not go to a readiness vote; Stokenet takes the same update on the ordinary 80%-of-stake signal, which is the vote that has now been exercised. Mainnet is two epochs from the fix and cannot reach either of them until enough validators restart on a build that has not been released.</p>`;

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
  if (blocks.some((b) => b.text?.includes(SENTINEL))) {
    console.log('  already applied - no write');
    process.exit(0);
  }

  const at = blocks.findIndex((b) => b.text?.includes('id="day-nine-evening-the-release-candidate"'));
  if (at === -1) throw new Error('anchor block not found');
  blocks.splice(at + 1, 0, { id: uid(), type: 'content', text: SECTION });

  const version = '2.22.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  (insert at ${at + 1} of ${blocks.length})`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Day ten: the Radix Accountability Council reports the fix deployed and validated end to end on Stokenet (t.me/RadixAccountabilityCouncil/1012, 18:43 UTC 9 Sep), with Stokenet continuity measured hourly from the Gateway - 12 epochs an hour across 28 consecutive hours - against mainnet unchanged at 213h45m and no release since RC1.', now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
