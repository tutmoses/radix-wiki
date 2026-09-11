// sweep 408 — the network restarts.
//
// Radix mainnet committed its first round in ten days at 11:35:28.96 UTC on 11 September 2026.
// This records the restart on the halt page, corrects the halt boundary the page has carried
// since 31 August (the Gateway status endpoint under-reported the ledger tip by five state
// versions), and retires the "the ledger has stopped" framing in "What is unresolved".
//
// Every figure below was read from the ledger or from a served page during the run:
//   /stream/transactions from_ledger_state 557840615 asc   — the halt boundary, both sides
//   /stream/transactions from_ledger_state 557840693 asc   — epoch 339,898 round 2 contents
//   /transaction/committed-details txid_rdx1n23szuw…       — the VaultDrainer publish
//   validators.stakesafe.net served HTML at 13:10 UTC      — adoption and stake figures
//
// Run:  node scripts/sweep-408-network-restart.mjs [--dry-run]

import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'contents/history';
const SLUG = 'hyperlane-asset-drain-2026';
const SENTINEL = 'sweep408-restart';

const RESTART_SECTION = `<h2 id="sweep408-restart">Day twelve, midday: the network restarts</h2>
<p>Radix mainnet committed a round at <strong>11:35:28.96&nbsp;UTC on 11 September 2026</strong>, its first in ten days. The restart is legible in <a href="https://mainnet.radixdlt.com/stream/transactions" target="_blank" rel="noopener">the transaction stream</a> as two consecutive ledger entries with nothing between them: state version 557,840,627 carries epoch 339,897 round 4 at 21:19:48.939&nbsp;UTC on 31 August, and state version 557,840,628 carries epoch 339,897 round 5 at 11:35:28.96&nbsp;UTC on 11 September. Measured between those two rounds the network was down for <strong>254 hours, 15 minutes and 40 seconds</strong>, ten days and fourteen hours.</p>
<p>Those state versions correct a number this page has repeated for twelve days. Every reading recorded above came from <a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">the Gateway status endpoint</a>, which reported the frozen ledger as state version 557,840,622 at epoch 339,896 round 102, timestamped 21:19:06.179&nbsp;UTC. The transaction stream shows the ledger ran five state versions past that point before it stopped, through epoch 339,897 rounds 1 to 4 and three further user transactions, and the last of them is timestamped 21:19:48.939&nbsp;UTC, forty-three seconds later than the halt time this page has been citing. The Gateway's status reading was its aggregator's tip rather than the ledger's, and the gap it left was invisible for as long as neither number moved.</p>
<p>The restart itself ran exactly as the node software specified it. Epoch 339,897 resumed under the user transaction moratorium and produced rounds 5 to 106 between 11:35:28.96 and 11:39:07.213&nbsp;UTC, and every ledger entry in that window is a system transaction: the network was certifying rounds and refusing user payloads, which is what the moratorium is for. The fork then enacted at the start of epoch 339,898, and at <strong>11:39:25.129&nbsp;UTC</strong> round 2 of that epoch committed 17 user transactions at once, five of them failing, as the queue that had been waiting ten days cleared. Just under four minutes of empty blocks separate the network coming back from the network being usable.</p>
<p>Adoption crossed the threshold during the morning and kept going. This page recorded 31.22% of active validator-set stake on babylon-node v1.4.0.0 at 07:12&nbsp;UTC; read from <a href="/ecosystem/stakesafe" rel="noopener">StakeSafe</a>'s <a href="https://validators.stakesafe.net" target="_blank" rel="noopener">adoption dashboard</a> at 13:10&nbsp;UTC, 3,737,284,159&nbsp;XRD is on v1.4.0.0, <strong>80.85%</strong> of a 4,873,528,908&nbsp;XRD active set, and 81.67% of that set has a node online. The dashboard now leads with a banner of its own, reporting network liveness restored following a fix deployed at epoch 339,898.</p>
<p>The caveat this page attached to the morning reading turned out to be the whole of it. At 07:12 the twelve largest validators all read a v1.3 version and all read offline, and this page noted that the explorer reports the version a node last advertised, so an offline validator shows whatever it was running when it stopped. <a href="https://t.me/radix_dlt/1003000" target="_blank" rel="noopener">Faraz put it directly</a> in the main Radix group at 10:11:24&nbsp;UTC, answering a member asking why the ten largest validators could not spare ten minutes: the state was intentional, the largest nodes were upgraded and waiting to boot together, and the aim was to come back well clear of two thirds rather than marginally above it. <a href="https://t.me/radix_dlt/1002990" target="_blank" rel="noopener">Daffy had said the same</a> sixteen minutes earlier in one line. The table was not showing a stalled upgrade. It was showing a coordinated one, held back on purpose.</p>
<p>Nothing official has announced any of it. The <a href="https://t.me/RadixAccountabilityCouncil/1019" target="_blank" rel="noopener">Radix Accountability Council's most recent message</a> is still the 16:15&nbsp;UTC instruction of 10 September telling operators to upgrade, and neither the Foundation's blog nor the announcements channel has posted since the network came back. That is the stated plan rather than an oversight: asked on the morning of 11 September whether an announcement would precede the fork, <a href="https://t.me/RadixDevelopers/66385" target="_blank" rel="noopener">Daffy answered</a> that there would be none, because the moment could not be predicted, and <a href="https://t.me/RadixDevelopers/66387" target="_blank" rel="noopener">gave the order plainly</a> as secure liveness first, announce after. <a href="https://docs.radixdlt.com/docs/eagle-ray" target="_blank" rel="noopener">The documentation page for Eagle Ray</a> still answers HTTP 404, an hour after the update it is supposed to document enacted on mainnet.</p>
<p>The first published test of the fix is on the ledger, and it is the exploit. At <strong>12:35:05.915&nbsp;UTC</strong>, fifty-six minutes after user transactions resumed, <a href="https://dashboard.radixscan.io/transaction/txid_rdx1n23szuw226jqjhqt2v8zeguwh545xlyarmwfg0g3dgcsfy4dnceqf4a269/summary" target="_blank" rel="noopener">a transaction in epoch 339,909</a> published a package to mainnet whose blueprint is named <code>VaultDrainer</code> and whose methods are <code>drain</code> and <code>drain_victim_pays</code>. It committed successfully for a fee of 14.14&nbsp;XRD, which is a package publish succeeding rather than a drain succeeding. The operator who submitted it <a href="https://t.me/RadixDevelopers/66391" target="_blank" rel="noopener">said why in the developer group</a> a minute earlier: it is the drainer that had been hammering the unpatched network, the moratorium and the enacted network through testing, and it is on mainnet to verify the fix is operative against live vaults.</p>
<p>One reading does not agree with the rest, and is recorded here rather than resolved. The same StakeSafe dashboard's network summary still names the enacted protocol Cuttlefish, which is the version Eagle Ray replaces. The ledger behaviour is not ambiguous about which software produced these epochs, since the user transaction moratorium is a v1.4.0.0 feature and the network observed it for a hundred rounds, so the likeliest reading is a summary field that lags rather than a contradiction. Neither the Gateway's <code>network-configuration</code> nor its <code>network-status</code> response carries a protocol version, so it has not been confirmed from a second source.</p>`;

const OLD_UNRESOLVED_OPEN =
  '<h2>What is unresolved</h2><p>The cause is no longer one of them. Three questions stand in its place, and the ledger cannot answer any of them because the ledger has stopped.</p>';

const NEW_UNRESOLVED_OPEN =
  '<h2>What is unresolved</h2><p>The cause is no longer one of them, and since 11 September neither is the restart. Two questions stand where three did, and the ledger can be asked about them again.</p>';

const OLD_FIRST_QUESTION_START = '<p>The first is the fix and the resumption.';
const NEW_FIRST_QUESTION =
  '<p>The first is whether the fix holds, and what the twelve days cost. The Engine half was published on 2 September as <a href="https://github.com/radixdlt/radixdlt-scrypto/pull/2093" target="_blank" rel="noopener">pull request #2093</a>, which introduces the <a href="/contents/tech/releases/protocol-updates" rel="noopener">Eagle Ray</a> protocol update and the receiver check it exists to carry; it merged on 7 September and released the same evening as Scrypto v1.4.0. The node half was published on 8 September as <a href="https://github.com/radixdlt/babylon-node/pull/1076" target="_blank" rel="noopener">pull request #1076</a>, which sets the enactment epoch at 339,898 and refuses user transactions for the epoch before it, and it shipped final as babylon-node <a href="https://github.com/radixdlt/babylon-node/releases/tag/v1.4.0.0" target="_blank" rel="noopener">v1.4.0.0</a> at 03:59&nbsp;UTC on 10 September. Both halves are now running: the fork enacted at 11:39&nbsp;UTC on 11 September with 80.85% of active stake on the release. What has not been published is any account of the flaw. The council said the official report waits for liveness, and liveness arrived at 11:35&nbsp;UTC that morning. Nor has the validator set finished arriving, with 19.15% of active stake still on a version that predates the fork.</p>';

const INFOBOX_OLD_STATUS =
  'Halted 21:19:06 UTC, 31 August 2026 – last round: epoch 339,896, round 102. Still halted when re-read at 11:12 UTC, 10 September, 229 hours and 53 minutes after the last round';
const INFOBOX_NEW_STATUS =
  'Halted after epoch 339,897 round 4 at 21:19:48 UTC, 31 August 2026. Restarted at epoch 339,897 round 5, 11:35:28 UTC on 11 September 2026; user transactions resumed at epoch 339,898 round 2, 11:39:25 UTC. Down for 254 hours, 15 minutes and 40 seconds';

const INFOBOX_OLD_FIX = 'The council has asked operators not to install it yet';
const INFOBOX_NEW_FIX =
  'Enacted unconditionally at the start of epoch 339,898, 11:39 UTC on 11 September 2026, with 80.85% of active validator-set stake on the release';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  ssl: { rejectUnauthorized: false },
});
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
    [TAG_PATH, SLUG],
  );
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));

  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  // 1. infobox: the status row and the tail of the fix row.
  const info = blocks[0];
  if (info?.type !== 'infobox') throw new Error('block 0 is not the infobox');
  const tbl = info.blocks[0];
  for (const [oldText, newText] of [
    [INFOBOX_OLD_STATUS, INFOBOX_NEW_STATUS],
    [INFOBOX_OLD_FIX, INFOBOX_NEW_FIX],
  ]) {
    if (!tbl.text.includes(oldText)) throw new Error(`infobox substring not found: ${oldText.slice(0, 60)}…`);
    tbl.text = tbl.text.replace(oldText, newText);
  }

  // 2. "What is unresolved": new opening, and the first question is now answered.
  const ui = blocks.findIndex((b) => typeof b.text === 'string' && b.text.includes('<h2>What is unresolved</h2>'));
  if (ui < 0) throw new Error('"What is unresolved" block not found');
  const u = blocks[ui];
  if (!u.text.includes(OLD_UNRESOLVED_OPEN)) throw new Error('unresolved opening not found verbatim');
  u.text = u.text.replace(OLD_UNRESOLVED_OPEN, NEW_UNRESOLVED_OPEN);

  const qStart = u.text.indexOf(OLD_FIRST_QUESTION_START);
  if (qStart < 0) throw new Error('first-question paragraph not found');
  const qEnd = u.text.indexOf('</p>', qStart) + 4;
  u.text = u.text.slice(0, qStart) + NEW_FIRST_QUESTION + u.text.slice(qEnd);

  // 3. the restart section, immediately before "What is unresolved".
  blocks.splice(ui, 0, { id: uid(), type: 'content', text: RESTART_SECTION });

  const version = '2.27.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}`);
  console.log(`    v${page.version} -> v${version}`);
  console.log(`    blocks ${page.content.length} -> ${blocks.length} (restart section at index ${ui})`);
  console.log(`    chars ${JSON.stringify(page.content).length} -> ${JSON.stringify(blocks).length}`);

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [
      json,
      version,
      now,
      page.id,
    ]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        cuid(),
        page.id,
        json,
        page.title,
        version,
        'minor',
        AUTHOR_ID,
        'Day twelve, midday: the network restarted at 11:35:28.96 UTC on 11 September 2026, epoch 339,897 round 5, after 254h 15m 40s; user transactions resumed at epoch 339,898 round 2 at 11:39:25.129 UTC with 17 in one round. Corrects the halt boundary this page has cited since 31 August: the Gateway status endpoint reported 557,840,622 / epoch 339,896 round 102 / 21:19:06.179 UTC, but /stream/transactions shows the ledger ran to 557,840,627 / epoch 339,897 round 4 / 21:19:48.939 UTC. Adoption 80.85% of active stake (StakeSafe, 13:10 UTC). Records the VaultDrainer republish at 12:35:05.915 UTC as the first live test of the fix, that no official channel has announced the restart, and that the dashboard still labels the enacted protocol Cuttlefish. Retires the "the ledger has stopped" framing in What is unresolved.',
        now,
      ],
    );
    await client.query('COMMIT');
    console.log('    written');
  }
} finally {
  client.release();
  await pool.end();
}
