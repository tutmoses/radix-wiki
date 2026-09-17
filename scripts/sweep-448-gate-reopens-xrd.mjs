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
const EXPECT = '1.13.0';
const VERSION = '1.14.0';
const HEADING = 'Six days after the restart, Gate.io reopens XRD deposits and withdrawals';
const EXT = 'target="_blank" rel="noopener"';
const GATE = `<a href="https://api.gateio.ws/api/v4/spot/currencies/XRD" ${EXT}>Gate.io</a>`;
const KUCOIN = `<a href="https://api.kucoin.com/api/v3/currencies/XRD" ${EXT}>KuCoin</a>`;
const COINEX = `<a href="https://api.coinex.com/v2/assets/deposit-withdraw-config?ccy=XRD" ${EXT}>CoinEx</a>`;
const BINGX = `<a href="https://open-api.bingx.com/openApi/spot/v1/common/symbols?symbol=XRD-USDT" ${EXT}>BingX</a>`;
const WALLET = '<a href="/contents/tech/core-protocols/radix-wallet" rel="noopener">Radix Wallet</a>';

const lead = `<p><strong>Radix mainnet restarted on 11 September 2026, and on 17 September Gate.io became the first venue to reopen XRD deposits and withdrawals.</strong> Two of the six books stopped quoting during the <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">254-hour halt</a> and have not come back. Read on 17 September from each venue's own API, ${GATE} reports native XRD deposits and withdrawals enabled, ${KUCOIN} and ${COINEX} still report both disabled, and ${BINGX} and <a href="https://api.kucoin.com/api/v1/market/stats?symbol=XRD-USDT" ${EXT}>KuCoin</a> are still not quoting the token at all. Bitpanda, Gate.io, MEXC and CoinEx are quoting it. Of the venues that publish their deposit and withdrawal state, only Gate.io now lets a purchase move to a ${WALLET}, and its price has met MEXC's; the measurement is under <strong>${HEADING}</strong> below. Check the venue's own deposit and withdrawal status before funding anything.</p>`;

const section = `
<h3>${HEADING}</h3>
<p>Read from the same public endpoints at <strong>15:05 UTC on 17 September 2026</strong>, ${GATE} reports XRD deposits and withdrawals enabled on both its Radix chain and its Ethereum-side eXRD entry, with a minimum withdrawal of about 17 XRD. Both flags already read enabled at 14:05 UTC. Gate.io has published no notice this wiki has found, so the time it reopened is not known. ${KUCOIN} and ${COINEX} still report both disabled on their Radix chains, KuCoin's XRD/USDT market still answers with every field null, and ${BINGX}'s symbol record still carries the offTime of 1 September.</p>
<table><tbody>
<tr><th>Venue</th><th>Market</th><th>Last price</th><th>Change since 15 September</th><th>24h turnover</th></tr>
<tr><td>Bitpanda</td><td>XRD/USD</td><td>$0.00058</td><td>&minus;27.5%</td><td>no order book</td></tr>
<tr><td>Gate.io</td><td>XRD/USDT</td><td>$0.0005854</td><td>&minus;27.5%</td><td>~$28,000</td></tr>
<tr><td>MEXC</td><td>XRD/USDT</td><td>$0.0005857</td><td>+6.7%</td><td>~$64,000</td></tr>
<tr><td>CoinEx</td><td>XRD/USDT</td><td>$0.00049289</td><td>+137%</td><td>~$1,210</td></tr>
</tbody></table>
<p>Gate.io and MEXC now quote the same price to within 0.05%, against 47% two days earlier. Most of the gap closed in the hour from 10:00 UTC on 17 September. In that hour <a href="https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=XRD_USDT&amp;interval=1h&amp;limit=24" ${EXT}>Gate.io</a> turned over about $6,000, after five hours in which it had traded under $100 in total, and its price fell 8%; <a href="https://api.mexc.com/api/v3/klines?symbol=XRDUSDT&amp;interval=60m&amp;limit=24" ${EXT}>MEXC</a> rose 22%. Coins moving between the two books would produce that pattern, and until Gate.io's rails opened they could not. Bitpanda's fiat quote fell with Gate.io's. CoinEx, still closed, has more than doubled since 15 September and sits about 16% below the other two.</p>
<p>At KuCoin and CoinEx, XRD bought still stays on the venue.</p>`;

const replacements = [
  {
    from: 'on 15 September XRD deposits and withdrawals were still disabled at every venue that publishes them, and the highest of the four quotes was 3.9 times the lowest',
    to: 'on 17 September Gate.io became the first venue to reopen XRD deposits and withdrawals, and its price met MEXC&rsquo;s',
  },
  {
    from: 'Until one of the four reopens them, XRD bought there stays there.</p>',
    to: `Until one of the four reopens them, XRD bought there stays there.</p>${section}`,
  },
];

const LEAD_RE = /<p><strong>Radix mainnet restarted on 11 September 2026, and four days later no venue had reopened XRD deposits or withdrawals\.<\/strong>.*?<\/p>/s;

const message = `Sweep 448: Gate.io has reopened XRD deposits and withdrawals, the first venue to do so since the 11 September restart. Read at 15:05 UTC on 17 September, its currency record shows both enabled on the Radix chain and the eXRD entry (already enabled at 14:05 UTC; no notice found); KuCoin and CoinEx are still disabled, KuCoin's market still null, BingX's offTime unchanged. Gate.io $0.0005854 and MEXC $0.0005857 now agree to 0.05% against 47% on 15 September; most of the gap closed in the 10:00 UTC hour (Gate.io ~$6,000 turnover, -8%; MEXC +22%). CoinEx $0.00049289 (+137%), Bitpanda $0.00058. New dated section; lead and infobox updated to the reading.`;

if (new RegExp('[\\u00a0\\u2014]').test(JSON.stringify({ lead, section, replacements, message }))) throw new Error('script contains a U+00A0 or an em dash');

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

  const leadHits = textNodes(blocks).filter((n) => LEAD_RE.test(n.text));
  if (leadHits.length !== 1) throw new Error(`expected 1 lead paragraph, found ${leadHits.length}`);
  leadHits[0].text = leadHits[0].text.replace(LEAD_RE, lead);

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

  console.log(`  ${DRY ? '[dry] ' : ''}${TAG_PATH}/${SLUG}  v${page.version} -> v${VERSION}  (minor, +${JSON.stringify(blocks).length - JSON.stringify(page.content).length} chars)`);
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
