// Sweep 538: the 5 Oct 2026 re-read of every XRD venue for /contents/resources/how-to-buy-xrd.
// Flags unchanged since 24 Sep (KuCoin deposits+withdrawals open; Gate.io and CoinEx withdrawals
// only; BingX offTime 1 Sep). Prices have split: KuCoin 0.0003569, MEXC 0.000358, Bitpanda USD
// 0.00035, Gate.io 0.0005199 (+45% on the KuCoin/MEXC mean). CoinEx's ticker answers "not found"
// for every market, BTCUSDT included, so it is left out of the table.
// Adds a dated h3 above the 24 Sep one and re-dates the lead paragraph and infobox.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'contents/resources';
const SLUG = 'how-to-buy-xrd';
const HEADING = 'Twenty-four days after the restart, Gate.io quotes XRD 45% above the other books';
const SENTINEL = `<h3>${HEADING}</h3>`;
const SECTION = `${SENTINEL}<p>Read from the same public endpoints on <strong>5 October 2026</strong>, every venue's deposit and withdrawal flags are where they were on 24 September: <a href="https://api.kucoin.com/api/v3/currencies/XRD" target="_blank" rel="noopener">KuCoin</a> has both open; <a href="https://api.gateio.ws/api/v4/spot/currencies/XRD" target="_blank" rel="noopener">Gate.io</a> and <a href="https://api.coinex.com/v2/assets/deposit-withdraw-config?ccy=XRD" target="_blank" rel="noopener">CoinEx</a> let XRD out but not in; and <a href="https://open-api.bingx.com/openApi/spot/v1/common/symbols?symbol=XRD-USDT" target="_blank" rel="noopener">BingX</a>'s symbol record still carries the 1 September <code>offTime</code>. The prices have moved apart.</p>
<table><tbody>
<tr><th>Venue</th><th>Market</th><th>Last price</th><th>24h turnover</th></tr>
<tr><td><a href="https://api.mexc.com/api/v3/ticker/24hr?symbol=XRDUSDT" target="_blank" rel="noopener">MEXC</a></td><td>XRD/USDT</td><td>$0.000358</td><td>~$62,300</td></tr>
<tr><td><a href="https://api.kucoin.com/api/v1/market/stats?symbol=XRD-USDT" target="_blank" rel="noopener">KuCoin</a></td><td>XRD/USDT</td><td>$0.000357</td><td>~$12,900</td></tr>
<tr><td><a href="https://api.bitpanda.com/v1/ticker" target="_blank" rel="noopener">Bitpanda</a></td><td>XRD/USD</td><td>$0.00035</td><td>no order book</td></tr>
<tr><td><a href="https://api.gateio.ws/api/v4/spot/tickers?currency_pair=XRD_USDT" target="_blank" rel="noopener">Gate.io</a></td><td>XRD/USDT</td><td>$0.000520</td><td>~$1,200</td></tr>
</tbody></table>
<p>MEXC, KuCoin and Bitpanda quote within 2% of each other, and Gate.io's last trade sits 45% above them, against 16% on 24 September. Gate.io's deposits are still closed, so nobody can move XRD onto the venue to sell into its price, and a buyer there pays the difference. CoinEx is left out because its public ticker answers "not found" for every market, Bitcoin's included, so its XRD price cannot be read.</p>
`;
const EDITS = [
  ['and unchanged when read again on 3 October,', 'and unchanged when read again on 5 October,'],
  ['the measurement is under <strong>Thirteen days after the restart, three venues let XRD out</strong> below.', `the measurement is under <strong>${HEADING}</strong> below.`],
  ['re-read on 3 October 2026, KuCoin, Gate.io and CoinEx', 're-read on 5 October 2026, KuCoin, Gate.io and CoinEx'],
  ['<h3>Thirteen days after the restart, three venues let XRD out</h3>', `${SECTION}<h3>Thirteen days after the restart, three venues let XRD out</h3>`],
];
const DRY = process.argv.includes('--dry-run');

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();
try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query('SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  let json = JSON.stringify(page.content);
  if (json.includes(JSON.stringify(SENTINEL).slice(1, -1))) {
    console.log('  already applied – no write');
    process.exit(0);
  }
  for (const [from, to] of EDITS) {
    const f = JSON.stringify(from).slice(1, -1);
    if (json.split(f).length !== 2) throw new Error(`expected exactly one match for: ${from.slice(0, 60)}`);
    json = json.replace(f, () => JSON.stringify(to).slice(1, -1));
  }
  JSON.parse(json);

  const version = '1.17.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  (${json.length - JSON.stringify(page.content).length} chars added)`);
  if (!DRY) {
    const now = new Date().toISOString();
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
        'Sweep 538: the 5 Oct 2026 re-read of every XRD venue from its own API. Deposit and withdrawal flags are unchanged since 24 Sep; Gate.io now quotes 45% above MEXC, KuCoin and Bitpanda (16% on 24 Sep) with its deposits still closed. CoinEx omitted: its ticker answers "not found" for every market.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
