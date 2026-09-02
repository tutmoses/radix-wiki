// Run 345, contents/history rotation. Closes the open half of run 344's page:
// the halt is still in force, and the state of the fix is now itself a fact.
//
// Verified 2026-09-01, 03:09 UTC:
//   POST mainnet.radixdlt.com/status/gateway-status -> state_version 557840622,
//     epoch 339896, round 102, proposer_round_timestamp 2026-08-31T21:19:06.179Z (unmoved)
//   POST mainnet.radixdlt.com/status/network-configuration -> 200 (Gateway itself is up)
//   api.github.com radixdlt/babylon-node releases -> newest v1.3.0.5, 2026-06-01
//   api.github.com radixdlt/radixdlt-scrypto commits -> newest 2026-03-27
//   radixdlt.com/blog -> no incident post; radixdao.org/notices.json -> nothing past 2026-08-29
//   t.me/radix_dlt/1000805 (Timan | Astrolescent), /1000874 (0xOmarA),
//   t.me/hyperscale_rs/11265 (flightofthefox) - authorship read from the ?embed=1 widget
//
// Also retitles the page: it now covers an Engine flaw, a corpus-wide drain and the
// first halt of Radix mainnet under a title naming only the drain. The slug does NOT
// move (no redirect table, and three live tweets link the current URL).
import pg from 'pg';
import { randomUUID } from 'crypto';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const uid = () => randomUUID();
const TAG_PATH = 'contents/history';
const SLUG = 'hyperlane-asset-drain-2026';
const NEW_TITLE = 'Hyperlane Asset Drain and Network Halt (August 2026)';
const SENTINEL = 'id="the-outage"';

const DRY = process.argv.includes('--dry-run');
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

const OUTAGE = `<h2 id="the-outage">The outage</h2><p>The network did not come back overnight. Re-read at <strong>03:09 UTC on 1 September 2026</strong>, the <a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">Gateway status endpoint</a> returns the identical ledger it returned at the halt — state version 557,840,622, epoch 339,896, round 102, proposer round timestamp 21:19:06.179 UTC — which puts Radix mainnet close to six hours without a committed transaction. The Gateway itself is answering normally; <code>network-configuration</code> returns 200. It simply has nothing new to report, which is the distinction between an outage of the infrastructure and an outage of the ledger underneath it.</p><p>The fix is not public. <a href="https://github.com/radixdlt/babylon-node/releases" target="_blank" rel="noopener">babylon-node</a>, the node implementation every validator runs, has published nothing since <code>v1.3.0.5</code> on 1 June 2026, and the default branch of <a href="https://github.com/radixdlt/radixdlt-scrypto" target="_blank" rel="noopener">radixdlt-scrypto</a>, which carries the Engine itself, last moved on 27 March 2026. No post has appeared on <a href="https://www.radixdlt.com/blog" target="_blank" rel="noopener">the Foundation's blog</a>, and <a href="https://radixdao.org/notices.json" target="_blank" rel="noopener">the DAO's notice feed</a> carries nothing after 29 August. Six hours in, the only public account of the path forward is a Telegram message: <a href="https://t.me/radix_dlt/1000805" target="_blank" rel="noopener">Timan</a> — the DeFiPlaza contributor and <a href="/ecosystem/astrolescent" rel="noopener">Astrolescent</a> founder the Foundation appointed <a href="https://www.radixdlt.com/blog/continuing-the-vision-timan-appointed-interim-hyperscale-lead" target="_blank" rel="noopener">Interim Hyperscale Lead</a> on 10 November 2025 — wrote at 22:14 UTC that he had been "in emergency mode with a few others for the past 6 hours", that the group was "talking to (former) core node devs", and that "we'll get back online". A restart therefore depends on people who no longer work on the codebase, which is a consequence of the Foundation having moved to <a href="https://www.radixdlt.com/blog/foundation-update-moving-to-maintenance-mode" target="_blank" rel="noopener">maintenance mode</a> and is the first operational cost of that decision to be visible from outside.</p><p>Two questions were raised in the main group and answered there. Rolling the ledger back to before 16:02 was <a href="https://t.me/radix_dlt/1000729" target="_blank" rel="noopener">proposed by a validator</a> at 20:12 UTC and refused within eight minutes on a point of arithmetic rather than of policy: the wrapped tokens were burned on Radix and the assets backing them released on Ethereum, so as one reply put it, <a href="https://t.me/radix_dlt/1000737" target="_blank" rel="noopener">"roll back not possible. it's already on ethereum"</a>. Restoring the Radix balances would restore the claims without restoring what backs them. And the exploit's payload drew a forensic note from <a href="https://github.com/0xOmarA" target="_blank" rel="noopener">0xOmarA</a> — the fifth-largest contributor to radixdlt-scrypto with 1,318 commits, and the author of most of the <a href="https://github.com/radixdlt/radix-engine-toolkit" target="_blank" rel="noopener">Radix Engine Toolkit</a> — who observed at 00:54 UTC that the attacker's <a href="https://t.me/radix_dlt/1000874" target="_blank" rel="noopener">WebAssembly carries no build-host string and no panic paths</a>, the two artefacts Rust compilation leaves behind by default, and read that as code hand-written in WAT rather than compiled. That is an inference about method, not identity, and nothing in the ledger names anyone.</p><p>The clearest measure of how the halt was read from inside the ecosystem came from Hyperscale. At 18:55 UTC, before the cause was public and before the network stopped, <a href="/community/flightofthefox" rel="noopener">flightofthefox</a>, who leads the Rust <a href="/contents/tech/research/hyperscale-rs" rel="noopener">Hyperscale</a> effort, told his own channel he had <a href="https://t.me/hyperscale_rs/11265" target="_blank" rel="noopener">begun liquidating all exposure to the Radix blockchain</a>, saying he could not risk Hyperscale's runway "to this many unknowns" and that he was stating it publicly only because of the circumstances. The two Hyperscale efforts are separate — the Foundation’s programme, which Timan leads, and the independent Rust reimplementation, which flightofthefox leads — and on the night of 31 August the people running them took opposite positions: one coordinating the restart, the other selling out of the asset it would restart.</p>`;

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (blocks.some((b) => (b.text || '').includes(SENTINEL))) {
    console.log('  already applied - no write');
    process.exit(0);
  }

  // 1. infobox: restate the network-status row with the dated re-read
  const box = blocks[0];
  if (box.type !== 'infobox') throw new Error('block 0 is not the infobox');
  const inner = box.blocks[0];
  const OLD_ROW = '<td>Mainnet halted 21:19:06 UTC, 31 August 2026 – last round: epoch 339,896, round 102</td>';
  const NEW_ROW = '<td>Halted 21:19:06 UTC, 31 August 2026 – last round: epoch 339,896, round 102. Still halted when re-read at 03:09 UTC, 1 September</td>';
  if (!inner.text.includes(OLD_ROW)) throw new Error('infobox network-status row not found verbatim');
  inner.text = inner.text.replace(OLD_ROW, NEW_ROW);

  // 2. new section, immediately after "The halt"
  const haltIdx = blocks.findIndex((b) => (b.text || '').includes('<h2>The halt</h2>'));
  if (haltIdx < 0) throw new Error('"The halt" section not found');
  blocks.splice(haltIdx + 1, 0, { id: uid(), type: 'content', text: OUTAGE });

  // 3. the unresolved list opened with the fix; it now has a dated state
  const unIdx = blocks.findIndex((b) => (b.text || '').includes('<h2>What is unresolved</h2>'));
  if (unIdx < 0) throw new Error('"What is unresolved" section not found');
  const OLD_FIX = 'The first is the fix and the resumption. A patch to the Engine has to be written, reviewed and adopted by enough node runners to bring stake back above two thirds, and until it is the network cannot be restarted safely — the exploit is public and the flaw is in the layer every transaction passes through. No date has been offered.';
  const NEW_FIX = 'The first is the fix and the resumption. A patch to the Engine has to be written, reviewed and adopted by enough node runners to bring stake back above two thirds, and until it is the network cannot be restarted safely — the exploit is public and the flaw is in the layer every transaction passes through. Nothing had been published to the node or Engine repositories, the Foundation’s blog or the DAO’s notice feed when this page was last re-read, and no date has been offered.';
  if (!blocks[unIdx].text.includes(OLD_FIX)) throw new Error('unresolved paragraph not found verbatim');
  blocks[unIdx].text = blocks[unIdx].text.replace(OLD_FIX, NEW_FIX);

  const version = '2.1.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}\n    -> ${NEW_TITLE}\n    v${page.version} -> v${version}, blocks ${page.content.length} -> ${blocks.length}, section inserted at ${haltIdx + 1}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET title=$1, content=$2, version=$3, updated_at=$4, last_verified_at=$4 WHERE id=$5',
      [NEW_TITLE, json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, NEW_TITLE, version, 'minor', AUTHOR_ID,
       'Add "The outage": the halt re-read at 03:09 UTC on 1 September with the ledger unmoved, no patch in babylon-node or radixdlt-scrypto and no official notice, Timan’s account of the path forward, the rollback question, 0xOmarA on the payload, and flightofthefox liquidating Radix exposure. Retitled to cover the halt as well as the drain; slug unchanged.', now]);
    await client.query('COMMIT');
    console.log('  committed');
  }
} finally {
  client.release();
  await pool.end();
}
