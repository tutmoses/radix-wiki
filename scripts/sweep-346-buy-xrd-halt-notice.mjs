// sweep-346 — a reader arriving at "how to buy XRD" during the network halt needs
// to know that the token cannot be moved on or off the chain, whatever the
// exchange page says. Values read from each venue's own API, 07:09 UTC 1 Sep 2026.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/resources';
const SLUG = 'how-to-buy-xrd';
const SENTINEL = 'deposits and withdrawals are switched off';
const DRY = process.argv.includes('--dry-run');

const ANCHOR = '<h2><strong>Centralized exchanges</strong></h2>\n';
const NOTICE = `<p><strong>As of 1 September 2026, deposits and withdrawals are switched off.</strong> Radix mainnet has been <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">halted since 21:19 UTC on 31 August 2026</a> and no transaction has settled since. Read at 07:09 UTC on 1 September from each venue's own API, native XRD deposits and withdrawals are disabled at <a href="https://api.gateio.ws/api/v4/spot/currencies/XRD" target="_blank" rel="noopener">Gate.io</a>, <a href="https://api.kucoin.com/api/v3/currencies/XRD" target="_blank" rel="noopener">KuCoin</a> and <a href="https://api.coinex.com/v2/assets/deposit-withdraw-config?ccy=XRD" target="_blank" rel="noopener">CoinEx</a>. The spot books below are still quoting and still trading, so XRD can be bought and sold on an exchange that already holds it &mdash; but until the network restarts it cannot be sent to a Radix wallet, and coins in a wallet cannot be sent to an exchange. Check the venue's own deposit and withdrawal status before funding anything.</p>\n`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  if ([...NOTICE, ...ANCHOR].some((ch) => ch.charCodeAt(0) === 0xa0)) throw new Error('U+00A0 in script strings');

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  let hit = 0;
  for (const b of blocks) {
    if (b.text && b.text.startsWith(ANCHOR)) { b.text = ANCHOR + NOTICE + b.text.slice(ANCHOR.length); hit++; }
  }
  if (hit !== 1) throw new Error(`anchor hit ${hit} times`);

  const version = '1.9.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Halt notice at the head of the exchange list: native XRD deposits and withdrawals disabled at Gate.io, KuCoin and CoinEx while the spot books keep trading, read from each venue API at 07:09 UTC on 1 September 2026.', now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
