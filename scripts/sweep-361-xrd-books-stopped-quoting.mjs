// Run 361 (contents/resources rotation). Two of the six XRD spot books stopped
// quoting during the network halt, and the surviving four quote two different
// prices because arbitrage between them runs through a stopped ledger.
// Measured 2026-09-03 23:06 UTC from each venue's own public API.
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'contents/resources';
const SLUG = 'how-to-buy-xrd';
const SENTINEL = 'Two of the six books stopped quoting';
const DRY = process.argv.includes('--dry-run');

const OLD_HALT_P = `<p><strong>As of 1 September 2026, deposits and withdrawals are switched off.</strong> Radix mainnet has been <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">halted since 21:19 UTC on 31 August 2026</a> and no transaction has settled since. Read at 07:09 UTC on 1 September from each venue's own API, native XRD deposits and withdrawals are disabled at <a href="https://api.gateio.ws/api/v4/spot/currencies/XRD" target="_blank" rel="noopener">Gate.io</a>, <a href="https://api.kucoin.com/api/v3/currencies/XRD" target="_blank" rel="noopener">KuCoin</a> and <a href="https://api.coinex.com/v2/assets/deposit-withdraw-config?ccy=XRD" target="_blank" rel="noopener">CoinEx</a>. The spot books below are still quoting and still trading, so XRD can be bought and sold on an exchange that already holds it &mdash; but until the network restarts it cannot be sent to a Radix wallet, and coins in a wallet cannot be sent to an exchange. Check the venue's own deposit and withdrawal status before funding anything.</p>`;

const NEW_HALT_P = `<p><strong>As of 3 September 2026, two of the six books have stopped quoting and no venue will move native XRD.</strong> Radix mainnet has been <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">halted since 21:19 UTC on 31 August 2026</a> and no transaction has settled since. Read at 23:06 UTC on 3 September from each venue's own API, native XRD deposits and withdrawals are disabled at <a href="https://api.gateio.ws/api/v4/spot/currencies/XRD" target="_blank" rel="noopener">Gate.io</a>, <a href="https://api.kucoin.com/api/v3/currencies/XRD" target="_blank" rel="noopener">KuCoin</a> and <a href="https://api.coinex.com/v2/assets/deposit-withdraw-config?ccy=XRD" target="_blank" rel="noopener">CoinEx</a>, and <a href="https://open-api.bingx.com/openApi/spot/v1/common/symbols?symbol=XRD-USDT" target="_blank" rel="noopener">BingX</a> and <a href="https://api.kucoin.com/api/v1/market/stats?symbol=XRD-USDT" target="_blank" rel="noopener">KuCoin</a> are no longer quoting the token at all. MEXC, Gate.io, CoinEx and Bitpanda still are, so XRD can be bought and sold on a venue that already holds it, but until the network restarts it cannot be sent to a Radix wallet and coins in a wallet cannot be sent to a venue. The four surviving quotes now disagree by more than a third; the measurement is under <strong>${SENTINEL}</strong> below. Check the venue's own deposit and withdrawal status before funding anything.</p>`;

const OLD_BINGX = `<li><a target="_blank" rel="noopener" href="https://bingx.com/en/spot/XRDUSDT/">BingX</a> – XRD/USDT</li>`;
const NEW_BINGX = `<li><a target="_blank" rel="noopener" href="https://bingx.com/en/spot/XRDUSDT/">BingX</a> – XRD/USDT, <strong>not quoting since 03:00 UTC on 1 September 2026</strong>, the instant the exchange's own symbol record gives as its <code>offTime</code></li>`;

const OLD_KUCOIN = `<li><a target="_blank" rel="noopener" href="https://www.kucoin.com/trade/XRD-USDT">KuCoin</a> – XRD/USDT</li>`;
const NEW_KUCOIN = `<li><a target="_blank" rel="noopener" href="https://www.kucoin.com/trade/XRD-USDT">KuCoin</a> – XRD/USDT, <strong>not quoting when read on 3 September 2026</strong>, with the pair absent from the exchange's symbol registry and the XRD currency still listed</li>`;

const OLD_INFOBOX_ROW = `<tr><td><strong>Self-custody</strong></td>`;
const NEW_INFOBOX_ROW = `<tr><td><strong>Network status</strong></td><td>Mainnet <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">halted since 31 August 2026</a>; native XRD deposits and withdrawals disabled at every venue checked</td></tr><tr><td><strong>Self-custody</strong></td>`;

const NEW_SECTION = `<h3>${SENTINEL}</h3>
<p>Everything above was measured while native XRD could still move between venues. It cannot now. Read from the same public endpoints at <strong>23:06 UTC on 3 September 2026</strong>, four days into the halt, two of the six books have gone quiet:</p>
<ul>
<li><strong>BingX</strong> stopped first, and its own registry dates it. The spot symbol record for <code>XRD-USDT</code> carries <code>"status": 0</code> with <code>offTime</code> and <code>maintainTime</code> both set to <code>1788231600000</code>, which is <strong>03:00:00 UTC on 1 September 2026</strong>, five hours and forty-one minutes after the ledger stopped. The pair had been online since 05:07 UTC on 20 May 2023. Its 24-hour ticker now answers <em>"symbol is not found"</em>.</li>
<li><strong>KuCoin</strong> is not quoting either, and its two endpoints describe it differently. <code>api/v1/market/stats</code> returns the symbol with last price, bid, ask, high, low and volume all <code>null</code>; <code>api/v2/symbols/XRD-USDT</code> answers <em>"Trading pair XRD-USDT does not exist"</em>. The XRD currency entry is still there, carrying <code>isDepositEnabled</code> and <code>isWithdrawEnabled</code> false and a Radix account-address regex.</li>
</ul>
<p>Holders in the project's Telegram channel read this as a delisting on the afternoon of 3 September and were contradicted within the minute (<a href="https://t.me/radix_dlt/1001769" target="_blank" rel="noopener">t.me/radix_dlt/1001769</a>, <a href="https://t.me/radix_dlt/1001772" target="_blank" rel="noopener">/1001772</a>). Neither exchange has published a notice this wiki has been able to find, so the reading the endpoints support is the one recorded here: two markets stopped quoting during a network halt, one of them at a timestamp the exchange itself records, and neither venue has removed its XRD asset entry.</p>
<p>What is left quotes two different prices for the same token:</p>
<table><tbody>
<tr><th>Venue</th><th>Market</th><th>Last price</th><th>24h low</th><th>24h turnover</th></tr>
<tr><td>Bitpanda</td><td>XRD/USD</td><td>$0.00066</td><td>brokerage quote</td><td>no order book</td></tr>
<tr><td>Gate.io</td><td>XRD/USDT</td><td>$0.0006582</td><td>$0.000658</td><td>~$6,400</td></tr>
<tr><td>MEXC</td><td>XRD/USDT</td><td>$0.0004769</td><td>$0.0003738</td><td>~$64,000</td></tr>
<tr><td>CoinEx</td><td>XRD/USDT</td><td>$0.00047261</td><td>$0.00041836</td><td>~$2,900</td></tr>
</tbody></table>
<p><strong>Gate.io is quoting 38.6% above MEXC and CoinEx for the same token</strong>, and Bitpanda's fiat quote sits with Gate.io rather than in the middle. That is nearly three times the 14% dislocation this page recorded on 22 August, and it has the same cause with nothing left to close it. Arbitrage between two XRD books is a withdrawal from one and a deposit at the other, and both legs run through a ledger that has stopped: no coin can leave the venue quoting $0.00066 for the venue quoting $0.00047. The one route still open does not help, because it does not lead anywhere. Gate.io alone still permits withdrawals on its Ethereum-side entry for the eXRD wrapper token, and CoinEx's deposit configuration lists a single chain, the Radix one, which is closed at both ends.</p>
<p>Each book is now a closed pool of the coins that happened to be sitting on that exchange when the network stopped, priced by whoever is still inside it. <strong>None of the four numbers above is the price of XRD.</strong> Until the network restarts there is no such number, and a purchase made at one of them cannot be moved to a <a href="/contents/tech/core-protocols/radix-wallet" rel="noopener">Radix Wallet</a>, staked, or spent.</p>`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content, metadata FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  const flat = JSON.stringify(blocks);
  if (flat.includes(SENTINEL)) { console.log('  already applied — no write'); process.exit(0); }

  const infobox = blocks.find((b) => b.type === 'infobox');
  const ibChild = infobox.blocks[0];
  const cex = blocks.find((b) => b.id === 'ce97dc8b-d281-4500-bca6-26fea8ab4489');
  const liq = blocks.find((b) => b.id === '0c728054-a092-495a-b35c-35fcedfe49bf');
  if (!ibChild || !cex || !liq) throw new Error('target blocks not found');

  const edits = [
    [ibChild, OLD_INFOBOX_ROW, NEW_INFOBOX_ROW, 'infobox network-status row'],
    [cex, OLD_HALT_P, NEW_HALT_P, 'halt paragraph'],
    [cex, OLD_BINGX, NEW_BINGX, 'BingX list item'],
    [cex, OLD_KUCOIN, NEW_KUCOIN, 'KuCoin list item'],
  ];
  for (const [blk, from, to, label] of edits) {
    if (!blk.text.includes(from)) throw new Error(`find-string missed: ${label}`);
    blk.text = blk.text.replace(from, to);
    console.log(`  ok  ${label}`);
  }
  liq.text = `${liq.text}\n${NEW_SECTION}`;
  console.log('  ok  new section appended to liquidity block');

  const version = '1.10.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
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
       'Two of the six XRD spot books stopped quoting during the halt: BingX offline at 03:00 UTC 1 September by its own offTime, KuCoin absent from its symbol registry. The four survivors disagree by 38.6% because arbitrage between them runs through a stopped ledger. Measured 23:06 UTC 3 September from each venue public API.', now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
