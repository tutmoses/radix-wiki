// sweep-342-hyperscale-multistage-routes.mjs
//
// /contents/tech/research/hyperscale-rs is the sixth-busiest page on the wiki
// (72 visitors / 30d) and the rotation category this run. Two things said in
// t.me/hyperscale_rs on 30 August 2026 are absent from it:
//
//   1. The lead developer conceded that cross-shard atomic commitment under
//      partial execution sharding replicates execution MORE than a monolithic
//      system does, and described the mitigation he is building: multi-stage
//      transaction routes, escrow -> atomic core -> total settlement, so the
//      atomic core touches a single shard. Checked against both specs repos
//      before writing (backlog item, run 334): neither documents it.
//   2. The first public arithmetic for what an increment of throughput costs
//      in validators (another 128 nodes plus a free pool), the answer to what
//      a demand spike does (shards split), and the state of the node client.
//
// Appends one <h3> to the Contention block and one to the Running a Node
// block, addressed by block id rather than by matching stored HTML.
//
//   node scripts/sweep-342-hyperscale-multistage-routes.mjs --dry-run
//   node scripts/sweep-342-hyperscale-multistage-routes.mjs

import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'contents/tech/research';
const SLUG = 'hyperscale-rs';
const VERSION = '6.17.0';

const CONTENTION_BLOCK = '9d133933-d256-46ef-b4ec-51f1527041f5';
const NODE_BLOCK = '264fe2a5-e24c-49f7-9fee-6660de937d36';
const SENTINEL = 'escrow &rarr; atomic core &rarr; total settlement';

const TG = (id) => `https://t.me/hyperscale_rs/${id}`;

const CONTENTION_ADDENDUM = `
<h3>Multi-stage routes, and the redundancy the design still carries (August 2026)</h3>
<p>The rework above attacks contention <em>inside</em> a shard. On 30 August 2026, in a channel argument about whether Hyperscale's lighter nodes amount to an energy story, the lead developer stated the cost that sits on the other axis, and it is a concession the project's own documentation does not make: <a href="${TG(11207)}" target="_blank" rel="noopener">"cross-shard atomic commitment via only partial execution sharding means you're actually replicating the same execution more times than you would in a monolithic system"</a>.</p>
<p>That follows from the pipeline described under <em>Architecture</em>. Because every shard owning declared state runs the transaction, a transaction spanning several shards is executed once per shard, where a single-ledger chain executes it once. Sharding buys parallelism <em>between</em> transactions and pays for it in duplicated work <em>within</em> one, and the bill grows with how many shards a transaction reaches.</p>
<p>The same message describes the mitigation, in the first person and as work in progress: <a href="${TG(11207)}" target="_blank" rel="noopener">"i'm working through breaking transactions into multi-stage routes with a pattern of escrow-&gt;atomic core-&gt;total settlement stages"</a>. The stated motive is not the duplicated compute. It is contention: <a href="${TG(11207)}" target="_blank" rel="noopener">"not particularly for the purpose only reducing redundant compute... but mostly because if the common pattern is that the atomic core can touch only one shard - that's much better for contended throughput"</a>, and the case he names for it is the obvious one, <a href="${TG(11207)}" target="_blank" rel="noopener">"the classic pattern of many users from many shards just hitting a single swap pool"</a>. The shape of the answer is to shrink the atomically committed part of a cross-shard transaction down to a single shard and push the rest into stages either side of it, so that the swap pool's shard is the only one that has to agree with anybody.</p>
<p><strong>It is a design in conversation, not a specification.</strong> As of 31 August 2026 neither repository carries it. The ten architecture documents in <a href="https://github.com/hyperscalers/hyperscale-rs/tree/main/docs" target="_blank" rel="noopener">hyperscale-rs/docs</a> describe cross-shard commitment only as the single <a href="https://github.com/hyperscalers/hyperscale-rs/blob/main/docs/04-atomic-commitment.md" target="_blank" rel="noopener">provision, execute, certify</a> pipeline, and contain no occurrence of "escrow" or of a multi-stage route; the sole "escrow" anywhere in <a href="https://github.com/hyperscalers/hyperscale-vm/tree/main/docs" target="_blank" rel="noopener">hyperscale-vm/docs</a> is an unrelated reference to call and escrow boundary values in the canonical ABI. This page records the design at the weight it currently has, which is a statement by the person writing the code.</p>`;

const NODE_ADDENDUM = `
<h3>What another shard costs, and what a demand spike does (August 2026)</h3>
<p>The figures above price one node. On 30 August 2026 a channel member argued that Hyperscale's node requirements were a genuine differentiator against other networks, <a href="${TG(11203)}" target="_blank" rel="noopener">"a big issue on most nets, Radix included"</a>. The lead developer declined the energy framing, and in declining it gave the first public arithmetic for what capacity costs in validators rather than in hardware: to get more throughput <a href="${TG(11204)}" target="_blank" rel="noopener">"you have to have another 128 nodes online (granted there is some variable amortization via vnodes)... plus you need a free pool online to draw shuffle replacements from"</a>. Both halves are protocol rather than rhetoric. A split is <a href="https://github.com/hyperscalers/hyperscale-rs/blob/main/docs/02-dynamic-sharding.md" target="_blank" rel="noopener">gated on the free validator pool being deep enough to staff it</a>, and the epoch fold prices activation against <a href="https://github.com/hyperscalers/hyperscale-rs/blob/main/docs/00-overview.md" target="_blank" rel="noopener">committees times committee size, plus a standing reserve</a>. What is new is the framing: an increment of throughput has a validator price, and the standing reserve is part of it. The 100-shard version of the same arithmetic, <a href="${TG(11206)}" target="_blank" rel="noopener">12,800 small validator nodes against Solana's roughly 1,000 large ones</a>, is the channel member's extrapolation and not a project figure.</p>
<p>Later that day another member put <a href="${TG(11213)}" target="_blank" rel="noopener">four questions</a> to the developer, and the <a href="${TG(11214)}" target="_blank" rel="noopener">four answers</a> are the most compact statement of the operating story so far. Throughput and latency under realistic DeFi load "depends on the hardware and network links of the validators". Running a node is "not very" painful, with a qualification that dates the client work: a GUI validator client is "still pending building", and the goal is "for complete amateurs to be able to run". A demand spike is answered by topology rather than by headroom, "shards split into more shards (as long as there are enough free nodes to support a split) freeing up more execution capacity", which is the same free-pool dependency arriving from the user's side. The fourth question, on whether the architecture forces redundancy that eats the theoretical gains, was returned as a question, and the answer to it is the multi-stage routing work recorded under <em>Contention</em> above. One follow-up sharpened the third: how well splitting absorbs a spike depends <a href="${TG(11216)}" target="_blank" rel="noopener">mechanically on how fast a shard splits</a>, which is a latency the project has not published.</p>
<p>On power specifically the developer put a home node below noticeability, <a href="${TG(11217)}" target="_blank" rel="noopener">"doing Radix-level TPS... won't even add enough to your computers power draw to appear as a rounding error on your electric bill"</a>, and in the same exchange gave an unflattering reading of what today's mainnet actually costs to run: <a href="${TG(11222)}" target="_blank" rel="noopener">"everyone is just basically signing empty blocks at the moment. Babylon <em>should</em> only really need a small fraction of a single core... it's crazy inefficient"</a>. He then declined to quantify any of it, which is the caveat the rest of this section should be read under: <a href="${TG(11225)}" target="_blank" rel="noopener">"people can provide their own experience with energy use during testnets. it's not worth spending any time thinking about before then. particularly as the software is pre-alpha and still changing every day"</a>. Nothing here is a measurement.</p>`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);

  // The find-strings are block ids, but the appended HTML must still be free of
  // U+00A0 or the sentinel check below can never match on a re-run.
  for (const [name, html] of [['contention', CONTENTION_ADDENDUM], ['node', NODE_ADDENDUM]]) {
    if (html.includes(' ')) throw new Error(`${name} addendum contains U+00A0`);
  }

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
    [TAG_PATH, SLUG],
  );
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (blocks.some((b) => b.text?.includes(SENTINEL) || b.text?.includes('escrow-&gt;atomic core'))) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  const patch = (id, addendum, label) => {
    const b = blocks.find((x) => x.id === id);
    if (!b) throw new Error(`block ${id} (${label}) not found`);
    if (!b.text) throw new Error(`block ${id} (${label}) has no text`);
    b.text += addendum;
  };
  patch(CONTENTION_BLOCK, CONTENTION_ADDENDUM, 'Contention');
  patch(NODE_BLOCK, NODE_ADDENDUM, 'Running a Node');

  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${VERSION}`);
  console.log(`  + 2 subsections, ${CONTENTION_ADDENDUM.length + NODE_ADDENDUM.length} chars`);

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [
      json, VERSION, now, page.id,
    ]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        cuid(), page.id, json, page.title, VERSION, 'minor', AUTHOR_ID,
        'Record two things stated in t.me/hyperscale_rs on 30 August 2026. Under Contention: the lead developer conceded ' +
        'that cross-shard atomic commitment under partial execution sharding replicates execution more than a monolithic ' +
        'system does, and described the multi-stage route he is building (escrow, atomic core, total settlement) to keep ' +
        'the atomic core on one shard for the many-users-one-pool case; verified absent from both repositories\' docs. ' +
        'Under Running a Node: the first public validator-count price for an increment of throughput (another 128 nodes ' +
        'plus a standing free pool), shard splitting as the answer to a demand spike, the still-pending GUI validator ' +
        'client, and his refusal to quantify energy ahead of testnets.',
        now,
      ],
    );
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
