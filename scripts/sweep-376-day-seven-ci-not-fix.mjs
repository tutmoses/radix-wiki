// Run 376 — day seven of the halt. The fix repository's timestamp moved for the first
// time since day three and none of the movement is the fix: three bot comments and two
// CI-housekeeping pull requests. Meanwhile the protocol upgrade acquires a rehearsal
// ground on Stokenet. Sources: GitHub API readings and t.me/RadixDevelopers/66343.
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'contents/history';
const SLUG = 'hyperlane-asset-drain-2026';
const SENTINEL = 'day-seven-the-repository-moves';

const DAY_SEVEN = `<h2 id="${SENTINEL}">Day seven: the fix repository moves, and none of the movement is the fix</h2>
<p>Read at <strong>11:06:56&nbsp;UTC on 6 September 2026</strong>, <a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">the Gateway status endpoint</a> returns the same ledger for a twenty-ninth consecutive reading: state version 557,840,622, epoch 339,896, round 102, proposer round timestamp 21:19:06.179&nbsp;UTC. That is <strong>one hundred and thirty-three hours and forty-eight minutes</strong> without a committed round. <code>/state/validators/list</code> answers HTTP 500 and counts the gap itself, <q>it is currently 5 days, 13 hours, 47 minutes, 50 seconds behind</q>, with <code>current_sync_delay_seconds</code> 481,670 against a <code>max_allowed_sync_delay_seconds</code> of 720.</p>
<h3 id="the-timestamp-moved-the-commits-did-not">The pull request's timestamp moved; its commits did not</h3>
<p><a href="https://github.com/radixdlt/radixdlt-scrypto/pull/2093" target="_blank" rel="noopener">Pull request #2093</a>, which carries <a href="/contents/tech/releases/protocol-updates" rel="noopener">Eagle Ray</a> and the receiver check <a href="#day-five-the-fix-is-on-github" rel="noopener">day five</a> read line by line, was last updated at <strong>08:04:48&nbsp;UTC on 6 September</strong> &ndash; the first time that stamp has moved since the 13:06:16 reading <a href="#the-fix-has-not-been-touched-since-day-three" rel="noopener">day six</a> recorded, ninety-one hours earlier. It is not the fix that moved. The six commits on the branch still end at <code>722c3f32</code>, <q>Move error to system layer</q>, authored at <strong>11:09:51&nbsp;UTC on 2 September</strong>, and all three comments on the pull request are from <code>github-actions[bot]</code>: the benchmark table of 2 September, and two Docker-tag notices posted this morning at 08:01:22 and 08:04:48 for the images <code>radixdlt/private-scrypto-builder</code> and <code>radixdlt/private-scrypto-dev-container</code>. A GitHub pull request counts a bot comment as an update, so the stamp is not evidence that a review has started. There is still no review comment, and it is still unmerged.</p>
<p>Two more pull requests opened in the repository today, and both are housekeeping. <a href="https://github.com/radixdlt/radixdlt-scrypto/pull/2094" target="_blank" rel="noopener">#2094</a>, <q>Remove unused Phylum CI job; document workflows in .github/README.md</q>, was opened at <strong>09:38:46&nbsp;UTC</strong> against the fix branch <code>0xOmarA/vault-access</code> itself and closed unmerged at 10:54:29; three minutes before that close, <a href="https://github.com/radixdlt/radixdlt-scrypto/pull/2095" target="_blank" rel="noopener">#2095</a> reopened the same five files against <code>develop</code>, where it remains open. Five files of continuous-integration configuration, retargeted from the patch to the mainline. That is the whole of the day's activity in the repository holding the fix, and it is worth noting what it lands on: <code>develop</code>, the branch #2093 is opened against, last took a commit on <strong>27 March 2026</strong>. The node half has not moved either &ndash; <a href="https://github.com/radixdlt/babylon-node/releases" target="_blank" rel="noopener">babylon-node</a>&rsquo;s newest release is still <code>v1.3.0.5</code> of 1 June 2026, and no branch there is named for Eagle Ray.</p>
<h3 id="the-upgrade-gets-a-rehearsal-ground">The upgrade gets a rehearsal ground</h3>
<p>The day&rsquo;s one substantive statement came from the developer channel rather than the repository. At <strong>07:27:12&nbsp;UTC</strong> <a href="/community/daffy" rel="noopener">Daffy</a> <a href="https://t.me/RadixDevelopers/66343" target="_blank" rel="noopener">posted to the Radix Developers group</a>: <q>Stokenet Update. We expect that there we will be some instability and downtime in Stokenet in the coming days in preparation for the protocol upgrade.</q> It is the first public statement that the upgrade is being staged anywhere, and the first thing said about the restart since the halt began that describes an action rather than a state.</p>
<p>Stokenet is Radix&rsquo;s public test network, and it is running. Read at <strong>11:07:28&nbsp;UTC on 6 September</strong>, its Gateway returned state version 6,046,607, epoch 2,583, round 1,151 and a proposer round timestamp of that same second, and <code>/state/validators/list</code> answered HTTP 200 &ndash; the endpoint that has returned 500 on mainnet for six days. The instability being warned about is therefore ahead of the test network rather than behind it: what is coming is the upgrade being rehearsed on a live chain that can afford to break.</p>
<p>This is the first of <a href="#shape-of-the-fix" rel="noopener">the four steps the council named</a> to acquire a schedule of any kind, and the schedule it acquires is a rehearsal rather than a mainnet date. The notice says <q>the coming days</q>; no node release carrying Eagle Ray exists in public on either network; and mainnet restarts only when validators signal readiness for a version they cannot yet download.</p>`;

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

  // Insert day seven after the day-six block, before "Reading your own account".
  const at = blocks.findIndex((b) => (b.text || '').includes('day-six-the-paperwork-moves'));
  if (at < 0) throw new Error('day-six block not found — refusing to guess a position');
  blocks.splice(at + 1, 0, { id: uid(), type: 'content', text: DAY_SEVEN });

  // The infobox network-status row carries a running duration; move it to this reading.
  const box = blocks.find((b) => b.type === 'infobox');
  const row = box?.blocks?.find((n) => (n.text || '').includes('Still halted when re-read at'));
  if (!row) throw new Error('infobox network-status row not found');
  const before = row.text;
  row.text = row.text.replace(
    /Still halted when re-read at [^,]+, \d+ September, [^<]*after the last round/,
    'Still halted when re-read at 11:06:56 UTC, 6 September, one hundred and thirty-three hours and forty-eight minutes after the last round');
  if (row.text === before) throw new Error('network-status replacement did not match');

  const version = '2.14.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  (+1 block at index ${at + 1}, infobox status row moved)`);
  if (DRY) {
    console.log('  status row now:', row.text.slice(0, 260));
    process.exit(0);
  }

  const now = new Date().toISOString();
  const json = JSON.stringify(blocks);
  await client.query('BEGIN');
  await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
     "Day seven: PR #2093's updated stamp moved for the first time since 2 September, and none of the movement is the fix — the six commits still end at 722c3f32 (2 Sep 11:09:51 UTC) and all three comments are github-actions[bot], two of them Docker-tag notices posted 08:01:22 and 08:04:48 UTC today; PRs #2094 and #2095 are CI housekeeping, #2094 opened against the fix branch and closed unmerged, #2095 retargeted at develop, whose last commit is 27 March 2026. Daffy's Stokenet notice (t.me/RadixDevelopers/66343, 07:27:12 UTC) is the first public statement that the protocol upgrade is being staged; Stokenet read live at 11:07:28 UTC (epoch 2,583, round 1,151, validators/list 200). Mainnet's 29th identical reading, 133h48m.",
     now]);
  await client.query('COMMIT');
  console.log('  written');
} finally {
  client.release();
  await pool.end();
}
