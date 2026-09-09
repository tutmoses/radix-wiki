// Sweep 397 — the halt page's standing sections had fallen behind its own day sections.
//
// The infobox still read the network status at 23:06 UTC on 7 September and said no
// node release carried the fix; "What is unresolved" still described babylon-node
// pull request #1076 as open and unmerged against `develop`. Both merged and both
// were released on 8 September, and the page's own day-nine sections say so.
//
// Adds day ten, night: the 23:06:50 UTC reading on 9 September, an operator's
// first-person account of how the halt was agreed, and the council's answer on when
// an official incident report arrives.
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'contents/history';
const SLUG = 'hyperlane-asset-drain-2026';
const SENTINEL = 'id="day-ten-night"';

const NEW_SECTION = `<h2 id="day-ten-night">Day ten, night: an operator names the room the halt was agreed in</h2>
<p>Read at <strong>23:06:50 UTC on 9 September 2026</strong>, <a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">the Gateway status endpoint</a> returns the ledger it has returned since the halt: state version 557,840,622, epoch 339,896, round 102. That is <strong>217 hours and 47 minutes</strong> without a committed round, and <code>/state/validators/list</code> answers HTTP 500 counting the same gap, <q>it is currently 9 days, 1 hour, 47 minutes, 44 seconds behind</q>.</p>
<h3 id="the-room-the-halt-was-agreed-in">The room the halt was agreed in</h3>
<p>Who stopped the network came back in the main Radix chat tonight, and this time an operator answered with the mechanism rather than the principle. At <a href="https://t.me/radix_dlt/1002696" target="_blank" rel="noopener">20:10 UTC</a> a holder asked how decentralised Radix is if a handful of node runners and the Foundation can freeze the network in a few hours, and what stops anyone else doing the same. Seventy-two seconds later Timan of <a href="/ecosystem/astrolescent" rel="noopener">Astrolescent</a> replied: <q>It was done by a few dozen node runners.. we have a group where we can chat and share learnings. A few decided it was better to halt until the source of the exploit was found, and explained it to the rest of the group.</q></p>
<p>That names three things the earlier accounts left out. The operators have a standing channel of their own, separate from the Foundation and from the <a href="https://t.me/RadixAccountabilityCouncil" target="_blank" rel="noopener">Radix Accountability Council</a>. A few of them moved first and the rest were persuaded rather than instructed. And the count is a few dozen, which is the order of the set that has to agree again before <a href="/contents/tech/core-concepts/validator-nodes" rel="noopener">validators</a> come back. It is the same account the <a href="#day-three-foundation">Foundation's announcement of 2 September</a> contradicted when it said the Foundation and the council had halted the network, and it is the one the ledger supports.</p>
<h3 id="the-report-comes-after-the-network">The report comes after the network</h3>
<p>Seventeen minutes earlier, at 19:53 UTC, a holder asked whether there is an official write-up of the exploit. projectShift, who has written the council's updates throughout, answered that enough detail is already public, that there will be an official report <q>when the time is proper</q>, and that the things that are safe to do will happen <q>after we have this resolved and network liveness back</q>. The sequencing is deliberate and it is the first time the council has stated it: the account of what happened is being held until the network is running.</p>
<p>Nothing has been published on the release side since. <a href="https://github.com/radixdlt/babylon-node" target="_blank" rel="noopener">babylon-node</a>'s <code>main</code> branch still ends at <code>7400951e</code> of 15:28 UTC on 8 September, so the final commit the council named four hours earlier as the first of its three next steps has not been made, and the branch has taken nothing for 31 hours and 39 minutes.</p>`;

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (blocks.some((b) => (b.text || '').includes(SENTINEL))) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  const replace = (text, find, sub, label) => {
    if (!text.includes(find)) throw new Error(`find-string missed: ${label}`);
    console.log(`  ok: ${label}`);
    return text.replace(find, sub);
  };

  // 1. Infobox: the network-status row was two days behind.
  let ib = blocks[0].blocks[0].text;
  ib = replace(ib,
    'Still halted when re-read at 23:06 UTC, 7 September, one hundred and sixty-nine hours and forty-seven minutes after the last round',
    'Still halted when re-read at 23:06 UTC, 9 September, 217 hours and 47 minutes after the last round',
    'infobox network status');

  // 2. Infobox: a node release has carried the fix since 8 September.
  ib = replace(ib,
    '. No node release carries it yet',
    '. Carried on the node side by babylon-node <a href="https://github.com/radixdlt/babylon-node/releases/tag/v1.4.0.0-RC1" target="_blank" rel="noopener">v1.4.0.0-RC1</a> of 8 September, still flagged a pre-release',
    'infobox fix row');
  blocks[0].blocks[0].text = ib;

  // 3. "What is unresolved" still described the node fix as open and unreleased.
  blocks[32].text = replace(blocks[32].text,
    'pull request #1076</a> against babylon-node, open and unmerged, sets the enactment epoch at 339,898 and refuses user transactions for the epoch before it. It targets <code>develop</code>, which is not the branch babylon-node releases from. The one release the repository has published since the halt, <a href="https://github.com/radixdlt/babylon-node/releases/tag/v1.3.0.5-test.1" target="_blank" rel="noopener"><code>v1.3.0.5-test.1</code></a> of 12:28 UTC on 8 September, was cut from <code>main</code> and carries a build-system change and no fix, so no validator yet has a version to install that does anything.',
    'pull request #1076</a> against babylon-node sets the enactment epoch at 339,898 and refuses user transactions for the epoch before it. It was retargeted from <code>develop</code> to <code>main</code> and merged at 15:28 UTC on 8 September, and seven minutes later the repository published <a href="https://github.com/radixdlt/babylon-node/releases/tag/v1.4.0.0-RC1" target="_blank" rel="noopener"><code>v1.4.0.0-RC1</code></a> from that commit. The release is flagged a pre-release, so <code>/releases/latest</code> and the <code>babylonnode</code> installer both still resolve to <code>v1.3.0.5-test.1</code>, the rebuild of the halted version; the council has asked operators not to run the candidate, and the final release it named as its next step has not been cut.',
    'what is unresolved / node fix');

  // 4. Day ten, night.
  blocks.splice(30, 0, { id: uid(), type: 'content', text: NEW_SECTION });

  const version = '2.23.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  (${page.content.length} -> ${blocks.length} blocks)`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Day ten, night: Timan of Astrolescent describes the operator group the halt was agreed in, and the council says the official report waits for liveness. Corrects the infobox network status (two days stale) and the fix row and "What is unresolved", which still called babylon-node #1076 open and unmerged after it merged and shipped as v1.4.0.0-RC1 on 8 September.', now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
