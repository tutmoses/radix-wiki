/**
 * Run 324 (signal-driven, outside the ecosystem rotation) — /contents/tech/research/hyperscale-rs
 *
 * On 28 August 2026 the hyperscale_rs channel carried the project's committee-seating
 * mechanism, its randomness-grinding hardening, and the single-shard takeover threshold —
 * none of which the page covered. Run 322 banked four adjacent statements as unusable
 * because scout-telegram.mjs emits no sender field; this run resolves that by reading the
 * t.me embed markup (`?embed=1&mode=tme`), which names the author. All twelve messages
 * cited below resolve to "flightofthefox (hyperscale.rs)", the lead developer.
 */
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/tech/research';
const SLUG = 'hyperscale-rs';
const SENTINEL = 'hyperscale_rs/11091';
const DRY = process.argv.includes('--dry-run');
const tg = (id) => `https://t.me/hyperscale_rs/${id}`;

const SECTION =
  `<h2>Seating, Shuffling and the Single-Shard Threshold (August 2026)</h2>` +
  `<p>Milestone 1 shipped node shuffling, and on 28 August 2026 a long exchange in the project's channel put the mechanism itself on the record. Getting <em>into</em> a shard is a lottery; getting <em>out</em> is first-in, first-out. <a href="${tg(11089)}" target="_blank" rel="noopener">"it's a lottery. once you're seated in a shard then it's a queue"</a> – validators seated ahead of a new arrival are shuffled out ahead of it – and the two halves are deliberately different: <a href="${tg(11091)}" target="_blank" rel="noopener">"getting seated is random. getting shuffled out is fifo"</a>.</p>` +
  `<p>The exit used to be random too. It was changed to blunt randomness grinding by a large-stake adversary, which under a fully random scheme gets two bites at every draw: <a href="${tg(11093)}" target="_blank" rel="noopener">"if both seating and shuffling is random - the most successful grind will seat a malicious, and shuffle an honest"</a>. Making the exit predetermined removes the second. The seed has since moved as well – randomness was drawn from the beacon committee when that change was made, and is <a href="${tg(11094)}" target="_blank" rel="noopener">now supplied by the shards themselves</a>, "which makes it orders of magnitude harder to grind" – but the FIFO exit is kept regardless, "because it's a good hardening anyway".</p>` +
  `<h3>Why one shard is the whole network</h3>` +
  `<p>Seating carries that much design weight because capturing a single shard is terminal rather than partial. No other shard can check its work: they do not hold its state, and <a href="${tg(11105)}" target="_blank" rel="noopener">"if they did - it would not be a sharded system"</a>. With a quorum inside one shard, <a href="${tg(11107)}" target="_blank" rel="noopener">"state is whatever you say it is"</a>, with lesser interference available on a gradient from f+1 upward. Because Radix is <a href="/contents/tech/core-concepts/asset-oriented-programming" rel="noopener">asset-oriented</a>, XRD lives in every shard rather than in one contract, so the consequence is not confined to that shard's users: <a href="${tg(11099)}" target="_blank" rel="noopener">"you could mint a trillion XRD, stake it, and now you control the network"</a>.</p>` +
  `<p>The threshold is not monolithic security divided by shard count. On the developer's figure, taking two-thirds of a single shard on fair draws over a thousand-year horizon needs <a href="${tg(11108)}" target="_blank" rel="noopener">roughly 44% of all stake</a>, against the 66% an unsharded proof-of-stake network requires – "which is still a very high bar", and materially more than the arithmetic a reader might expect. The caveat attached to it is economic rather than cryptographic: percentages resolve to money, and <a href="${tg(11110)}" target="_blank" rel="noopener">"the actual price of the asset has to do the heavy lifting at some point"</a>.</p>` +
  `<h3>What shuffling costs, and what asset orientation saves</h3>` +
  `<p>Sharding bounds the state any one node must hold, because a shard can always be split again – but the developer is explicit that this is a purchase rather than a saving: <a href="${tg(11075)}" target="_blank" rel="noopener">"it doesn't make it free - as you have more validators to pay"</a>. State growth is also not the same thing as usage. Balances are integers whose size does not change when they move, so a transfer costs no state at all, and an <a href="/ecosystem/ociswap" rel="noopener">AMM</a> holding two integers stays two integers under a million transactions; an account's state grows with the number of <em>distinct</em> assets it holds and <a href="${tg(11082)}" target="_blank" rel="noopener">shrinks when one hits zero</a>, "as then we can forget the balance".</p>` +
  `<p>The asset-oriented model helps rather than hinders contention here, for the same reason. A balance lives in the holder's own account or in a component's vault instead of under one ERC-20-style ledger contract, so the balances are <a href="${tg(11081)}" target="_blank" rel="noopener">scattered across the state space</a> and two accounts changing at once <a href="${tg(11084)}" target="_blank" rel="noopener">do not contend</a>. The <a href="/contents/tech/core-protocols/vm-layer" rel="noopener">VM</a> takes it further with locking semantics named delta, credit and reserve, so that commutative operations stay independent: <a href="${tg(11086)}" target="_blank" rel="noopener">"if 5 people all pay Bob at once - those also don't contend"</a>.</p>` +
  `<h3>Three positions stated the same day</h3>` +
  `<p><strong>Stateless validation is rejected, not deferred.</strong> Asked directly whether Hyperscale would adopt it, the answer was no, and the objection is structural: <a href="${tg(11059)}" target="_blank" rel="noopener">"stateless validation means validators can't do their job unless someone else does theirs"</a> – the failure point moves onto whoever supplies the state witnesses, which the developer places in the same category as ZK "verify, don't execute" designs moving it onto the proving clusters.</p>` +
  `<p><strong>The megabyte-scale transaction bound is a choice.</strong> Sizing <a href="${tg(11033)}" target="_blank" rel="noopener">"gossip, serde, block space, data availability, etc to big ass edge-case transactions"</a> is described as solving a non-issue at the cost of making the system objectively worse; transactions of about 1 MB remain available, and the ceiling is not treated as something to lift.</p>` +
  `<p><strong>State bloat is expected to be the expensive act.</strong> Fee tables are unwritten, but the direction follows from shuffling: a security model that rotates validators between shards implies continuous state sync, so <a href="${tg(11052)}" target="_blank" rel="noopener">"bloating the size of state will probably comparatively be one of the most expensive things a person can do"</a>. That is the pricing counterpart to the fee design above, where every fee burns and none is paid to anyone.</p>` +
  `<p><em>The statements in this section are Telegram messages in the project's public channel, each attributed to the lead developer by the message's own embed markup.</em></p>`;

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
  const before = JSON.stringify(blocks);
  if (before.includes(SENTINEL)) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  const anchor = blocks.findIndex((b) => (b.text || '').includes('<h2>Dynamic Topology and the Beacon Chain</h2>'));
  if (anchor < 0) throw new Error('anchor block not found');
  blocks.splice(anchor + 1, 0, { id: uid(), type: 'content', text: SECTION });

  const version = '6.15.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  ${before.length} -> ${JSON.stringify(blocks).length} B  (inserted at index ${anchor + 1} of ${blocks.length})`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Add "Seating, Shuffling and the Single-Shard Threshold", from the 28 August 2026 channel exchange: shard seating is a lottery and the exit is FIFO, changed from random to blunt randomness grinding; shard-supplied seeds replaced the beacon committee seed; a single captured shard is terminal because no other shard holds its state, and the threshold is roughly 44% of all stake against 66% unsharded. Also records the state-growth and commutative-locking arguments, and the three positions run 322 banked as unattributable - stateless validation rejected, the ~1 MB transaction bound as a choice, state bloat as the expensive act. Every statement attributed to the lead developer via the t.me embed markup.', now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
