// Run 365, signal edit. On 4 September 2026 at 12:44 UTC the hyperscale-rs lead
// developer named and specified the multi-stage route design this page has
// carried since 30 August as an unnamed sketch. Appends the named version to the
// Contention section, checked against both repositories the same day.
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'contents/tech/research';
const SLUG = 'hyperscale-rs';
const BLOCK_ID = '9d133933-d256-46ef-b4ec-51f1527041f5';
const SENTINEL = 'leg local execution';
const DRY = process.argv.includes('--dry-run');

const SECTION = `
<h3 id="leg-local-execution">&ldquo;Leg local execution&rdquo;: the route acquires a name (4 September 2026)</h3>
<p>Five days later the sketch above was named and specified, still in the channel and still ahead of either repository. At 12:44&nbsp;UTC on 4 September 2026, with mainnet in its ninetieth hour of <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">halt</a>, the lead developer described what he is <a href="https://t.me/hyperscale_rs/11969" target="_blank" rel="noopener">&ldquo;for lack of a better name&hellip; calling &lsquo;leg local execution&rsquo;&rdquo;</a>, and placed it at &ldquo;where the rubber meets the road in terms of getting the state contention payoffs of a redesigned VM&rdquo;. The message is authorship-verified through its <a href="https://t.me/hyperscale_rs/11969?embed=1&amp;mode=tme" target="_blank" rel="noopener">public embed</a>.</p>
<p><strong>The failure mode, stated concretely.</strong> Twelve users on twelve different shards want to swap against one XYZ/USDC pool. Under the naive atomic commitment described under <em>Architecture</em> above, the taker&rsquo;s shard and the pool&rsquo;s shard trade state and both run the whole transaction, which blocks the next one and so on down the queue, so &ldquo;the taker who was unluckiest in the ordering might be waiting over a minute for his swap&rdquo;. His conclusion about that outcome is the sharpest statement of the stakes the project has published: in practice &ldquo;any hyperscale network would end up being dogshit for defi&rdquo;.</p>
<p><strong>Three stages.</strong> A transaction is decomposed into <strong>inbound legs</strong>, which &ldquo;must be pure reservations of value and treated as escrow&rdquo; to the stage below; an <strong>atomic core</strong>, &ldquo;the part of the transaction that truly needs to either succeed or fail together&rdquo;; and <strong>outbound legs</strong>, which &ldquo;must be total and infallible, and can just be treated as an &lsquo;if core succeeds, then these things will happen&rsquo;&rdquo;. The enabling condition is named, and unlike the staging itself it is checkable in writing: the decomposition is possible &ldquo;now manifests are DAGs&rdquo;.</p>
<p><strong>What it buys.</strong> In the twelve-taker case the atomic core is single-sharded &mdash; just the swap venue &mdash; so that shard &ldquo;can rip through all the transactions in one execution tick&rdquo; without blocking coordination with the other eleven. The certificate exchange with those shards still happens; it stops being on the critical path. The second gain is compute, and it answers the concession recorded immediately above: under naive atomic commitment all twelve shards execute the AMM swap logic for their own transaction, whereas here &ldquo;compute is only replicated across the atomic core shards (which probably in the vast majority will just be 1 shard)&rdquo;.</p>
<p><strong>What it costs, and how that cost is met.</strong> A transaction whose atomic core genuinely spans shards &mdash; one touching two pools in different shards &mdash; still runs on atomic commitment and is &ldquo;relatively slower and also slow everyone else doing the more typical fan-in&rdquo;. The mitigation he names is pricing rather than mechanism: &ldquo;not really any way to solve that except to price fees for transactions as multiples of however many shards the atomic core touches&rdquo;, which &ldquo;also makes sense given the compute is replicated&rdquo;. That is a fee schedule the successor engine is positioned to express and the current one is not &mdash; the VM&rsquo;s <a href="https://github.com/hyperscalers/hyperscale-vm/blob/main/docs/02-manifests-and-intents.md" target="_blank" rel="noopener">manifest format</a> puts the payer and <code>max_fee</code> in the envelope and carries &ldquo;no fee instruction of any kind&rdquo;, so what a transaction costs is settled against its declared shape rather than by whatever a component chooses to lock mid-execution.</p>
<p><strong>Still in conversation, but half of it is now written down.</strong> Read on 4 September 2026, none of the ten architecture documents in <a href="https://github.com/hyperscalers/hyperscale-rs/tree/main/docs" target="_blank" rel="noopener">hyperscale-rs/docs</a> contains &ldquo;leg local&rdquo;, &ldquo;inbound leg&rdquo;, &ldquo;outbound leg&rdquo; or &ldquo;escrow&rdquo;; cross-shard commitment is still documented only as the single <a href="https://github.com/hyperscalers/hyperscale-rs/blob/main/docs/04-atomic-commitment.md" target="_blank" rel="noopener">provision, execute, certify</a> pipeline. The premise it rests on has moved the other way. <a href="https://github.com/hyperscalers/hyperscale-vm/blob/main/docs/02-manifests-and-intents.md" target="_blank" rel="noopener">hyperscale-vm&rsquo;s manifest document</a> is titled &ldquo;Manifests and intents: the typed dataflow DAG&rdquo; and states the property the staging needs: &ldquo;Sequencing is dataflow-only. Execution order is the DAG&rsquo;s topological order; independent legs are visibly independent. Acyclicity is subsumed by the format: a manifest is acyclic or it does not parse.&rdquo; The word this design turns on is already the repository&rsquo;s word for the independent parts of a transaction; what is not yet written anywhere is the machinery that executes them in three stages.</p>`;

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
  const target = blocks.find(b => b.id === BLOCK_ID);
  if (!target) throw new Error(`block ${BLOCK_ID} not found`);
  if (!/multi-stage routes/i.test(target.text)) throw new Error('block is not the Contention section');
  const before = target.text.length;
  target.text = target.text.trimEnd() + SECTION;

  const version = '6.23.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  block ${BLOCK_ID}: ${before} -> ${target.text.length} bytes (+${target.text.length - before})`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       "Contention: record \"leg local execution\", the named three-stage decomposition (inbound legs / atomic core / outbound legs) the lead developer specified in hyperscale_rs at 12:44 UTC on 4 September 2026, with the twelve-taker worked example, the compute-replication and fee-pricing consequences, and a same-day check of both repositories - the staging is in neither, the DAG manifest premise is documented in hyperscale-vm/docs/02.", now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
