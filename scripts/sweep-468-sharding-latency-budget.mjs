// Run 468, contents/tech rotation.
//
// Closes two items banked for this rotation and never spent: the finality
// trade-off (run 459) and the latency arithmetic (run 462). Both are
// flightofthefox in hyperscale_rs, and both say the same thing from different
// ends - that sharding buys throughput with latency, and that the bill is
// itemisable. No page on this wiki carried the cost side of sharding at all;
// /contents/tech/core-concepts/shard-groups described how committees are formed
// and rotated and said nothing about what a transaction pays to cross them.
//
// Authorship verified per message through the ?embed=1&mode=tme view rather than
// taken from the scrape: 12721, 12740, 12746, 12747 and 12751 all render
// "flightofthefox (hyperscale.rs)" and none is a forward.
//
// Quoted sparingly and attributed; the arithmetic is set out in the wiki's own
// words with the quote carrying only the positioning, which is the part that
// cannot be paraphrased without softening it.
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/tech/core-concepts';
const SLUG = 'shard-groups';
const DRY = process.argv.includes('--dry-run');

const SECTION = `<h2>What Sharding Costs: the Latency Budget</h2>
<p>Everything above is about how shards are served. The other half &ndash; what a transaction pays for the arrangement &ndash; had no place on this page, and it is the half a reader comparing Radix to a single-set chain needs. The figures below come from the Xi'an candidate's lead developer, flightofthefox, answering questions in the project's own Telegram group on 19 and 20 September 2026; they describe the candidate as designed, not a network in production, and nothing here has been measured against a running shard.</p>
<h3>The round trips</h3>
<p>Finality is counted in block inclusions rather than in seconds, because the second count depends on <a href="https://t.me/hyperscale_rs/12746" target="_blank" rel="noopener">whatever block time the validator set running it settles on</a>. The single-shard minimum is <strong>four inclusions</strong>: two blocks to include the transaction, then execution, then two more to include the result. Crossing shards adds three further costs on top of that floor:</p>
<ul>
<li><strong>Provisioning and certifying.</strong> Both are steps of execution in the cross-shard case, and each carries its own round trips.</li>
<li><strong>The gas-paying shard goes first</strong>, for two more blocks, before any other shard may select the transaction. The reason is anti-griefing rather than accounting: a shard that is not the payer&rsquo;s cannot know the fee is actually reserved unless the payer&rsquo;s shard says so, and without that step the network could be filled with transactions whose payers are invalid.</li>
<li><strong>Cross-shard locks</strong>, where the transaction touches state another shard is holding &ndash; though <em>leg-local execution</em> removes this cost <a href="https://t.me/hyperscale_rs/12747" target="_blank" rel="noopener">as long as the atomic core of the transaction is single-shard</a>.</li>
</ul>
<h3>The trade this makes</h3>
<p>The cost is deliberate and it is the price of the property <a href="/contents/tech/core-concepts/atomic-composability" rel="noopener">atomic composability</a> across shards demands. Asked directly what sharding gives up, the answer was finality: <q>It&rsquo;s always going to be quicker to execute transactions in blocks, rather than go through the whole async execution rigamarole which is required to support cross-shard. If you don&rsquo;t actually have enough usage to need more than one shard &ndash; it would be a strict downgrade</q> (<a href="https://t.me/hyperscale_rs/12721" target="_blank" rel="noopener">19 September 2026</a>). That is a conditional, and the condition is demand: below one shard&rsquo;s worth of usage the architecture is a net loss by its own designer&rsquo;s account.</p>
<p>The positioning that follows from it was stated as plainly: the candidate targets <q>only extremely high throughput use cases. if i were a random dApp builder, i would probably build on Solana</q> (<a href="https://t.me/hyperscale_rs/12740" target="_blank" rel="noopener">20 September 2026</a>), and the bet is on the market rather than on the benchmark &ndash; <q>the market for transactions that can tolerate a few extra seconds is larger than the market for transactions which are so sensitive to latency as to require sub-second finality</q>, with the benefit of shards staying non-obvious <a href="https://t.me/hyperscale_rs/12751" target="_blank" rel="noopener">until low-latency chains start running out of blockspace regularly</a>. Set against the <a href="/contents/tech/research/hyperscale-500k-tps" rel="noopener">throughput figures</a> the project publishes, this is the side of the ledger those figures do not show.</p>`;

const ANCHOR = 'a shard splits when its committed substate byte total crosses a governed threshold, live and without halting.</p>';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${TAG_PATH}/${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
    [TAG_PATH, SLUG],
  );
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes('Latency Budget')) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  const at = blocks.findIndex((b) => typeof b.text === 'string' && b.text.includes(ANCHOR));
  if (at < 0) throw new Error('anchor block not found');
  blocks.splice(at + 1, 0, { id: uid(), type: 'content', text: SECTION });

  const version = '1.7.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  blocks ${page.content.length} -> ${blocks.length}, inserted after index ${at}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [
      json, version, now, page.id,
    ]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
        'Add the latency budget: the page described how shard committees are formed and rotated and never said what a transaction pays to cross them. Four block inclusions is the single-shard minimum; cross-shard adds provisioning and certifying, the payer shard going first for anti-griefing reasons, and cross-shard locks unless the atomic core is single-shard. Carries the designer’s own statement of the trade-off and of who the candidate is for. Sourced to five hyperscale_rs messages of 19-20 September 2026, each with authorship verified through the per-message embed view.',
        now,
      ],
    );
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
