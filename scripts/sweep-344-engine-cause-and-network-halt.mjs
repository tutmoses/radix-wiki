// scripts/sweep-344-engine-cause-and-network-halt.mjs — run 344 (community rotation, incident slice)
//
// Run 343 created the drain page with the cause left explicitly open between the
// warp-route package and the Radix Engine. Five hours later the Foundation and the
// Radix Accountability Council both named the Engine, and the node runners halted
// mainnet. This adds the cause read at the Scrypto source, the halt measured at the
// Gateway, and the Ethereum side of the trail.

import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/history';
const SLUG = 'hyperlane-asset-drain-2026';
const SENTINEL = 'verify_boot_ref_value';
const DRY = process.argv.includes('--dry-run');

const A = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

const CAUSE = {
  id: uid(),
  type: 'content',
  text:
    '<h2>The cause</h2>' +
    '<p>At 22:02 UTC, five hours after the last transaction committed, the question this page had left open was answered in the ' +
    A('https://t.me/radix_dlt/1000779', 'main Radix Telegram group') +
    ': "the issue was in the Radix Engine. Which means any assets, token or nft, could have been withdrawn and moved without permission." ' +
    'The ' + A('https://t.me/RadixAccountabilityCouncil/925', 'Radix Accountability Council') +
    ' had said the same eight minutes earlier — an outstanding issue in the execution layer, "the root cause that allowed the more recent hack on hAssets", ' +
    'with several sources converging on it. Neither statement described the flaw. The code does.</p>' +
    '<p>Every reference a transaction names is checked before any WASM runs. In ' +
    A('https://github.com/radixdlt/radixdlt-scrypto/blob/v1.3.1/radix-engine/src/system/system_callback.rs#L1147', '<code>system_callback.rs::verify_boot_ref_value</code>') +
    ', a node that is not global is accepted as a <code>StableReferenceType::DirectAccess</code> reference — and injected into the caller\'s frame — when its blueprint is ' +
    '<code>FungibleVault</code> or <code>NonFungibleVault</code> from the resource package. That is the whole test. The function does not ask who owns the vault, ' +
    'and it has no way to: ownership is not one of its inputs. Direct access to a vault exists in the Engine so that <code>recall</code> can work, and ' +
    A('https://github.com/radixdlt/radixdlt-scrypto/blob/v1.3.1/radix-engine/src/blueprints/resource/fungible/fungible_vault.rs#L271', 'the vault blueprint gates <code>recall</code> behind the resource\'s <code>RECALLER_ROLE</code>') + '.</p>' +
    '<p>The second half is which other methods that reference reaches. In the same auth template, <code>take</code>, <code>take_advanced</code> and ' +
    '<code>lock_fee</code> are gated by the <code>WITHDRAWER_ROLE</code> of the resource — not by anything belonging to the account or component that holds the vault. ' +
    'On a freely transferable token that role is open, which is what makes the token transferable at all; what normally protects a balance is the account component\'s own ' +
    '<a href="/contents/tech/core-concepts/access-rules-and-auth-zones" rel="noopener">access rules</a> on its <code>withdraw</code> method, and a call made straight to the vault never passes through them. ' +
    'So the attacker did not need to defeat an authority. Holding a reference the Engine should never have granted, <code>take</code> was open to them on sixty vaults, ' +
    'and so was <code>lock_fee</code> — which is why the transactions carry no <code>LOCK_FEE</code> instruction and still paid their fees from a stranger\'s XRD vault. ' +
    'Both absences this page recorded before the cause was known follow from the same defect.</p>' +
    '<p>Two consequences of that reading. The recall and freeze authorities were never in play: nothing was recalled, so <code>deny_all</code> on those roles was irrelevant to the outcome. ' +
    'And the reach is the reach of the Engine, not of the bridge — the Foundation\'s own statement puts every token and NFT on the network inside it, and the ' +
    A('https://t.me/radix_dlt/1000799', 'limit the attacker actually hit') + ' was transaction size, one vault named per call. ' +
    'The version this was read at is v1.3.1, the ' + A('https://github.com/radixdlt/radixdlt-scrypto/releases/tag/v1.3.1', 'Cuttlefish release of 20 January 2026') +
    '; the same function on the repository\'s <code>main</code> branch is byte-identical to it.</p>',
};

const HALT = {
  id: uid(),
  type: 'content',
  text:
    '<h2>The halt</h2>' +
    '<p>Radix mainnet stopped producing rounds at <strong>21:19:06.179 UTC on 31 August 2026</strong>. The ' +
    A('https://mainnet.radixdlt.com/status/gateway-status', 'Gateway status endpoint') +
    ' has reported the same ledger ever since — state version 557,840,622, epoch 339,896, round 102 — and every endpoint that reads state now refuses with ' +
    '<code>NotSyncedUpError</code>, a sync delay that grows by a second every second because the ledger no longer moves. That is why wallets, the dashboard and the explorers went dark ' +
    'within minutes of the halt: they are all reading the same stalled Gateway.</p>' +
    '<p>The stop was deliberate. Radix consensus requires more than two thirds of staked XRD to be validating; below that threshold the network cannot form rounds and simply stops, ' +
    'which is the liveness half of a BFT trade-off it makes in favour of safety. Node runners took enough stake offline to cross that line. ' +
    A('https://t.me/radix_dlt/1000764', 'The announcement') + ' at 21:17:30 UTC read: "Since epoch 339897, round 2, the Radix network has been halted by Radix\'s Node Runner Community. ' +
    'A fix for a security vulnerability is currently being developed and will be rolled out shortly, after which the network will resume." ' +
    'By 22:36 the ' + A('https://validators.stakesafe.net/', 'StakeSafe validator dashboard') + ' had shipped a stake-up/stake-down view and put 48.32% of delegated stake offline.</p>' +
    '<p>The order of the evening matters, because the exploit was public knowledge before the network was stopped and the fix is not written yet. ' +
    'The Foundation said it had ' + A('https://t.me/radix_dlt/1000779', 'held the diagnosis back until the halt was in place') +
    ', and separately that it was ' + A('https://t.me/radix_dlt/1000765', 'in contact with bridges, exchanges and security partners') +
    ', reaching out to authorities, and might be limited in what it could say next. No resumption time has been given. ' +
    'The Council\'s notice puts it plainly: the network\'s inoperative status "does not have a predictable comeback time as of yet".</p>' +
    '<table><tbody>' +
    '<tr><td><strong>16:02:20 – 16:57:41</strong></td><td>The twenty-six transactions</td></tr>' +
    '<tr><td><strong>17:17</strong></td><td>First public report in the main Telegram group</td></tr>' +
    '<tr><td><strong>21:17:30</strong></td><td>Halt announced by the node-runner community</td></tr>' +
    '<tr><td><strong>21:19:06.179</strong></td><td>Last round on the ledger — epoch 339,896, round 102, state version 557,840,622</td></tr>' +
    '<tr><td><strong>21:54:11</strong></td><td>Radix Accountability Council notice: execution-layer issue, no comeback time</td></tr>' +
    '<tr><td><strong>22:02:14</strong></td><td>Cause stated publicly as the Radix Engine, any token or NFT in scope</td></tr>' +
    '</tbody></table>',
};

const ETHEREUM = {
  id: uid(),
  type: 'content',
  text:
    '<h2>Where the assets went</h2>' +
    '<p>Bridging out of Radix burns the wrapped token here and releases the real asset on the destination chain, so the second half of this incident is on Ethereum and is still readable there. ' +
    'The recipient named in the warp-route calls is ' +
    A('https://eth.blockscout.com/address/0x626d7Be5c2F2b6E9bAa542e25b6313Ac91d47cD2', '0x626d…7cD2') +
    ', an ordinary externally-owned account. Its inbound transfers come from three ' +
    'Hyperlane collateral contracts, one per asset, and they line up with the Radix side to the last digit: the three probe amounts this page records — 0.00084948 hWBTC at 16:17, ' +
    '482.994855 hUSDT at 16:21, 384.810629 hUSDC at 16:22 — arrive as WBTC, USDT and USDC within the same minute of each other. ' +
    'The USDT total received, 72,420.384476, is exactly the hUSDT burned on Radix, and the WBTC received sums to the 6.348 hWBTC burned.</p>' +
    '<p>The USDC does not match, and the gap is informative rather than mysterious: 15,929.25 USDC reached this address against 458,914.89 hUSDC burned on Radix, ' +
    'so the largest sweep of the afternoon was directed at a different recipient. From 16:44 the balances were forwarded to a contract at ' +
    A('https://eth.blockscout.com/address/0x225a38bc71102999Dd13478BFaBD7c4d53f2DC17', '0x225a…DC17') +
    ' and converted; read at 23:15 UTC on 31 August the account holds 330.207 ETH and 53.93 USDT. ' +
    'Radix cannot reverse any of that — the ledger it would have to do it on is not the one the assets are sitting on, and it is halted besides.</p>',
};

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);

  const { rows } = await client.query(
    'SELECT id, title, version, metadata, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  const flat = (b) => (b.text || '') + (b.blocks || []).map((n) => n.text || '').join('');
  if (blocks.some((b) => flat(b).includes(SENTINEL))) {
    console.log('  already applied – no write');
    process.exit(0);
  }

  // 1. Infobox: root cause answered, network status added.
  const ib = blocks[0];
  if (ib.type !== 'infobox') throw new Error('block 0 is not the infobox');
  const cell = ib.blocks[0];
  const before = cell.text;
  cell.text = cell.text.replace(
    '<td>Not stated by any party as of 19:30 UTC, 31 August 2026</td>',
    '<td>A Radix Engine flaw in how vault references are granted – stated by the Foundation and the Radix Accountability Council on 31 August, read at the source below</td>',
  );
  if (cell.text === before) throw new Error('root-cause row not matched');
  cell.text = cell.text.replace(
    '<tr><td><strong>Ledger record</strong></td>',
    '<tr><td><strong>Network status</strong></td><td>Mainnet halted 21:19:06 UTC, 31 August 2026 – last round: epoch 339,896, round 102</td></tr>' +
    '<tr><td><strong>Ledger record</strong></td>',
  );

  // 2. Intro: the evening's second half.
  const intro = blocks[1];
  if (!intro.text.includes('this page reports what the ledger holds rather than a diagnosis')) throw new Error('intro not matched');
  intro.text = intro.text.replace(
    'No party had stated a root cause for the drain at the time of writing, and this page reports what the ledger holds rather than a diagnosis.',
    'Five hours later the cause was stated publicly as a flaw in the <a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix Engine</a> itself, ' +
    'placing every token and NFT on the network within reach of the same method rather than only the bridged six. ' +
    'At 21:19 UTC Radix mainnet was halted by its node runners and has produced no round since.',
  );

  // 3. Insert the three new sections after "Why the usual controls did not apply".
  const controls = blocks.findIndex((b) => (b.text || '').includes('Why the usual controls did not apply'));
  if (controls === -1) throw new Error('controls section not found');
  blocks.splice(controls + 1, 0, CAUSE, HALT, ETHEREUM);

  // 4. "What is unresolved" – the first question is answered; replace it.
  const unresolved = blocks.findIndex((b) => (b.text || '').includes('What is unresolved'));
  if (unresolved === -1) throw new Error('unresolved section not found');
  blocks[unresolved].text =
    '<h2>What is unresolved</h2>' +
    '<p>The cause is no longer one of them. Three questions stand in its place, and the ledger cannot answer any of them because the ledger has stopped.</p>' +
    '<p>The first is the fix and the resumption. A patch to the Engine has to be written, reviewed and adopted by enough node runners to bring stake back above two thirds, ' +
    'and until it is the network cannot be restarted safely — the exploit is public and the flaw is in the layer every transaction passes through. No date has been offered.</p>' +
    '<p>The second is recovery. The assets left the network within the hour, and what is left of them sits on Ethereum in an account nobody on Radix can reach. ' +
    'Containment moved to the receiving chain and to the exchanges, which is where it stays.</p>' +
    '<p>The third is who responds. The incident landed in the week the <a href="https://radixdao.org/" target="_blank" rel="noopener">Radix DAO</a> was taking over from the Foundation, ' +
    'with the Governance Framework in its ratification discussion period and no permanent council elected. ' +
    '<a href="/contents/tech/core-concepts/radix-governance" rel="noopener">Radix governance</a> describes the bodies that exist and what each of them can decide. ' +
    'What actually stopped the network on 31 August was none of them: it was the node runners, acting together, using the only lever a validator set has.</p>';

  // 5. External links.
  const links = blocks.findIndex((b) => (b.text || '').includes('<h2>External links</h2>'));
  if (links === -1) throw new Error('external links not found');
  blocks[links].text = blocks[links].text.replace(
    '</ul>',
    '<li>' + A('https://github.com/radixdlt/radixdlt-scrypto/blob/v1.3.1/radix-engine/src/system/system_callback.rs#L1147', '<code>verify_boot_ref_value</code> in radixdlt-scrypto v1.3.1') + ' – the reference check the drain went through</li>' +
    '<li>' + A('https://t.me/RadixAccountabilityCouncil/925', 'Radix Accountability Council notice, 21:54 UTC 31 August') + ' – the halt and the execution-layer issue</li>' +
    '<li>' + A('https://eth.blockscout.com/address/0x626d7Be5c2F2b6E9bAa542e25b6313Ac91d47cD2', 'The receiving account on Ethereum') + ' – inbound warp-route transfers and what remains</li>' +
    '</ul>',
  );

  const metadata = { ...(page.metadata || {}), excerpt: 'On 31 August 2026 twenty-six transactions emptied every Hyperlane-bridged asset on Radix; that evening the cause was named as a Radix Engine flaw and the network was halted.' };

  const version = '2.0.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  blocks ${page.content.length} -> ${blocks.length}`);
  if (DRY) {
    console.log('  --- infobox row ---');
    console.log(cell.text.slice(cell.text.indexOf('Root cause') - 40, cell.text.indexOf('Root cause') + 320));
  } else {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query(
      'UPDATE pages SET content=$1, version=$2, metadata=$3, updated_at=$4, last_verified_at=$4 WHERE id=$5',
      [json, version, JSON.stringify(metadata), now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'major', AUTHOR_ID,
       'Cause and halt: the Engine grants a DirectAccess reference to any vault named in a manifest (verify_boot_ref_value, radixdlt-scrypto v1.3.1) and take/lock_fee sit behind the resource withdrawer role, not the account; mainnet halted 21:19:06 UTC at epoch 339,896 round 102; Ethereum side of the trail matched to the Radix amounts.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
