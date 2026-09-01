// sweep-346 — the network halt read from outside the ledger: the Gateway's own
// refusal threshold, the exchange deposit/withdrawal switches, and the split
// between front ends served from a file and pages that need current state.
// All figures read 1 September 2026, times UTC.
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/history';
const SLUG = 'hyperlane-asset-drain-2026';
const SENTINEL = 'off-the-chain';
const DRY = process.argv.includes('--dry-run');

const OLD_ROW = 'Still halted when re-read at 03:09 UTC, 1 September';
const NEW_ROW = 'Still halted when re-read at 07:02 UTC, 1 September, nine hours and forty-three minutes after the last round';

const SECTION = `<h2 id="${SENTINEL}">What the halt does off the chain</h2>
<p>Re-read at <strong>07:02:30 UTC on 1 September 2026</strong>, the <a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">Gateway status endpoint</a> still returns the ledger it returned at the halt &mdash; state version 557,840,622, epoch 339,896, round 102, proposer round timestamp 21:19:06.179 UTC &mdash; nine hours and forty-three minutes after the last committed round. Four minutes later a read of <code>/state/entity/details</code> for XRD itself answered <strong>HTTP 500</strong>, and the error names the threshold: <code>current_sync_delay_seconds</code> 35,084 against <code>max_allowed_sync_delay_seconds</code> <strong>720</strong>. The Gateway refuses to serve state it believes is more than twelve minutes stale, and it is nine hours and forty-four minutes behind, so every application that asks it a question about the present gets an error rather than an old answer. That is a deliberate design choice showing its value on the one day it matters.</p>
<h3>The exchanges</h3>
<p>The clearest external measure is at the venues, where the halt has been translated into a switch. Read at <strong>07:09 UTC on 1 September</strong> from each exchange's own public API, native XRD cannot move on or off the chain at the three live venues that answer without a key:</p>
<table><tbody>
<tr><th>Venue</th><th>Endpoint read</th><th>Native XRD chain</th></tr>
<tr><td>Gate.io</td><td><a href="https://api.gateio.ws/api/v4/spot/currencies/XRD" target="_blank" rel="noopener"><code>spot/currencies/XRD</code></a></td><td><code>deposit_disabled: true</code>, <code>withdraw_disabled: true</code></td></tr>
<tr><td>KuCoin</td><td><a href="https://api.kucoin.com/api/v3/currencies/XRD" target="_blank" rel="noopener"><code>v3/currencies/XRD</code></a></td><td><code>isDepositEnabled: false</code>, <code>isWithdrawEnabled: false</code></td></tr>
<tr><td>CoinEx</td><td><a href="https://api.coinex.com/v2/assets/deposit-withdraw-config?ccy=XRD" target="_blank" rel="noopener"><code>deposit-withdraw-config</code></a></td><td><code>deposit_enabled: false</code>, <code>withdraw_enabled: false</code></td></tr>
</tbody></table>
<p>The markets themselves stay open. Gate.io reports <code>trade_disabled: false</code> at the currency level and its <a href="https://api.gateio.ws/api/v4/spot/tickers?currency_pair=XRD_USDT" target="_blank" rel="noopener">XRD/USDT ticker</a> was quoting 0.0006697 USDT on 98,929,511 XRD of 24-hour volume, down <strong>17.3%</strong> over the day; KuCoin's XRD-USDT book was live at 0.000666. So XRD keeps a price, and a falling one, at venues from which it cannot be withdrawn to a wallet or deposited from one. What a holder can still do is sell the balance an exchange already custodies; what nobody can do is move the token itself, because the ledger that records the move has stopped. CoinEx makes the shape explicit in one field, leaving <code>inter_transfer_enabled: true</code> while both external legs are off: transfers inside the exchange, nothing across its edge.</p>
<p>One row is worth reading carefully. Gate.io lists XRD on two chains, and the second is <a href="https://etherscan.io/token/0x6468e79a80c0eab0f9a2b574c8d5bc374af59414" target="_blank" rel="noopener">eXRD</a>, the ERC-20 that carried Radix on Ethereum before the Babylon network existed. Its withdrawals read <code>withdraw_disabled: false</code> while the native chain's are off &mdash; the predecessor still moves, because it settles on a chain that has not stopped. No exchange has published a dated notice that this page can cite tying any of these switches to the halt; the values above are the exchanges' own APIs, recorded with the hour they were read.</p>
<h3>The applications</h3>
<p>On Radix itself the outage divides applications by where their content comes from rather than by who runs them. Front ends built as static bundles keep serving: <a href="/ecosystem/ociswap" rel="noopener">Ociswap</a>, <a href="/ecosystem/astrolescent" rel="noopener">Astrolescent</a>, <a href="/ecosystem/weft-finance" rel="noopener">Weft</a>, <a href="/ecosystem/reddicks" rel="noopener">RSwap</a>, Surge, RadQuest and the <a href="https://dashboard.radixdlt.com" target="_blank" rel="noopener">Radix Dashboard</a> all answered 200 on the same pass. Pages that have to resolve current state do not: Astrolescent's per-token page returned HTTP 500 through its own error boundary, and <a href="https://stats.defiplaza.net" target="_blank" rel="noopener">stats.defiplaza.net</a> returned a bare <em>Application Error</em>. In between sit the cached read APIs, which answer normally and answer with the pre-halt ledger &mdash; <a href="https://api.ociswap.com/tokens" target="_blank" rel="noopener">Ociswap's token endpoint</a> and <a href="https://api.astrolescent.com/prices" target="_blank" rel="noopener">Astrolescent's price feed</a> both served full payloads. Neither payload says how old the ledger under it is, so a reader cannot tell from either that nothing has settled since 21:19 the previous evening. The Gateway, which does carry that information, is the only one of the three that declines to answer.</p>`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  if ([...SECTION, ...OLD_ROW].some((ch) => ch.charCodeAt(0) === 0xa0)) throw new Error('U+00A0 in script strings');

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  // 1. infobox network-status row
  const ib = blocks[0];
  if (ib.type !== 'infobox') throw new Error('block 0 is not the infobox');
  let rowHit = 0;
  for (const nb of ib.blocks) {
    if (nb.text && nb.text.includes(OLD_ROW)) { nb.text = nb.text.replace(OLD_ROW, NEW_ROW); rowHit++; }
  }
  if (rowHit !== 1) throw new Error(`network-status row replace hit ${rowHit} times`);

  // 2. new section immediately after "The outage"
  const at = blocks.findIndex((b) => b.text && b.text.includes('id="the-outage"'));
  if (at < 0) throw new Error('outage block not found');
  blocks.splice(at + 1, 0, { id: uid(), type: 'content', text: SECTION });

  const version = '2.2.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  (${page.content.length} -> ${blocks.length} blocks)`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'The halt read from outside the ledger: the Gateway refuses reads past a 720-second sync tolerance while 35,084 seconds behind; Gate.io, KuCoin and CoinEx have disabled native-XRD deposits and withdrawals while their books keep quoting; static front ends and cached APIs still serve pre-halt state. All figures read 1 September 2026.', now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
