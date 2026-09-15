// sweep 438 - /ecosystem/ociswap (v3.1.5, last verified 2 August 2026) was the oldest unverified
// Active page in the ecosystem rotation and said nothing about the exchange since the restart.
// Backlog item from the 13 September Week in Review ("one pool is mispriced after the restart")
// re-read and traced to the pool. Readings, all 15 September 2026:
//
//   - api.ociswap.com/statistics, 23:07 UTC: volume.xrd.7d 11069976003118183.086336,
//     24h 992373.674900 over 663 swaps (event_counts.swap.24h), 1h 4862.181171 over 3.
//     volume.xrd.total 48587050624372502.086185.
//   - api.ociswap.com/pools?order=volume_xrd_7d: the top pool is XRD/BONK,
//     component_rdx1czgtqmx9hatgtvuzep0ds8vkjc22agmlxuvpdzpecj7mcawvvjts4m, at
//     11069975987199123.792223 XRD 7d (24h 0), lifetime 11069975987354351.522081. Second is
//     REDDICKS/XRD at 6,369,047 XRD. 7d total minus this pool = 15,919,060 XRD.
//   - Radix Gateway /state/entity/details, state version 558,348,795 (epoch 341,187): the pool
//     component is a BasicPool whose liquidity_pool is
//     pool_rdx1ck7f94gyswg6e2a7z2255gq8umjvnuem97twfl8ppg7ldmx0m5pvwu, holding
//     4.858767723298435478 XRD and 1.007087607496900524 BONK. BONK is
//     resource_rdx1th55ehrs265ukym6ntejrrype3w23sky4v8cwew534td803ny44t6z, supply 1,000,000,000,
//     name "Bonk", description "BONK Radix version PUMP IT 100x!!!", info_url bonkcoin.com,
//     icon_url a coinmarketcap Solana-BONK asset. No relation to the Solana token.
//   - /stream/transactions filtered on the pool address, paged to the pool's creation: 98
//     transactions ever, first 2023-10-06T11:21:45Z, last 2026-09-13T08:23:31Z, 59 of them dated
//     2026-09-12. Summing the largest XRD balance change per transaction: 3,822.92 XRD across the
//     60 since 8 September (the endpoint's window), largest 1,014.70 XRD
//     (txid_rdx1lnw0ky7m9jdkg2x4fda4z6dq6rtezqg3qvvvna5c2rx4j5evfatsqhtyqn, 12 Sept 13:21 UTC);
//     195,183.26 XRD across all 98.
//   - XRD total supply 13,527,177,664.289855 at state version 558,349,034. 1.1069976e16 / 1.3527e10
//     = about 818,000x. 1.1069976e16 / 3,822.92 = about 2.9e12.
//   - api.llama.fi/protocol/ociswap carries tvl only (latest 71,826 USD) and no volume series, and
//     api.ociswap.com/defillama/{volume,overview,pairs} all 404, so the figure does not reach it.
//
// Run:  node scripts/sweep-438-ociswap-statistics.mjs [--dry-run]

import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const A = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

const TAG_PATH = 'ecosystem';
const SLUG = 'ociswap';
const VERSION = '3.2.0';

const POOL_COMPONENT = 'component_rdx1czgtqmx9hatgtvuzep0ds8vkjc22agmlxuvpdzpecj7mcawvvjts4m';
const BONK = 'resource_rdx1th55ehrs265ukym6ntejrrype3w23sky4v8cwew534td803ny44t6z';
const XRD = 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd';
const DASH = 'https://dashboard.radixdlt.com';
const STATS = 'https://api.ociswap.com/statistics';
const POOL_API = `https://api.ociswap.com/pools/${POOL_COMPONENT}`;
const LLAMA = 'https://defillama.com/protocol/ociswap';
const DRAIN = '/contents/history/hyperlane-asset-drain-2026';
const SENTINEL = POOL_COMPONENT;

const MESSAGE =
  'New section on the exchange-wide volume Ociswap publishes. At 23:07 UTC on 15 September 2026 api.ociswap.com/statistics reported a seven-day volume of 11,069,976,003,118,183 XRD, about 818,000 times the 13,527,177,664 XRD in existence. 11,069,975,987,199,123 of it is credited to one pool, XRD/BONK, which the Radix Gateway shows holding 4.86 XRD and 1.01 BONK at state version 558,348,795. The ledger records 98 transactions against that pool since October 2023, 60 of them in the endpoint window moving 3,823 XRD in total. The page was last verified on 2 August and said nothing about the exchange after the 11 September restart.';

const HTML = [
  '<h2>Reported trading volume, September 2026</h2>',
  `<p>Ociswap publishes exchange-wide figures at ${A(STATS, '<code>api.ociswap.com/statistics</code>')}, the endpoint its own site reads. At 23:07 UTC on 15 September 2026 that endpoint gave a seven-day trading volume of 11,069,976,003,118,183 XRD. Every XRD that exists, ${A(`${DASH}/resource/${XRD}`, 'read from the Radix Gateway')} at the same time, comes to 13,527,177,664, so the reported figure is about 818,000 times the whole supply. The twenty-four-hour window on the same read gave 992,374 XRD across 663 swaps, which is the scale the exchange has traded at since Radix <a href="${DRAIN}" rel="noopener">restarted on 11 September 2026</a>.</p>`,
  `<p>Almost all of the seven-day figure sits in one pool. Ociswap's ${A(POOL_API, 'per-pool endpoint')} credits the XRD/BONK pool, ${A(`${DASH}/component/${POOL_COMPONENT}`, '<code>component_rdx1czgt&hellip;awvvjts4m</code>')}, with 11,069,975,987,199,123 XRD of it, leaving 15.9m XRD for every other pool on the exchange. The BONK in that pair is ${A(`${DASH}/resource/${BONK}`, 'a Radix token of 1,000,000,000 units')} whose on-ledger description reads "BONK Radix version PUMP IT 100x!!!" and whose info link points at bonkcoin.com, the site of an unrelated Solana memecoin. Read from the Radix Gateway at state version 558,348,795, the pool holds 4.858768 XRD and 1.007088 BONK.</p>`,
  '<p>The ledger records no trading of that size. Ninety-eight transactions have touched the pool since it was created on 6 October 2023, fifty-nine of them on 12 September 2026, the day after the restart. In the seven days the endpoint covers, sixty transactions moved 3,823 XRD between them, and the largest single one moved 1,015 XRD. Across the pool’s whole life the figure is about 195,000 XRD. The reported seven-day volume is about three trillion times what the pool traded in the same period.</p>',
  `<p>The one-hour and twenty-four-hour windows on the same endpoint are unaffected. The all-time total is not: the same pool is carried at 11,069,975,987,354,351 XRD of lifetime volume inside an exchange-wide all-time figure of 48,587,050,624,372,502 XRD. ${A(LLAMA, 'DefiLlama’s Ociswap entry')} carries total value locked and no volume series, so the figure does not reach it.</p>`,
].join('\n');

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${TAG_PATH}/${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error(`${TAG_PATH}/${SLUG} not found`);
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  ociswap: already applied - no write');
    process.exit(0);
  }
  const last = blocks[blocks.length - 1];
  if (!last || last.type !== 'content' || !last.text.startsWith('<h2>Ociswap V2</h2>')) {
    throw new Error(`unexpected tail block: ${last && last.type} ${last && String(last.text).slice(0, 40)}`);
  }
  blocks.push({ id: uid(), type: 'content', text: HTML });

  const json = JSON.stringify(blocks);
  if ([0x2014, 0xa0].some((c) => json.includes(String.fromCharCode(c)))) throw new Error('em dash or non-breaking space in content');

  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${VERSION}  (+${HTML.length} chars, block ${blocks.length} of ${blocks.length})`);
  for (const line of HTML.split('\n')) console.log(`+ ${line}`);

  if (!DRY) {
    const now = new Date().toISOString();
    await client.query('BEGIN');
    await client.query(
      'UPDATE pages SET content = $1, version = $2, updated_at = $3 WHERE id = $4',
      [json, VERSION, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, VERSION, 'minor', AUTHOR_ID, MESSAGE, now]);
    await client.query('COMMIT');
    console.log('\n  written');
  }
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  throw err;
} finally {
  client.release();
  await pool.end();
}
