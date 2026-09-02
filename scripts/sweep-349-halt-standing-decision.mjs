// Run 349. The halt's second evening. Nothing official moved after the RAC's 12:16 update,
// and no repository anywhere shows a patch — so the readable fact of the evening is the
// mechanism, not the progress: the halt has no lever to throw back. It ends when enough
// individual node runners each decide to restart, and delegators cannot answer at all,
// because answering is a transaction and transactions are exactly what has stopped.
// Sourced to projectShift, the account that has posted the Council's updates through the outage.
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'contents/history';
const SLUG = 'hyperlane-asset-drain-2026';
const SENTINEL = 'id="standing-decision"';
const DRY = process.argv.includes('--dry-run');

const SECTION = `<h2 id="standing-decision">Day two, evening: a halt with no lever to throw back</h2>` +
  `<p>Re-read at <strong>19:04:16 UTC on 1 September 2026</strong>, the <a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">Gateway status endpoint</a> returns the same ledger for the fifth consecutive reading &mdash; state version 557,840,622, epoch 339,896, round 102, proposer round timestamp 21:19:06.179 UTC &mdash; <strong>twenty-one hours and forty-five minutes</strong> without a committed round. Four minutes later <code>/state/validators/list</code> and <code>/state/entity/details</code> both answered HTTP 500 with <code>NotSyncedUpError</code> and stated the gap themselves: <code>current_sync_delay_seconds</code> 78,372 against <code>max_allowed_sync_delay_seconds</code> 720, in the words &ldquo;it is currently 21 hours, 46 minutes, 12 seconds behind&rdquo;.</p>` +
  `<p>Nothing has appeared in any of the places a fix would surface. <a href="https://github.com/radixdlt/babylon-node/releases" target="_blank" rel="noopener">babylon-node</a>'s newest release is still <code>v1.3.0.5</code> of 1 June 2026 and its <code>main</code> branch's last commit is from the same day; <code>develop</code> has not moved since 12 March 2025 and <code>release/cuttlefish</code> since 7 May 2025. The default branch of <a href="https://github.com/radixdlt/radixdlt-scrypto" target="_blank" rel="noopener">radixdlt-scrypto</a> still ends at <code>858c70f1</code> on 27 March 2026. <a href="https://radixdao.org/notices.json" target="_blank" rel="noopener">The DAO's notice feed</a> carries nothing after 29 August, <a href="https://www.radixdlt.com/blog" target="_blank" rel="noopener">the Foundation's blog</a> nothing at all about the incident, and the Council has posted nothing since the four-step account recorded in the section above. Twenty-two hours in, the repair described that morning has left no public trace in any repository.</p>` +
  `<h3>The halt is a standing decision, not a switch</h3>` +
  `<p>What the main channel worked out this evening is that there is no lever to throw back. In two messages at <strong>18:49</strong> and <strong>18:53 UTC</strong>, <a href="https://t.me/radix_dlt/1001231" target="_blank" rel="noopener">projectShift</a> &mdash; the account that has posted the <a href="https://t.me/RadixAccountabilityCouncil/936" target="_blank" rel="noopener">Council's updates</a> through the outage &mdash; set out what the stop actually is: &ldquo;The network's not halted, it's just refusing to produce TX because it lost quorum on stake power, as it is coded to do.&rdquo; It happened because enough independent node runners, holding enough cumulative stake between them, each accepted the plan; and, he added, &ldquo;Some didn't and their nodes are up, for whatever reasons.&rdquo; Had the stake behind the stop fallen short, the network would have kept working, &ldquo;maybe just a tad slower&rdquo;.</p>` +
  `<p>The consequence is that ending it requires no coordinated act either. <a href="https://t.me/radix_dlt/1001233" target="_blank" rel="noopener">&ldquo;Any node-runner is free to reverse their decision and boot the node back up and start regular operations. If enough of them do that, the network regains quorum and liveness and restarts normal operations.&rdquo;</a> There is no switch in the protocol to unset and no signed release to wait on; the halt is a position that a set of operators re-takes every minute it lasts, and it lifts the moment enough of them individually stop taking it. That is a different object from the one the outside reading assumes. The <a href="/contents/tech/core-concepts/validator-nodes" rel="noopener">validators</a> are not obeying an instruction, and no party can rescind one.</p>` +
  `<p>It also means the network's other constituency has no move. Delegated stake is the counterweight to node runners in Radix's design &mdash; unhappy delegators redirect it &mdash; and here it cannot be used, because redirecting a delegation is itself a transaction and transactions are exactly what has stopped. projectShift stated the asymmetry plainly, that delegators &ldquo;cannot change their stake into other nodes, even if they don't agree with node runners&rdquo;, adding that &ldquo;that asymmetry is by design and was always there. And it would take them 7 days to enact anyway&rdquo;: the <a href="/contents/tech/core-concepts/staking" rel="noopener">unstaking</a> delay would run only after a ledger existed to record the request on. So a decision reversible by any one of a hundred operators is, for everyone who delegated to them, not reachable at all. It is the sharpest illustration the network has produced of what the stake-delegation model does and does not give a holder, and it arrived on the day it mattered.</p>`;

const STATUS_OLD = `Still halted when re-read at 15:04 UTC, 1 September, seventeen hours and forty-five minutes after the last round`;
const STATUS_NEW = `Still halted when re-read at 19:04 UTC, 1 September, twenty-one hours and forty-five minutes after the last round`;

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

  const at = blocks.findIndex((b) => (b.text || '').includes('id="shape-of-the-fix"'));
  if (at < 0) throw new Error('anchor section not found');
  blocks.splice(at + 1, 0, { id: uid(), type: 'content', text: SECTION });

  const row = blocks[0]?.blocks?.[0];
  if (!row || !row.text.includes(STATUS_OLD)) throw new Error('infobox network-status row not matched');
  row.text = row.text.replace(STATUS_OLD, STATUS_NEW);

  const version = '2.5.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  blocks ${page.content.length} -> ${blocks.length}, section at ${at + 1}`);
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
       "Day two, evening: at 21h45m the Gateway still returns the halt ledger and no patch exists in babylon-node, radixdlt-scrypto, the blog or the DAO's notice feed. New section on the mechanism, from projectShift at 18:49 and 18:53 UTC — the network is not halted but out of quorum, any node runner can restore liveness unilaterally, and delegated stake cannot answer because redirecting it is itself a transaction. Infobox network-status re-dated.", now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
