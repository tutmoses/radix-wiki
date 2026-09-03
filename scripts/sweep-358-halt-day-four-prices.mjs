import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'contents/history';
const SLUG = 'hyperlane-asset-drain-2026';
const SENTINEL = 'day-four-two-prices';

const SECTION = `<h2 id="${SENTINEL}">Day four: two prices for a coin that cannot move</h2>
<p>Read at <strong>07:03:51 UTC on 3 September 2026</strong>, <a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">the Gateway status endpoint</a> returns the same ledger for a thirteenth consecutive reading: state version 557,840,622, epoch 339,896, round 102, proposer round timestamp 21:19:06.179 UTC. That is <strong>fifty-seven hours and forty-five minutes</strong> without a committed round. Three minutes later <code>/state/validators/list</code> and <code>/state/entity/details</code> both answer HTTP 500 and count the gap themselves, <q>it is currently 2 days, 9 hours, 47 minutes, 45 seconds behind</q>, with <code>current_sync_delay_seconds</code> 208,065 against a <code>max_allowed_sync_delay_seconds</code> of 720.</p>
<p>Nothing has appeared where a fix would appear. The newest <a href="https://github.com/radixdlt/babylon-node/releases" target="_blank" rel="noopener">babylon-node release</a> is still v1.3.0.5 of 1 June 2026, the head of <a href="https://github.com/radixdlt/radixdlt-scrypto" target="_blank" rel="noopener">radixdlt-scrypto</a> is still commit 858c70f1 of 27 March 2026, and <a href="https://radixdao.org/notices.json" target="_blank" rel="noopener">the DAO's notice feed</a> still ends on 29 August.</p>
<h3 id="the-two-books-come-apart">The two books come apart</h3>
<p>The exchange freeze <a href="#off-the-chain">recorded on day two</a> is unchanged at a third reading. Gate.io's native XRD chain carries <code>deposit_disabled: true</code> and <code>withdraw_disabled: true</code>; KuCoin reports <code>isDepositEnabled</code> and <code>isWithdrawEnabled</code> both false; CoinEx holds both external legs off and leaves <code>inter_transfer_enabled</code> true. What has moved is the price, and it has moved differently at each venue.</p>
<table><tbody>
<tr><td><strong>Venue</strong></td><td><strong>Last</strong></td><td><strong>24h change</strong></td><td><strong>24h range</strong></td><td><strong>24h volume</strong></td></tr>
<tr><td><a href="https://api.gateio.ws/api/v4/spot/tickers?currency_pair=XRD_USDT" target="_blank" rel="noopener">Gate.io</a></td><td>0.0006582</td><td>+0.01%</td><td>0.000658 to 0.000693</td><td>7,536,673 XRD (4,991 USDT)</td></tr>
<tr><td><a href="https://api.mexc.com/api/v3/ticker/24hr?symbol=XRDUSDT" target="_blank" rel="noopener">MEXC</a></td><td>0.0005144</td><td>-12.51%</td><td>0.0003738 to 0.0005889</td><td>116,901,175 XRD (64,020 USDT)</td></tr>
</tbody></table>
<p>MEXC's last print sits <strong>21.8% below</strong> Gate's. Two days earlier <a href="#shape-of-the-fix">the same two books</a> were within one per cent of each other, both quoting around 0.000658 after a twenty per cent fall. The gap that has opened since is not a disagreement about Radix. It is the absence of the mechanism that normally closes such a gap: arbitrage between two exchanges is a coin bought at the cheap venue and moved to the dear one, and the move is a Radix transaction, which is the one thing the ledger is refusing. Each book now prices its own trapped float against its own sellers, and the two answers no longer have to agree.</p>
<p>Gate's book has almost stopped. Its twenty-four-hour turnover fell from 114,272,110 XRD on 1 September to 7,536,673, a 93% drop, and its whole day's range is five per cent wide with the last print sitting on the low. MEXC took the selling instead, 116,901,175 XRD against 248,959,959 two days earlier, and printed a low of 0.0003738 that is 43% under Gate's last. The deeper book is the one still discovering a price; the shallower one is quoting a number at which almost nothing changed hands.</p>`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (blocks.some((b) => b.text?.includes(SENTINEL))) {
    console.log('  already applied - no write');
    process.exit(0);
  }

  const at = blocks.findIndex((b) => b.text?.includes('<h2>Where the assets went</h2>'));
  if (at === -1) throw new Error('anchor block "Where the assets went" not found');
  blocks.splice(at, 0, { id: uid(), type: 'content', text: SECTION });

  const version = '2.10.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  blocks ${page.content.length} -> ${blocks.length}  inserted at ${at}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Day four: thirteenth identical Gateway reading at 07:03:51 UTC (57h45m, sync delay 208,065s), no babylon-node release or scrypto commit or DAO notice since, and the Gate.io and MEXC XRD/USDT books have diverged 21.8% because arbitrage between them requires the transaction the halted ledger will not accept.', now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
