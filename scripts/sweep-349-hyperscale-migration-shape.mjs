// Run 349. On the day Radix mainnet was 22 hours into a halt, the Hyperscale channel spent
// the afternoon asking its lead developer what a migration to the new VM would actually
// involve. The answers are the most specific yet on that question — and one of them is that
// locking a fee from inside a component during execution goes away, which is precisely the
// move the 31 August attacker made. All messages authorship-verified via the t.me embed.
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'contents/tech/research';
const SLUG = 'hyperscale-rs';
const SENTINEL = 'id="migration-shape"';
const DRY = process.argv.includes('--dry-run');

const SECTION = `<h2 id="migration-shape">What a Migration Would Involve (1 September 2026)</h2>` +
  `<p>On 1 September 2026, with <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">Radix mainnet twenty-two hours into a halt</a> and the channel arguing over whether the network should be upgraded or restarted as something else, the lead developer answered the migration question in more detail than at any point before. The account below is his, message by message, and each is authorship-verified through the Telegram embed.</p>` +
  `<h3>An upgrade is a new genesis</h3>` +
  `<p>Asked what &ldquo;new&rdquo; would even mean, he set out that a Xi'an upgrade is not an in-place upgrade of the running chain: <a href="https://t.me/hyperscale_rs/11438" target="_blank" rel="noopener">&ldquo;it's a completely different protocol to Babylon so the only way to upgrade is to terminate the old chain and import to a fresh genesis&rdquo;</a>. Mechanically that means dumping <a href="https://t.me/hyperscale_rs/11435" target="_blank" rel="noopener">&ldquo;the state at a predetermined epoch, transform it and load it in at the xi'an genesis&mdash;same process that Olympia -&gt; Babylon was&rdquo;</a> &mdash; the <a href="/contents/tech/releases/radix-mainnet-babylon" rel="noopener">2023 migration</a> that already put every Radix holder through one address change. This one would do it again: &ldquo;more address changes&hellip; because a new addressing scheme was required for sharding&rdquo;. The sharded design fixes the address format, so the change is a consequence of the topology rather than a choice.</p>` +
  `<p>Contracts are the harder half, and the difficulty he names is not compilation but authority. <a href="https://t.me/hyperscale_rs/11436" target="_blank" rel="noopener">&ldquo;Contracts are much more of a PITA&hellip; because someone has to recompile and then you have to think about what are the checks and balances on the new artifact.&rdquo;</a> The open question he poses is who is allowed to publish the recompiled blueprint: whether &ldquo;the blueprint owner [should] be able to unilaterally update their WASM&hellip; or does it also need some kind of consensus from validators who've checked against known source to make sure they haven't, for example, put a back door into their [previously safe] swap contracts which allow them to drain&rdquo;. A migration that requires every package to be rebuilt is also a migration in which every package could be rebuilt into something else, and nothing in a state dump distinguishes the two. Who decides, in the end, he places with the operators: <a href="https://t.me/hyperscale_rs/11444" target="_blank" rel="noopener">&ldquo;it is ultimately the validators who will decide what code to run and thus what (if any) irregular state transitions happen during the migration process&rdquo;</a>.</p>` +
  `<h3>The shim, and what will not survive it</h3>` +
  `<p>On the developer surface he was more optimistic than the repository has been in writing. The two authoring layers are <a href="https://t.me/hyperscale_rs/11430" target="_blank" rel="noopener">&ldquo;both just rust sdks, with vaults, resources, proofs, etc.&rdquo;</a>, and differences that cannot be absorbed &ldquo;are probably the sorts of things that only require a few minutes to adapt&rdquo;. Earlier in the afternoon he had gone further: <a href="https://t.me/hyperscale_rs/11419" target="_blank" rel="noopener">&ldquo;almost every single design decision had to get revisited in hs-vm&hellip; hoping that it will be possible to shim things such that old contracts just work&hellip; the blueprint macros are pretty similar-ish. Hopefully be in a good spot to test that in the coming weeks.&rdquo;</a> That is worth setting against the VM repository's own architecture overview, which lists among its explicit non-goals &ldquo;Scrypto or EVM compatibility &mdash; the effect-typed ABI is not expressible under either; no shim layer&rdquo;. The written document and the channel now say different things about whether a shim exists; the channel is the later of the two, and it is a hope with a test date rather than a commitment.</p>` +
  `<p>Two capabilities he names as going regardless, and the reasons are structural: <strong>locking fees from a component during execution</strong>, and <strong>branching cross-component calls on mutable state</strong> &mdash; &ldquo;there's generally irreducible reasons for each of those related to sharding&rdquo;. Both are consequences of the declared-footprint rule described above: a call graph that branches on state read mid-execution cannot be routed to its shards in advance, and a fee locked by a component the transaction did not name is a payment from an account the manifest never declared. The first of those has a very recent illustration. The transaction that <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">emptied Radix's bridged assets</a> the previous afternoon carried no <code>LOCK_FEE</code> instruction at all; its fee was locked from inside the published blueprint, against a third party's XRD vault. The capability the attacker used to pay for the attack is one the successor engine does not offer &mdash; not as a response to the incident, but because a sharded router cannot price a call it cannot see coming.</p>` +
  `<p>On the other side of the ledger he listed additions rather than removals: <a href="https://t.me/hyperscale_rs/11433" target="_blank" rel="noopener">&ldquo;a more well-rounded cryptography stdlib including ZK verification&rdquo;</a>, and interest in &ldquo;borrowing the ZK tunnels concept from SUI&rdquo;. Neither has appeared in the repository yet.</p>` +
  `<h3>Where the developer places himself</h3>` +
  `<p>The same afternoon fixed the project's relationship to Radix more explicitly than the code alone had. Asked whether Hyperscale would still be integrated with Radix, the answer began <a href="https://t.me/hyperscale_rs/11403" target="_blank" rel="noopener">&ldquo;Integrate with what? Hyperscale doesn't use any Radix components anymore&hellip; as Radix Engine turned out to be way too far from what was required&rdquo;</a> &mdash; the channel's confirmation of what the August dependency cut-over had already made true in the manifest &mdash; and ended with an offer that is conditional in its first clause: &ldquo;if Radix still exists, and the DAO wants help migrating all the state, balances, etc. and integrating/updating the wallet and such. Yeah, I'm sure I would still help out with that.&rdquo;</p>` +
  `<p>He declined the leadership the channel kept offering him. On the suggestion of launching a new chain: <a href="https://t.me/hyperscale_rs/11396" target="_blank" rel="noopener">&ldquo;I don't think I'm mad enough to launch an L1 in 2026. Just going to finish the tech as the open source project that it is. And then probably collapse because I've been running on fumes for months. Any network can use Hyperscale, or not use it.&rdquo;</a> On being asked to decide between an upgrade and a reset: <a href="https://t.me/hyperscale_rs/11455" target="_blank" rel="noopener">&ldquo;I will vote in the DAO like everyone else. People should not particularly listen to my opinions on things outside my narrow expertise.&rdquo;</a> And asked at 18:32 whether he would still want the <a href="/contents/history/radix-ecosystem-funding" rel="noopener">Xi'an milestone payments</a> denominated at $50,000 in XRD or would rather be paid in fiat now, he answered only <a href="https://t.me/hyperscale_rs/11446" target="_blank" rel="noopener">&ldquo;Grants are the furthest thing from my mind presently&rdquo;</a> &mdash; leaving the denomination of the programme's funding open on the day the token it is denominated in could not be transferred.</p>`;

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

  const at = blocks.findIndex((b) => (b.text || '').includes('Execution Layer: from the Radix Engine'));
  if (at < 0) throw new Error('anchor section not found');
  blocks.splice(at + 1, 0, { id: uid(), type: 'content', text: SECTION });

  const version = '6.18.0';
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
       "New section on what a Xi'an migration would involve, from the lead developer on 1 September 2026: an upgrade means terminating Babylon and importing to a fresh genesis with another address change; recompiled blueprints raise an unanswered authority question; validators decide which irregular state transitions happen. He now hopes to shim old contracts, which the VM repository's non-goals rule out in writing. Two capabilities go for sharding reasons — component-locked fees during execution, and cross-component calls branching on mutable state — the first being the mechanism the 31 August attacker used to pay for the drain.", now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
