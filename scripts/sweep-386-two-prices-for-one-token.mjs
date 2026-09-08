import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

// Run 386, contents/resources rotation. Two edits, both from readings taken at
// 03:08 UTC on 8 September 2026, hour 174 of the mainnet halt:
//   how-to-buy-xrd                      the four surviving quotes are now 60% apart,
//                                       the market has lost two thirds of its turnover,
//                                       CoinEx's XRD/BTC book is gone, and DeFiLlama's
//                                       on-ledger figure is a carried-forward value
//   radix-ecosystem-operational-status  Eagle Ray released without the node half, and
//                                       the council's reading of that release

const DRY = process.argv.includes('--dry-run');
const { Pool } = pg;
const TAG = 'contents/resources';

const HOWTO_SENTINEL = 'Five days on, the gap has widened';
const OPS_SENTINEL = 'the protocol update that carries the fix has been released';

const HOWTO_SECTION = `
<h3>Five days on, the gap has widened to 60%</h3>
<p>Read from the same public endpoints at <strong>03:08 UTC on 8 September 2026</strong>, hour 174 of the halt:</p>
<table><tbody>
<tr><th>Venue</th><th>Market</th><th>Last price</th><th>24h low</th><th>Top-of-book spread</th><th>24h turnover</th></tr>
<tr><td>Bitpanda</td><td>XRD/USD</td><td>$0.00069</td><td>&ndash;</td><td>&ndash;</td><td>no order book</td></tr>
<tr><td>Gate.io</td><td>XRD/USDT</td><td>$0.0006849</td><td>$0.000658</td><td>1.29%</td><td>~$1,530</td></tr>
<tr><td>MEXC</td><td>XRD/USDT</td><td>$0.0004287</td><td>$0.0004000</td><td>1.65%</td><td>~$58,800</td></tr>
<tr><td>CoinEx</td><td>XRD/USDT</td><td>$0.00042906</td><td>$0.00042212</td><td>2.00%</td><td>~$3,920</td></tr>
</tbody></table>
<p><strong>Gate.io now quotes 59.8% above MEXC and 59.6% above CoinEx for the same token</strong>, against the 38.6% this page recorded on 3 September, and both sides moved to get there: over those five days Gate.io rose 4.1% while MEXC fell 10.1% and CoinEx 9.2%. The two cheap books agree with each other to within 0.08%, and Bitpanda's fiat quote still sits with Gate.io rather than between them.</p>
<p>The venue quoting the high price has the smallest book of the three. Gate.io turned over about <strong>$1,530</strong> in twenty-four hours, down from about $6,400 on 3 September, against MEXC's $58,800; its best ask carries 254 $XRD, about 17 cents of size. Across all three order books the centralized $XRD market is now about <strong>$64,300 a day</strong>, against roughly $190,000 on 22 August, so two thirds of it has gone in seventeen days. Each book prices itself off whatever its own last trade was, and the thinner it gets the further that can drift.</p>
<p>One market has closed since 3 September. CoinEx's XRD/BTC book, in the 22 August table above, is gone: <code>api.coinex.com/v2/spot/market</code> lists a single $XRD market, <code>XRDUSDT</code>, and a ticker request for <code>XRDBTC</code> answers <em>"market XRDBTC not found"</em>. That leaves four quotes across three exchanges and one broker.</p>
<h3>The on-ledger volume figure is frozen rather than measured</h3>
<p>This page cites <a href="https://defillama.com/dexs/chain/radix" target="_blank" rel="noopener">DeFiLlama's Radix DEX aggregate</a> above for on-ledger swap volume. That feed reports on a ledger which has committed no transaction since 31 August, and it is still publishing a number. Read at 03:08 UTC on 8 September, <code>api.llama.fi/overview/dexs/radix</code> returns <strong>$17,024</strong> of twenty-four-hour volume with a one-day change of 0, and its daily series carries the identical $17,024 on 5, 6 and 7 September. Every dollar of it is attributed to one adapter, DefiPlaza; the other six Radix adapters return 0.</p>
<p>No swap has settled on Radix in seven days, so an on-ledger volume figure published during the halt is a value carried forward and not a measurement. The same caution covers the price and market-capitalisation numbers aggregators publish for $XRD, because they are derived from the exchange books above and those books no longer agree with each other.</p>`.trim();

const OPS_SECTION = `
<p><strong>Day eight, and the protocol update that carries the fix has been released without the node software to run it.</strong> At 17:35 UTC on 7 September the Radix engine repository published <a href="https://github.com/radixdlt/radixdlt-scrypto/releases/tag/v1.4.0" target="_blank" rel="noopener">Scrypto v1.4.0, "Eagle Ray"</a>. Three hours later the Radix Accountability Council told its own channel that the release is not the restart: developers had spotted "that the Eagle is landed", which it glossed as the code name for the protocol upgrade that will get the network fixed, but <a href="https://t.me/RadixAccountabilityCouncil/1000" target="_blank" rel="noopener">"that's not enough"</a> &ndash; a lot of moving parts are not ready, the testing is not done, the reviews are not complete, and there is still no date it can commit to. The node software is the missing half: <a href="https://github.com/radixdlt/babylon-node/releases" target="_blank" rel="noopener">babylon-node's latest release</a> is still v1.3.0.5 of 1 June 2026, and a validator operator installs a node release rather than an engine tag.</p>
<p>Read at <strong>03:08 UTC on 8 September</strong>, the Gateway returns the same last committed ledger it has returned since the stop &ndash; state version 557,840,622, epoch 339,896, round 102 &ndash; one hundred and seventy-three hours and forty-nine minutes without a committed round, and <code>/state/validators/list</code> answers HTTP 500 at a sync delay of <strong>625,745 seconds</strong> against the 720 the Gateway tolerates. <a href="/contents/tech/releases/stokenet" rel="noopener">Stokenet</a> is unaffected and advancing normally, at epoch 3,063 in the same pass.</p>`.trim();

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

const load = async (slug) => {
  if (isLockedPage(TAG, slug)) throw new Error(`${slug} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG, slug]);
  if (!rows.length) throw new Error(`${slug} not found`);
  return rows[0];
};

const write = async (page, blocks, version, message) => {
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  if (DRY) return;
  const now = new Date().toISOString();
  const json = JSON.stringify(blocks);
  await client.query('BEGIN');
  await client.query(
    'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
    [json, version, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID, message, now]);
  await client.query('COMMIT');
};

try {
  // ---- 1. how-to-buy-xrd -------------------------------------------------
  const howto = await load('how-to-buy-xrd');
  const hb = JSON.parse(JSON.stringify(howto.content));
  if (JSON.stringify(hb).includes(HOWTO_SENTINEL)) {
    console.log('  how-to-buy-xrd: already applied - no write');
  } else {
    const infoRow = 'disabled at every venue checked';
    const hInfo = hb[0].blocks[0];
    if (!hInfo.text.includes(infoRow)) throw new Error('how-to-buy infobox row not found');
    hInfo.text = hInfo.text.replace(
      infoRow, 'disabled at every venue checked; the four surviving quotes differ by 60%');
    hb[3].text = `${hb[3].text}\n${HOWTO_SECTION}`;
    await write(howto, hb, '1.11.0',
      'Resources rotation, run 386: re-read the four surviving $XRD books at 03:08 UTC on 8 September. Gate.io now quotes 59.8% above MEXC and 59.6% above CoinEx, against 38.6% on 3 September, with both sides moving; total centralized turnover is down to ~$64,300 a day from ~$190,000 on 22 August; CoinEx has closed its XRD/BTC market; and DeFiLlama is still publishing an on-ledger volume figure for a ledger that has settled nothing since 31 August.');
  }

  // ---- 2. radix-ecosystem-operational-status -----------------------------
  const ops = await load('radix-ecosystem-operational-status');
  const ob = JSON.parse(JSON.stringify(ops.content));
  if (JSON.stringify(ob).includes(OPS_SENTINEL)) {
    console.log('  radix-ecosystem-operational-status: already applied - no write');
  } else {
    const stale = 'no restart date announced as of 07:03 UTC, 5 September';
    const oInfo = ob[0].blocks[0];
    if (!oInfo.text.includes(stale)) throw new Error('ops infobox network-status row not found');
    oInfo.text = oInfo.text.replace(
      stale, 'no restart date announced as of 03:08 UTC, 8 September');
    ob[2].text = `${ob[2].text}\n${OPS_SECTION}`;
    await write(ops, ob, '1.12.0',
      'Resources rotation, run 386: Scrypto v1.4.0 (Eagle Ray) was published at 17:35 UTC on 7 September and the Radix Accountability Council said three hours later that the release is not enough, with testing and reviews unfinished and no date; babylon-node is still on v1.3.0.5 of 1 June, so the node half is unreleased. Thirty-ninth ledger reading at 03:08 UTC on 8 September, unchanged at state version 557,840,622.');
  }
} finally {
  client.release();
  await pool.end();
}
