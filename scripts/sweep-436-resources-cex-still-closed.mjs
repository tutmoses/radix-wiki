import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

const TAG_PATH = 'contents/resources';
const SLUG = 'how-to-buy-xrd';
const EXPECT = '1.12.0';
const VERSION = '1.13.0';
const HEADING = 'Four days after the restart, XRD deposits and withdrawals are still closed';
const EXT = 'target="_blank" rel="noopener"';
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

const section = `
<h3>${HEADING}</h3>
<p>Read from the same public endpoints at <strong>19:05 UTC on 15 September 2026</strong>, about 103 hours after the restart, not one flag has moved. <a href="https://api.gateio.ws/api/v4/spot/currencies/XRD" ${EXT}>Gate.io</a> reports deposits and withdrawals disabled on both its Radix and Ethereum chains; <a href="https://api.kucoin.com/api/v3/currencies/XRD" ${EXT}>KuCoin</a> and <a href="https://api.coinex.com/v2/assets/deposit-withdraw-config?ccy=XRD" ${EXT}>CoinEx</a> report both disabled on their Radix chains; KuCoin's XRD/USDT market still answers with every field null; and <a href="https://open-api.bingx.com/openApi/spot/v1/common/symbols?symbol=XRD-USDT" ${EXT}>BingX</a>'s symbol record still carries the offTime of 1 September. None of the four venues still quoting XRD has published a notice this wiki has been able to find.</p>
<table><tbody>
<tr><th>Venue</th><th>Market</th><th>Last price</th><th>Change since 11 September</th><th>24h turnover</th></tr>
<tr><td>Bitpanda</td><td>XRD/USD</td><td>$0.00080</td><td>+17.6%</td><td>no order book</td></tr>
<tr><td>Gate.io</td><td>XRD/USDT</td><td>$0.0008069</td><td>+17.2%</td><td>~$35,300</td></tr>
<tr><td>MEXC</td><td>XRD/USDT</td><td>$0.0005491</td><td>+13.8%</td><td>~$67,500</td></tr>
<tr><td>CoinEx</td><td>XRD/USDT</td><td>$0.00020784</td><td>&minus;57.6%</td><td>~$2,330</td></tr>
</tbody></table>
<p>Gate.io now quotes <strong>3.9 times CoinEx</strong> for the same token, and 47% above MEXC. On 8 September MEXC and CoinEx agreed to within 0.08%; they now differ by a factor of 2.6, because CoinEx lost more than half its price while the other three rose. Most of the fall came on 15 September, when <a href="https://api.coinex.com/v2/spot/kline?market=XRDUSDT&amp;period=1hour&amp;limit=30" ${EXT}>CoinEx's hourly candles</a> run from $0.00039 at midnight UTC to $0.00021 at 18:00. The book is thin: its best bid is 990,898 XRD at $0.0002068, about $205, so any seller with more than that moves the price. Gate.io went the other way the same morning. In the hour from 08:00 UTC <a href="https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=XRD_USDT&amp;interval=1h&amp;limit=24" ${EXT}>it traded as high as $0.0012925</a>, 78% above the previous hour's close, and it has since settled near $0.00081 on ten times the turnover of the 11 September reading.</p>
<p>On 11 September the gap was narrowing. Four days later it is wider than at any earlier reading on this page. The ledger no longer explains it, because the network has committed transactions continuously since 11 September; the venues' closed deposit and withdrawal rails do. Until one of the four reopens them, XRD bought there stays there.</p>`;

const replacements = [
  {
    from: 'restarted at 11:35 UTC on 11 September 2026</a> after 254 hours; XRD deposits and withdrawals still disabled at every venue that publishes them, eight hours later; the four surviving quotes differ by 43%',
    to: 'restarted on 11 September 2026</a> after 254 hours; on 15 September XRD deposits and withdrawals were still disabled at every venue that publishes them, and the highest of the four quotes was 3.9 times the lowest',
  },
  {
    from: '<strong>Radix mainnet restarted at 11:35:28 UTC on 11 September 2026, and eight hours later no venue had reopened XRD deposits or withdrawals.</strong>',
    to: '<strong>Radix mainnet restarted on 11 September 2026, and four days later no venue had reopened XRD deposits or withdrawals.</strong>',
  },
  {
    from: "Read at 19:04 UTC on 11 September from each venue's own API",
    to: "Read on 15 September from each venue's own API",
  },
  {
    from: 'The four surviving quotes disagree by 43%; the measurement is under <strong>The ledger restarted and the books did not</strong> below.',
    to: `The highest of the four surviving quotes is 3.9 times the lowest; the measurement is under <strong>${HEADING}</strong> below.`,
  },
  {
    from: 'Until the network restarts there is no such number, and a purchase made at one of them cannot be moved to a',
    to: 'While the network was halted there was no such number, and a purchase made at one of them could not be moved to a',
  },
  {
    from: 'both legs remain closed at every venue that publishes their state.</p>',
    to: `both legs remain closed at every venue that publishes their state.</p>${section}`,
  },
];

const message = `Sweep 436: the 15 September re-read of every venue's deposit and withdrawal state. At 19:05 UTC, about 103 hours after the restart, Gate.io (both chains), KuCoin and CoinEx still report XRD deposits and withdrawals disabled, KuCoin's market is still null and BingX's offTime is unchanged. The books have split further: Gate.io $0.0008069 (+17.2% since 11 September), Bitpanda $0.00080, MEXC $0.0005491 (+13.8%), CoinEx $0.00020784 (-57.6%, most of it on 15 September), so the highest quote is 3.9 times the lowest against 42.6% on 11 September. New section with the table; infobox and the centralized-exchange lead updated to the reading; the 3 September section's "Until the network restarts there is no such number" past-tensed (the last halt-tense carrier named by run 418); em dashes converted to en dashes.`;

if (new RegExp('[\\u00a0\\u2014]').test(JSON.stringify({ section, replacements, message }))) throw new Error('script contains a U+00A0 or an em dash');

const textNodes = (blocks) => blocks.flatMap((b) => [...(typeof b.text === 'string' ? [b] : []), ...(b.blocks ? textNodes(b.blocks) : [])]);

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(HEADING)) {
    console.log('  already applied, no write');
    process.exit(0);
  }
  if (page.version !== EXPECT) throw new Error(`expected v${EXPECT}, found v${page.version}`);

  for (const r of replacements) {
    let hits = 0;
    for (const n of textNodes(blocks)) {
      const count = n.text.split(r.from).length - 1;
      if (!count) continue;
      n.text = n.text.split(r.from).join(r.to);
      hits += count;
    }
    if (hits !== 1) throw new Error(`expected 1 match for "${r.from.slice(0, 60)}", found ${hits}`);
  }

  let dashes = 0;
  for (const n of textNodes(blocks)) {
    dashes += n.text.split(EM).length - 1;
    n.text = n.text.split(EM).join(EN);
  }

  console.log(`  ${DRY ? '[dry] ' : ''}${TAG_PATH}/${SLUG}  v${page.version} -> v${VERSION}  (minor, ${dashes} em dashes converted, +${JSON.stringify(blocks).length - JSON.stringify(page.content).length} chars)`);
  if (DRY) process.exit(0);

  const now = new Date().toISOString();
  const json = JSON.stringify(blocks);
  await client.query('BEGIN');
  await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, VERSION, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, VERSION, 'minor', AUTHOR_ID, message, now]);
  await client.query('COMMIT');
} finally {
  client.release();
  await pool.end();
}
