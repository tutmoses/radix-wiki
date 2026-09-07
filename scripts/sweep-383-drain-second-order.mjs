import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/history';
const SLUG = 'hyperlane-asset-drain-2026';
const SENTINEL = 'id="empty-pools"';
const DRY = process.argv.includes('--dry-run');

const OLD_STATUS =
  'Still halted when re-read at 11:06:56 UTC, 6 September, one hundred and thirty-three hours and forty-eight minutes after the last round';
const NEW_STATUS =
  'Still halted when re-read at 15:05:16 UTC, 7 September, one hundred and sixty-one hours and forty-six minutes after the last round';

const OLD_XRD =
  '<p>XRD itself was not swept. The 13,000 XRD that moved was fee payment, and it came from one vault rather than from the network at large. The scope of the drain is what the attacker could bridge, which is not the same statement as the scope of what the method could reach.</p>';
const NEW_XRD =
  '<p>XRD itself was not swept by the twenty-six transactions. The 13,000 XRD that moved in them was fee payment, and it came from one vault rather than from the network at large. The scope of the drain is what the attacker could bridge, which is not the same statement as the scope of what the method could reach, and not the same statement as the scope of the loss either: <a href="#empty-pools" rel="noopener">the pools the drain emptied paid out the rest of their $XRD to whoever asked next</a>.</p>';

const VICTIMS = `<h2 id="who-the-sweep-took-from">Who the sweep took from</h2><p>The 16:33 transaction is the one to read for this, because it is the largest and because its receipt lists every balance it changed. Sixty-two entities lost hUSDC in it, and they are not all people. Thirty-six are user accounts. Thirteen are native two-resource pools, the component type that holds a trading pair and issues a pool unit to whoever deposited into it. Thirteen are dApp components: the largest is <a href="https://dashboard.radixdlt.com/component/component_rdx1cpk2tvwyg2pkzft9ysdwqffwsm6gcca2p3jd6at0p4h0ayty30shcl" target="_blank" rel="noopener">XHSWAP</a>, which exists to swap Radix-native assets into Hyperlane ones, and the second is an order book for the $XRD/hUSDC pair.</p><table><tbody><tr><td><strong>Held by</strong></td><td><strong>Entities</strong></td><td><strong>hUSDC taken</strong></td></tr><tr><td>User accounts</td><td>36</td><td>182,508.03</td></tr><tr><td>Native two-resource pools</td><td>13</td><td>155,391.82</td></tr><tr><td>dApp components</td><td>13</td><td>105,085.79</td></tr></tbody></table><p>Two resources moved in the whole transaction, hUSDC and $XRD, and the only $XRD row is a 380.04 credit to one component plus the 8.39 fee. No non-fungible balance changed at all, and the <a href="https://dashboard.radixdlt.com/account/account_rdx168lx67kgw2fsd9awudqhmwlhc9gwjw79d84mrx5cayul7gg3973f29" target="_blank" rel="noopener">collecting account</a> holds no NFT at the last committed state version. That is the answer to the question the main Radix chat has been asking since the halt: staked $XRD, stake units and NFTs were not taken. A liquidity position was, if the pair had a bridged asset on one side, and its holder never touched a bridged asset directly.</p>`;

const POOLS = `<h2 id="empty-pools">What the empty pools paid out</h2><p>An automated market maker prices one asset against the other by what it holds of each. Empty one side and the price of the remaining side collapses towards nothing, and the pool will still trade at it, because a pool has no way to know why its balance changed. Thirteen pools were left in that state at 16:33 UTC, and the first was arbitraged forty-one minutes later.</p><p>The largest of them, <code>pool_rdx1chxzajmur7p67h0uvk7etgnm9m67ptzfv7ysfdvq35ck2zz6zuttqq</code>, issues the pool unit named Defiplaza hUSDC Base and held 2,687,281.65 $XRD alongside its 105,038.34 hUSDC at the state version immediately before the sweep. At 17:14:40 UTC <a href="https://dashboard.radixscan.io/transaction/txid_rdx10v6taj9w9dg4343zx2mn7wuuqqs8shhwvq3e7qr6cu8jm76qmvkqqmkget/summary" target="_blank" rel="noopener">one account withdrew 0.000001 hUSDC from its own balance</a>, swapped it through DefiPlaza, and took the entire $XRD side. It is a different account from the one that ran the drain, and it signed an ordinary transaction: no flaw was needed, only a price.</p><p>It kept going for an hour, through the $XRD/hSOL pools as well:</p><table><tbody><tr><td><strong>Time, 31 August</strong></td><td><strong>In</strong></td><td><strong>Out</strong></td></tr><tr><td>17:14:40</td><td>0.000001 hUSDC</td><td>106,076 ASTRL</td></tr><tr><td>17:16:01</td><td>106,076 ASTRL</td><td>2,420,151 $XRD</td></tr><tr><td>17:32:58</td><td>0.0001 hSOL</td><td>1,700,015 $XRD</td></tr><tr><td>17:33:15</td><td>0.0001 hSOL</td><td>1,574,116 $XRD</td></tr><tr><td>17:43:19</td><td>0.0000001 hSOL</td><td>102,266 ASTRL</td></tr><tr><td>17:56:59</td><td>10 $XRD</td><td>10,181 ASTRL</td></tr><tr><td>18:13:46</td><td>0.01 hUSDC</td><td>72,556 ASTRL</td></tr></tbody></table><p>That is 5,694,282 $XRD out of the pools between 17:16 and 17:33, and 185,003 ASTRL kept after the round trips. Two million of the $XRD left Radix at 17:18 and 17:26, in <a href="https://dashboard.radixscan.io/transaction/txid_rdx1urfcwcwpspmyu2y945pu9k8felfjxz0hut4mwtftt35wr0d6js8qy0ue56/summary" target="_blank" rel="noopener">two calls to <code>transfer_remote</code></a> on the $XRD warp route, a million each, destination domain 8453, which is Base. The drain used domain 1, which is Ethereum, and a different recipient address, so this is a second party rather than the same one twice. The account still holds 3,920,351 $XRD and 185,003 ASTRL, frozen where the ledger stopped.</p><p>The loss lands on the liquidity providers, and it is still outstanding. The Defiplaza hUSDC Base pool unit had 91,710.25 tokens in supply before the sweep and the same 91,710.25 at the last committed state version, so nobody redeemed and nobody was diluted; the pool behind those 91,710.25 units reads zero $XRD and zero hUSDC. Every figure in this section is read from the Gateway pinned to state version 557,840,622, the last one the ledger reached, which is the only way to ask it anything <a href="/contents/tech/core-protocols/radix-gateway-api#pinned-reads" rel="noopener">while the network is halted</a>.</p>`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);

  for (const [name, s] of [['VICTIMS', VICTIMS], ['POOLS', POOLS], ['NEW_XRD', NEW_XRD], ['NEW_STATUS', NEW_STATUS]]) {
    if (/[ —]/.test(s)) throw new Error(`${name} contains U+00A0 or an em dash`);
  }

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied - no write');
    process.exit(0);
  }

  const info = blocks[0];
  if (info.type !== 'infobox') throw new Error('block 0 is not the infobox');
  const cell = info.blocks[0];
  if (!cell.text.includes(OLD_STATUS)) throw new Error('infobox status row not matched');
  cell.text = cell.text.replace(OLD_STATUS, NEW_STATUS);

  const i = blocks.findIndex((b) => b.text && b.text.includes(OLD_XRD));
  if (i === -1) throw new Error('XRD-not-swept paragraph not matched');
  blocks[i].text = blocks[i].text.replace(OLD_XRD, NEW_XRD);

  blocks.splice(i + 1, 0,
    { id: uid(), type: 'content', text: VICTIMS },
    { id: uid(), type: 'content', text: POOLS });

  const version = '2.16.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  infobox status row rewritten; XRD paragraph scoped at block ${i}; 2 sections inserted at ${i + 1}`);
  console.log(`  blocks ${page.content.length} -> ${blocks.length}`);

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query(
      'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Two sections on the second-order loss, read from the Gateway pinned to state version 557,840,622: the 16:33 sweep took hUSDC from 36 accounts, 13 native pools and 13 dApp components with no non-fungible balance touched; and between 17:14 and 18:13 UTC one account swapped dust into the pools the sweep had emptied and took 5,694,282 XRD out of them, bridging 2,000,000 of it to Base. Infobox network-status row moved to the 7 September reading.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
