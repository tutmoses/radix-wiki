/**
 * sweep 411 — contents/resources rotation.
 *
 * Radix mainnet restarted at 11:35:28.96 UTC on 11 September 2026 after a
 * 254-hour halt, which falsified three standing claims on How to Buy $XRD:
 * the infobox said the network was halted, the centralized-exchange lead said
 * coins could not move "until the network restarts", and the 3 September
 * section's last live route (Gate.io's Ethereum-side eXRD entry) has since
 * closed too. Read at 19:04 UTC on 11 September, seven and a half hours after
 * the restart, every venue that publishes its state still has XRD deposits and
 * withdrawals disabled, and the four surviving quotes still differ by 43%.
 *
 * Adds the post-restart measurement as a new dated section, rewrites the two
 * standing claims, and leaves the dated history intact.
 */
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/resources';
const SLUG = 'how-to-buy-xrd';
const SENTINEL = 'The ledger restarted and the books did not';
const DRY = process.argv.includes('--dry-run');

const INFOBOX_OLD =
  '<tr><td><strong>Network status</strong></td><td>Mainnet <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">halted since 31 August 2026</a>; native XRD deposits and withdrawals disabled at every venue checked; the four surviving quotes differ by 60%</td></tr>';
const INFOBOX_NEW =
  '<tr><td><strong>Network status</strong></td><td>Mainnet <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">restarted at 11:35 UTC on 11 September 2026</a> after 254 hours; XRD deposits and withdrawals still disabled at every venue that publishes them, eight hours later; the four surviving quotes differ by 43%</td></tr>';

const LEAD_OLD_START = '<p><strong>As of 3 September 2026, two of the six books have stopped quoting';
const LEAD_NEW = `<p><strong>Radix mainnet restarted at 11:35:28 UTC on 11 September 2026, and eight hours later no venue had reopened XRD deposits or withdrawals.</strong> Two of the six books stopped quoting during the <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">254-hour halt</a> and have not come back. Read at 19:04 UTC on 11 September from each venue's own API, native XRD deposits and withdrawals are disabled at <a href="https://api.gateio.ws/api/v4/spot/currencies/XRD" target="_blank" rel="noopener">Gate.io</a>, <a href="https://api.kucoin.com/api/v3/currencies/XRD" target="_blank" rel="noopener">KuCoin</a> and <a href="https://api.coinex.com/v2/assets/deposit-withdraw-config?ccy=XRD" target="_blank" rel="noopener">CoinEx</a>, and <a href="https://open-api.bingx.com/openApi/spot/v1/common/symbols?symbol=XRD-USDT" target="_blank" rel="noopener">BingX</a> and <a href="https://api.kucoin.com/api/v1/market/stats?symbol=XRD-USDT" target="_blank" rel="noopener">KuCoin</a> are still not quoting the token at all. Bitpanda, Gate.io, MEXC and CoinEx are, so XRD can be bought and sold on a venue that already holds it, but until a venue reopens its own Radix wallet a purchase cannot be moved to a <a href="/contents/tech/core-protocols/radix-wallet" rel="noopener">Radix Wallet</a> and coins in a wallet cannot be sent to a venue. The four surviving quotes disagree by 43%; the measurement is under <strong>${SENTINEL}</strong> below. Check the venue's own deposit and withdrawal status before funding anything.</p>`;

const NEW_SECTION = `
<h3>${SENTINEL}</h3>
<p>Radix mainnet committed a round again at <strong>11:35:28.96 UTC on 11 September 2026</strong>, ending a halt of 254 hours and 16 minutes. The question this page has asked at every reading &ndash; can the coins leave? &ndash; does not follow from the network being up. Read from the same public endpoints at <strong>19:04 UTC on 11 September</strong>, seven and a half hours after the restart, with the <a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">Gateway</a> reporting epoch 339,987 at state version 557,860,350 against the 557,840,628 that ended the halt:</p>
<table><tbody>
<tr><th>Venue</th><th>Market</th><th>Last price</th><th>24h turnover</th><th>XRD deposits</th><th>XRD withdrawals</th></tr>
<tr><td>Bitpanda</td><td>XRD/USD</td><td>$0.00068</td><td>no order book</td><td>not published</td><td>not published</td></tr>
<tr><td>Gate.io</td><td>XRD/USDT</td><td>$0.0006884</td><td>~$3,740</td><td>disabled</td><td>disabled</td></tr>
<tr><td>CoinEx</td><td>XRD/USDT</td><td>$0.00048965</td><td>~$4,670</td><td>disabled</td><td>disabled</td></tr>
<tr><td>MEXC</td><td>XRD/USDT</td><td>$0.0004826</td><td>~$61,980</td><td>not published</td><td>not published</td></tr>
</tbody></table>
<p>Gate.io quotes <strong>42.6% above MEXC</strong> and 40.6% above CoinEx, against the 59.8% this page measured on 8 September. The gap narrowed from the bottom: in the three and a half days between the two readings MEXC rose 12.6% and CoinEx 14.1% while Gate.io moved 0.5%. That is what a discount does when the thing pinning it looks likely to lift. It has not lifted. Gate.io's currency record carries <code>withdraw_disabled</code> and <code>deposit_disabled</code> true on <em>both</em> of its chains &ndash; the Radix one and the Ethereum-side eXRD entry that was the single route still open on 3 September. CoinEx reports the same pair false on its only XRD chain, and KuCoin's Radix chain entry carries <code>isWithdrawEnabled</code> and <code>isDepositEnabled</code> false while its XRD/USDT market still answers with every field null.</p>
<p>Two things follow, and both outlive this reading. An exchange reopens deposits and withdrawals on its own schedule after a halt rather than when the ledger says it can, so the instruction this page has carried since 22 August is the one that survived every stage of the episode: <strong>confirm XRD withdrawals are enabled before you buy, not after</strong>. And the four prices above are still not one price. Arbitrage between two XRD books is a withdrawal from one and a deposit at the other, and both legs remain closed at every venue that publishes their state.</p>`;

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
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  // 1. infobox network-status row
  const infobox = blocks.find((b) => b.type === 'infobox');
  const facts = infobox?.blocks?.[0];
  if (!facts || !facts.text.includes(INFOBOX_OLD)) throw new Error('infobox status row not matched');
  facts.text = facts.text.replace(INFOBOX_OLD, INFOBOX_NEW);

  // 2. centralized-exchanges lead paragraph
  const ex = blocks.find((b) => b.type === 'content' && b.text.includes('<h2><strong>Centralized exchanges</strong></h2>'));
  if (!ex) throw new Error('centralized-exchanges block not found');
  const start = ex.text.indexOf(LEAD_OLD_START);
  if (start < 0) throw new Error('lead paragraph not matched');
  const end = ex.text.indexOf('</p>', start) + 4;
  ex.text = ex.text.slice(0, start) + LEAD_NEW + ex.text.slice(end);

  // 3. append the post-restart measurement to the liquidity block
  const liq = blocks.find((b) => b.type === 'content' && b.text.includes('<h2><strong>How much liquidity is actually there</strong></h2>'));
  if (!liq) throw new Error('liquidity block not found');
  liq.text = liq.text.trimEnd() + NEW_SECTION;

  const version = '1.12.0';
  const now = new Date().toISOString();
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  infobox row: ${facts.text.includes(INFOBOX_NEW) ? 'ok' : 'FAILED'}`);
  console.log(`  lead paragraph: ${ex.text.includes('no venue had reopened XRD deposits') ? 'ok' : 'FAILED'}`);
  console.log(`  new section: ${liq.text.includes(SENTINEL) ? 'ok' : 'FAILED'}  (+${liq.text.length - page.content.find((b) => b.id === liq.id).text.length} chars)`);

  if (!DRY) {
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query(
      'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Mainnet restarted 11:35:28.96 UTC on 11 Sep 2026; read at 19:04 UTC every venue that publishes deposit/withdrawal state still has XRD closed, including the Gate.io eXRD route that was open on 3 Sep, and Gate.io still quotes 42.6% over MEXC. Infobox and the centralized-exchange lead corrected off the halt.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
