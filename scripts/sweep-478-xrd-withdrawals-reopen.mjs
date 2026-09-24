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
const EXPECT = '1.14.0';
const VERSION = '1.15.0';
const HEADING = 'Thirteen days after the restart, three venues let XRD out';
const PREV_HEADING = '<h3>Six days after the restart, Gate.io reopens XRD deposits and withdrawals</h3>';
const EXT = 'target="_blank" rel="noopener"';
const GATE = `<a href="https://api.gateio.ws/api/v4/spot/currencies/XRD" ${EXT}>Gate.io</a>`;
const KUCOIN = `<a href="https://api.kucoin.com/api/v3/currencies/XRD" ${EXT}>KuCoin</a>`;
const COINEX = `<a href="https://api.coinex.com/v2/assets/deposit-withdraw-config?ccy=XRD" ${EXT}>CoinEx</a>`;
const BINGX = `<a href="https://open-api.bingx.com/openApi/spot/v1/common/symbols?symbol=XRD-USDT" ${EXT}>BingX</a>`;
const KUCOIN_CANDLES = `<a href="https://api.kucoin.com/api/v1/market/candles?type=1hour&amp;symbol=XRD-USDT&amp;startAt=1789718400&amp;endAt=1789760000" ${EXT}>reopened with a call auction</a>`;
const MEXC = `<a href="https://api.mexc.com/api/v3/ticker/24hr?symbol=XRDUSDT" ${EXT}>MEXC</a>`;
const WALLET = '<a href="/contents/tech/core-protocols/radix-wallet" rel="noopener">Radix Wallet</a>';

const lead = `<p><strong>Radix mainnet restarted on 11 September 2026, and by 24 September three exchanges let XRD be withdrawn to a Radix Wallet.</strong> Read on 24 September from each venue's own API, ${KUCOIN} reports XRD deposits and withdrawals both enabled, while ${GATE} and ${COINEX} report withdrawals enabled and deposits disabled. KuCoin's market came back on 18 September; ${BINGX} is still not quoting the token. Bitpanda, CoinEx, Gate.io, KuCoin and MEXC are quoting it, but not at one price; the measurement is under <strong>${HEADING}</strong> below. Check the venue's own deposit and withdrawal status before funding anything.</p>`;

const section = `
<h3>${HEADING}</h3>
<p>Read from the same public endpoints at <strong>11:05 UTC on 24 September 2026</strong>, ${KUCOIN} reports XRD deposits and withdrawals enabled on the Radix chain, with a minimum withdrawal of 3,000 XRD and a fee of 1,500 XRD. Since the 17 September reading, ${GATE} has closed deposits on both its Radix chain and its Ethereum-side eXRD entry and kept withdrawals open, and ${COINEX} has opened withdrawals with deposits still closed. KuCoin's XRD/USDT market ${KUCOIN_CANDLES} on the morning of 18 September and has traded every hour since 09:00 UTC that day. BingX's symbol record still carries the 1 September <code>offTime</code>, and its ticker answers "symbol is not found".</p>
<table><tbody>
<tr><th>Venue</th><th>Market</th><th>Last price</th><th>Deposits</th><th>Withdrawals</th><th>24h turnover</th></tr>
<tr><td>Bitpanda</td><td>XRD/USD</td><td>$0.00056</td><td>n/a</td><td>n/a</td><td>no order book</td></tr>
<tr><td>Gate.io</td><td>XRD/USDT</td><td>$0.0005489</td><td>closed</td><td>open</td><td>~$5,700</td></tr>
<tr><td>KuCoin</td><td>XRD/USDT</td><td>$0.0004746</td><td>open</td><td>open</td><td>~$16,000</td></tr>
<tr><td>${MEXC}</td><td>XRD/USDT</td><td>$0.0004764</td><td>not published</td><td>not published</td><td>~$61,000</td></tr>
<tr><td>CoinEx</td><td>XRD/USDT</td><td>$0.00047461</td><td>closed</td><td>open</td><td>~$470</td></tr>
</tbody></table>
<p>KuCoin, MEXC and CoinEx quote within 0.4% of each other. Gate.io's last trade sits 16% above them and Bitpanda's US dollar quote 18% above. With Gate.io's deposits closed, nobody can move XRD onto the venue to sell into its higher price, so a buyer there pays the difference. On 17 September Gate.io and MEXC had met at about $0.000585; MEXC has since fallen 19% and Gate.io 6%.</p>
<p>A purchase at KuCoin, Gate.io or CoinEx can now move to a ${WALLET}. MEXC's currency-status endpoints refuse automated requests, so this page cannot say whether XRD bought there can leave.</p>
`;

const replacements = [
  {
    from: 'on 17 September Gate.io became the first venue to reopen XRD deposits and withdrawals, and its price met MEXC&rsquo;s',
    to: 'by 24 September KuCoin, Gate.io and CoinEx all let XRD be withdrawn to a Radix Wallet, and KuCoin alone also accepts deposits',
  },
  {
    from: 'XRD/USDT, <strong>not quoting when read on 3 September 2026</strong>, with the pair absent from the exchange\'s symbol registry and the XRD currency still listed',
    to: 'XRD/USDT, back since a call auction on the morning of 18 September 2026, after it stopped quoting during the halt',
  },
  {
    from: PREV_HEADING,
    to: `${section.trim()}\n${PREV_HEADING}`,
  },
];

const LEAD_RE = /<p><strong>Radix mainnet restarted on 11 September 2026, and on 17 September Gate\.io became the first venue to reopen XRD deposits and withdrawals\.<\/strong>.*?<\/p>/s;

const message = 'Sweep 478: the 24 September re-read of every venue\'s XRD deposit and withdrawal state, at 11:05 UTC from each exchange\'s own API. KuCoin now reports deposits and withdrawals enabled (3,000 XRD minimum withdrawal, 1,500 XRD fee) and its XRD/USDT market has traded every hour since 09:00 UTC on 18 September after a call auction; Gate.io has closed deposits on both chains and kept withdrawals open; CoinEx has opened withdrawals with deposits closed; BingX still answers "symbol is not found". Gate.io last $0.0005489, 16% over KuCoin $0.0004746, MEXC $0.0004764 and CoinEx $0.00047461; Bitpanda $0.00056. Infobox, the centralized-exchange lead and the KuCoin list entry rewritten; new dated section above the 17 September one.';

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
  await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, VERSION, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, VERSION, 'minor', AUTHOR_ID, message, now]);
  await client.query('COMMIT');
} finally {
  client.release();
  await pool.end();
}
