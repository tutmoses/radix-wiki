// Sweep 526: how-to-buy-xrd venue re-read, 3 Oct 2026.
// CaviarNine's site has been a remove-liquidity-only sunset page since 25 Sep
// (/ecosystem/caviarnine v5.5.0), so it no longer belongs in the list of DEXs to
// swap on. CoinEx's market list (api.coinex.com/v2/spot/market) carries XRDUSDT
// only; XRD/BTC is gone. KuCoin, Gate.io, CoinEx deposit/withdraw flags unchanged
// from the 24 Sep read.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'contents/resources';
const SLUG = 'how-to-buy-xrd';
const SENTINEL = 'sunset page';
const DRY = process.argv.includes('--dry-run');

const EDITS = [
  [
    'by 24 September KuCoin, Gate.io and CoinEx all let XRD be withdrawn to a Radix Wallet, and KuCoin alone also accepts deposits',
    're-read on 3 October 2026, KuCoin, Gate.io and CoinEx all let XRD be withdrawn to a Radix Wallet, and KuCoin alone also accepts deposits',
  ],
  [
    'Read on 24 September from each venue\'s own API,',
    'Read on 24 September from each venue\'s own API, and unchanged when read again on 3 October,',
  ],
  [
    '<a target="_blank" rel="noopener" href="https://www.coinex.com/en/price/xrd">CoinEx</a> – XRD/USDT and XRD/BTC',
    '<a target="_blank" rel="noopener" href="https://www.coinex.com/en/price/xrd">CoinEx</a> – XRD/USDT. Its XRD/BTC market is gone: <a href="https://api.coinex.com/v2/spot/market" target="_blank" rel="noopener">the exchange\'s market list</a> carried XRDUSDT and no other XRD pair on 3 October 2026',
  ],
  [
    '<li><a href="/ecosystem/caviarnine" rel="noopener">CaviarNine</a> – order-book and concentrated-liquidity DEX</li>\n',
    '',
  ],
  [
    '<li><a href="/ecosystem/astrolescent" rel="noopener">Astrolescent</a> – swap aggregator that routes across pools for the best price</li>\n</ul>',
    '<li><a href="/ecosystem/astrolescent" rel="noopener">Astrolescent</a> – swap aggregator that routes across pools for the best price</li>\n</ul>\n<p><a href="/ecosystem/caviarnine" rel="noopener">CaviarNine</a> is no longer one of them. Since September 2026 <a target="_blank" rel="noopener" href="https://caviarnine.io/">caviarnine.io</a> has been a sunset page that only lets liquidity providers withdraw. Its pools are still on ledger, and an aggregator can still route a trade through them, but the site no longer offers a swap.</p>',
  ],
];

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();
try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query('SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  let json = JSON.stringify(page.content);
  if (json.includes(SENTINEL)) { console.log('  already applied — no write'); process.exit(0); }
  for (const [from, to] of EDITS) {
    const f = JSON.stringify(from).slice(1, -1);
    const n = json.split(f).length - 1;
    if (n !== 1) throw new Error(`expected 1 match, got ${n}: ${from.slice(0, 80)}`);
    json = json.replace(f, () => JSON.stringify(to).slice(1, -1));
  }
  JSON.parse(json);
  const version = '1.16.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  if (!DRY) {
    const now = new Date().toISOString();
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
        'Sweep 526: CaviarNine moved out of the DEX list, since caviarnine.io has been a remove-liquidity-only sunset page since September 2026 (/ecosystem/caviarnine). CoinEx lists XRD/USDT only; its XRD/BTC market is absent from api.coinex.com/v2/spot/market on 3 Oct 2026. KuCoin, Gate.io and CoinEx deposit/withdrawal flags re-read 3 Oct, unchanged from 24 Sep.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
