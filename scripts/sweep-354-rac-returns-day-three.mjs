import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/history';
const SLUG = 'hyperlane-asset-drain-2026';
const SENTINEL = 'day-three-council-returns';
const DRY = process.argv.includes('--dry-run');

const SECTION = `<h2 id="${SENTINEL}">Day three, afternoon: the council returns, and the DAO's own clock stops with the network</h2>
<p>Read at <strong>15:10:08&nbsp;UTC on 2 September 2026</strong>, <a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">the Gateway status endpoint</a> returns the same ledger for a ninth consecutive reading: state version 557,840,622, epoch 339,896, round 102, proposer round timestamp 21:19:06.179&nbsp;UTC. That is <strong>forty-one hours and fifty-one minutes</strong> without a committed round. <code>/state/validators/list</code> still answers HTTP 500 and still counts the gap itself, now <code>current_sync_delay_seconds</code> 150,662 against a <code>max_allowed_sync_delay_seconds</code> of 720. Nothing has been published where a fix would appear: <a href="https://github.com/radixdlt/babylon-node/releases" target="_blank" rel="noopener">babylon-node</a>'s newest release is still <code>v1.3.0.5</code> of 1 June 2026.</p>
<p>The council spoke again at <strong>13:49:11&nbsp;UTC</strong>. <a href="https://t.me/RadixAccountabilityCouncil/958" target="_blank" rel="noopener">Its status update</a>, posted by projectShift, is the first since <a href="https://t.me/RadixAccountabilityCouncil/936" target="_blank" rel="noopener">the four-step account of the fix</a> at 12:16&nbsp;UTC the previous day, which had promised the next one around the same time the next day. It arrived twenty-five hours and thirty-three minutes later, an hour and a half past that.</p>
<p>On the repair it adds confidence and no dates. Progress is called excellent, the team handling it solid, and testing extensive and continuing, on the reasoning that there is only one chance to get the restart right; there are <q>still no hard dates to commit to</q>. The people doing the work stay unnamed, deliberately, with disclosure deferred to the aftermath. That leaves the public record of the repair where <a href="#day-three-foundation">the morning's section</a> found it: statements about work, and no artefact anyone outside can check.</p>
<h3 id="the-legal-and-exchange-track">The legal and exchange track</h3>
<p>Two operational lines are new. The Foundation has taken legal steps over the hack, and the council says an update on them will come direct from Andy, whom it does not further identify; the Radix Foundation's chief executive is <a href="/community/andy-jarrett" rel="noopener">Andy Jarrett</a>. Separately, coordination with exchanges, market makers and other partners is running through the Foundation rather than the council, and covers both the current state of the network and when and how it returns to liveness. The council adds one limit that matters to holders: whether trading continues inside any given exchange is that exchange's decision alone, which is consistent with <a href="#off-the-chain">the pattern recorded on day two</a>, where XRD markets stayed open while deposits and withdrawals did not.</p>
<h3 id="the-ratification-clock">The halt stops the DAO's constitutional clock</h3>
<p>The update's third section is the one with a consequence beyond the incident. The Radix DAO opened the Discussion phase on <a href="/ideas/radix-network-dao-charter" rel="noopener">its Governance Framework</a> at 17:30&nbsp;UTC on 30 August, for a stated seven days, which would have closed it on 6 September. Because a halted ledger offers no way to run a Temperature Check or a ballot, the Transition RAC has removed the limit and will keep the phase open for as long as it is needed. The council's argument for doing so is that reading and challenging the twenty-one documents is the one useful thing still available while nothing can be transacted.</p>
<p>The effect is that the network's stoppage has propagated into the DAO's own timetable. Ratification is Activation Condition 6 of the Operating Agreement, and <a href="/ideas/dao-elect-permanent-rac" rel="noopener">the Permanent RAC election</a> cannot open until the framework is ratified, so an outage on the ledger now sits upstream of the transition it was meant to be independent of. Measured at 15:10&nbsp;UTC, three days into the phase, <a href="https://radixtalk.com/t/charter-policies-ratification-discussion/2330" target="_blank" rel="noopener">the anchor discussion topic</a> holds 13 posts from four accounts and 151 views, eight of the thirteen written by the council member who opened it.</p>`;

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
  if (blocks.some((b) => (b.text || '').includes(SENTINEL))) {
    console.log('  already applied, no write');
    process.exit(0);
  }

  const anchor = blocks.findIndex((b) => (b.text || '').includes('day-three-foundation'));
  if (anchor < 0) throw new Error('day-three-foundation anchor not found');
  blocks.splice(anchor + 1, 0, { id: uid(), type: 'content', text: SECTION });

  const version = '2.8.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  section inserted at block ${anchor + 1} of ${blocks.length}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Ninth gateway reading at 15:10 UTC (41h51m, sync delay 150,662s) and the RAC status update of 13:49 UTC 2 September: no hard dates, the repair team unnamed until the aftermath, Foundation legal steps with an update to come from Andy, exchange coordination via the Foundation, and the DAO Discussion phase left open indefinitely because a halted ledger cannot hold a ballot.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
