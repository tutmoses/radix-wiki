import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

// Run 371, contents/history rotation. Day six of the halt: the ledger has not
// moved and neither has the fix, while the DAO's off-chain formation did.
// Sources read 5 September 2026 and named inline.

const TAG_PATH = 'contents/history';
const SLUG = 'hyperlane-asset-drain-2026';
const SENTINEL = 'day-six-the-paperwork-moves';
const DRY = process.argv.includes('--dry-run');

const DAY_SIX = `<h2 id="${SENTINEL}">Day six: the ledger has not moved, the fix has not moved, the paperwork has</h2>
<p>Read at <strong>15:03:41&nbsp;UTC on 5 September 2026</strong>, <a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">the Gateway status endpoint</a> returns the same ledger for a twenty-fifth consecutive reading: state version 557,840,622, epoch 339,896, round 102, proposer round timestamp 21:19:06.179&nbsp;UTC. That is <strong>one hundred and thirteen hours and forty-four minutes</strong> without a committed round. <code>/state/validators/list</code> answers HTTP 500 and counts the gap itself, <q>it is currently 4 days, 17 hours, 47 minutes, 47 seconds behind</q>, with <code>current_sync_delay_seconds</code> 409,667 against a <code>max_allowed_sync_delay_seconds</code> of 720.</p>
<h3 id="the-fix-has-not-been-touched-since-day-three">The fix has not been touched since day three</h3>
<p><a href="https://github.com/radixdlt/radixdlt-scrypto/pull/2093" target="_blank" rel="noopener">Pull request #2093</a>, which carries <a href="/contents/tech/releases/protocol-updates" rel="noopener">Eagle Ray</a> and the receiver check <a href="#day-five-the-fix-is-on-github" rel="noopener">day five</a> read line by line, was last updated at <strong>13:06:16&nbsp;UTC on 2 September</strong>. That is <strong>seventy-four hours</strong> before this reading, and the state at both ends is identical: open, six commits, no review comments, unmerged against <code>develop</code>. The node half is where day five left it too &ndash; <a href="https://github.com/radixdlt/babylon-node/releases" target="_blank" rel="noopener">babylon-node</a>&rsquo;s newest release is still <code>v1.3.0.5</code> of 1 June 2026, and none of the repository&rsquo;s 183 branches is named for Eagle Ray. A protocol update reaches mainnet only when validators signal readiness for a node version that contains it, and no such version exists in public.</p>
<h3 id="what-the-post-mortem-waits-on">The post-mortem waits on the restart, and the audits are under investigation</h3>
<p>The main Radix group spent the middle of the day arguing about who should have caught the flaw. <a href="/community/daffy" rel="noopener">Daffy</a>, the community contributor who maintains <a href="https://github.com/RadixDAO/governance-framework" target="_blank" rel="noopener">the DAO&rsquo;s governance repository</a>, answered three questions in it and each answer is new to the public record. At <strong>11:34:59&nbsp;UTC</strong> he <a href="https://t.me/radix_dlt/1002009" target="_blank" rel="noopener">asked the group to stop discussing the matter in public</a> until the network is patched and running. At <strong>12:04:27&nbsp;UTC</strong>, asked whether anyone could yet explain where the bug was and how it passed the security reviews, he <a href="https://t.me/radix_dlt/1002026" target="_blank" rel="noopener">said the bug and its history are known</a> and that <q>why the Audits did not capture it is still under investigation</q>. At <strong>12:07:57&nbsp;UTC</strong>, asked how the report could be read, he <a href="https://t.me/radix_dlt/1002029" target="_blank" rel="noopener">put it after the restart</a>: <q>After the network is patched and running smoothly again.</q></p>
<p>This is the first public statement that a written post-mortem exists as a commitment rather than an expectation, and the first that the audit history is itself being examined. Neither carries a date, and both are attributed to a contributor rather than to <a href="/ecosystem/radix-foundation">the Foundation</a>, whose <a href="https://www.radixdlt.com/blog" target="_blank" rel="noopener">blog</a> still carries nothing about the incident six days on.</p>
<h3 id="the-daos-clock-restarts-off-the-chain">The DAO's clock restarts, off the chain</h3>
<p>The one thing that did move today moved where the ledger cannot reach it. At <strong>13:17:43&nbsp;UTC</strong> the Transition RAC member Tadkis <a href="https://t.me/RadixAccountabilityCouncil/988" target="_blank" rel="noopener">told the council&rsquo;s channel</a> that <q>the agreement with MIDAO has been signed and the registration fee has been paid</q>, and that the formal registration process is scheduled to begin on Monday &ndash; 7 September 2026. An hour later projectShift <a href="https://t.me/radix_dlt/1002055" target="_blank" rel="noopener">relayed it to the main group</a> as <q>Step one of the DAO is actually done now</q>.</p>
<p>Two things are worth holding together. The first is that this is the step <a href="/ecosystem/radix-accountability-council" rel="noopener">the council</a> said on 29 August would roll out <q>from Monday onwards</q>, meaning 31 August; it completed six days later, and the four-to-six week registry clock the council quoted starts from 7 September rather than from the end of August. The second is the contrast with <a href="#the-ratification-clock" rel="noopener">what the halt did to the DAO&rsquo;s other clock</a>: ratification of the Governance Framework needs a vote the stopped ledger cannot hold, and remains open-ended. Incorporation runs through a registry in Majuro and does not care that Radix has stopped. The transition is now advancing on its off-chain leg alone.</p>`;

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
    console.log('  already applied - no write');
    process.exit(0);
  }

  // 1. infobox: refresh the Network status row, which still reports the 2 September re-read.
  const box = blocks[0];
  if (box.type !== 'infobox') throw new Error('block 0 is not the infobox');
  const inner = box.blocks[0];
  const before = inner.text;
  inner.text = inner.text.replace(
    /Still halted when re-read at[^<]*/,
    'Still halted when re-read at 15:03:41 UTC, 5 September, one hundred and thirteen hours and forty-four minutes after the last round');
  if (inner.text === before) throw new Error('infobox status row did not match');

  // 2. append the day-six section ahead of "Where the assets went".
  const at = blocks.findIndex((b) => (b.text || '').includes('<h2>Where the assets went</h2>'));
  if (at < 0) throw new Error('anchor block "Where the assets went" not found');
  blocks.splice(at, 0, { id: uid(), type: 'content', text: DAY_SIX });

  const version = '2.12.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  (${page.content.length} -> ${blocks.length} blocks)`);
  console.log(`  infobox status row now: ...${inner.text.match(/Still halted[^<]*/)[0]}`);

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
       'Day six: 25th identical Gateway reading at 15:03:41 UTC (113h44m, sync delay 409,667s); PR #2093 untouched for 74 hours with no review and no Eagle Ray branch in babylon-node; Daffy states the post-mortem follows the restart and the audits are under investigation (t.me/radix_dlt/1002009, /1002026, /1002029); MIDAO agreement signed and fee paid, filing begins 7 September (t.me/RadixAccountabilityCouncil/988).', now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
