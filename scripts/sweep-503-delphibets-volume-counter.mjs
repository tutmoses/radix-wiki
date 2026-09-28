/**
 * Sweep 503: /ecosystem/delphibets re-read on 28 September 2026.
 *   - delphibets.com landing page (server-rendered): V1.5, "There are no Open bets",
 *     Total Bet Volume 7,693,931 XRD (26 Aug: 6,964,221).
 *   - Gateway stream/transactions, newest first, per component named in the site's bundle:
 *     DelphiBetsFees component_rdx1crdk98... last tx 5 Feb 2026 13:45 UTC; DelphiBetsBadgeManager
 *     component_rdx1cqu4y3... last tx 5 Feb 2026 13:35 UTC; user badge resource_rdx1n2huwg...
 *     total supply 921. No bet settled between the two readings, so the counter is recomputed
 *     rather than accumulated.
 *   - DPH read live at epoch 344,835: supply 99,999,999, minter/burner/freezer/recaller deny_all,
 *     rules locked. Unchanged since 26 Aug.
 */
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const ext = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const DASH = 'https://dashboard.radixdlt.com';
const FEES = 'component_rdx1crdk98m6pwvkr4fuzv95tgr3l2d8udq2ra2lznlapyxa455q7crulw';
const BADGES = 'component_rdx1cqu4y3t3l3h0vvvzwpuhzgegskqralvwtcasz67zv46dwg0wxmvlp7';
const DPH = 'resource_rdx1tk2ekrvckgptrtls6zp0uautg8t34nzl3h93vagt66k49vh757w5px';

const SLUG = 'delphibets';
const VERSION = '2.3.0';
const SENTINEL = '7,693,931';
const MESSAGE = 'Status re-read 28 Sep: app still v1.5 with no open bets; the fee and badge-manager components last transacted on 5 Feb 2026 (Gateway, newest first); the landing page\'s Total Bet Volume moved from 6,964,221 to 7,693,931 XRD with no bet settled in between, so the page no longer presents it as a lifetime tally. DPH re-read live at epoch 344,835, supply and locked rules unchanged.';

const CUTS = [
  ['<th>Status</th><td>', '</td>',
    '<th>Status</th><td>🟠 Dormant &ndash; app served at v1.5, no open bets, no on-ledger activity since February 2026 (28 Sep 2026)</td>'],
  ['<h2>Status as measured</h2>', 'claw it back.</p>',
    `<h2>Status as measured</h2><p>Read on <strong>28 September 2026</strong>, the app at ${ext('https://delphibets.com/', 'delphibets.com')} is served and reports itself as <strong>v1.5</strong> in the footer, but it lists no open bets, and the only route past the landing page is a wallet connection. On ledger, the protocol's ${ext(`${DASH}/component/${FEES}`, 'fee component')} and the ${ext(`${DASH}/component/${BADGES}`, 'badge manager')} that issued its 921 user badges both recorded their last transaction on 5 February 2026.</p><p>The landing page also shows a total bet volume: 6,964,221 XRD on 26 August and 7,693,931 XRD on 28 September, with no bet settled in between, so the site recomputes the figure rather than adding each bet to it.</p><p>${ext(`${DASH}/resource/${DPH}`, 'DPH')} was read on ledger on 28 September at epoch <strong>344,835</strong>: a fungible resource of divisibility 18 with a total supply of exactly <strong>99,999,999</strong>, and <code>minter</code>, <code>burner</code>, <code>freezer</code> and <code>recaller</code> all set to <code>DenyAll</code> with the rules locked. The full supply was minted at creation, and no one, the team included, can add to it, burn it or claw it back.</p>`],
];

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage('ecosystem', SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', ['ecosystem', SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));
  const leaves = [];
  const walk = (bs) => bs.forEach((b) => { if (typeof b.text === 'string') leaves.push(b); if (b.blocks) walk(b.blocks); });
  walk(blocks);
  if (leaves.some((b) => b.text.includes(SENTINEL))) { console.log('  already applied – no write'); process.exit(0); }
  for (const [start, end, replace] of CUTS) {
    const hits = leaves.filter((b) => b.text.includes(start));
    if (hits.length !== 1) throw new Error(`expected 1 block with "${start}", got ${hits.length}`);
    const b = hits[0];
    const i = b.text.indexOf(start);
    const j = b.text.indexOf(end, i + start.length);
    if (j < 0) throw new Error(`end "${end}" not found after "${start}"`);
    b.text = b.text.slice(0, i) + replace + b.text.slice(j + end.length);
  }
  const json = JSON.stringify(blocks);
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${VERSION}`);
  if (DRY) { leaves.forEach((b) => console.log('   ', b.text.slice(0, 2200), '\n')); process.exit(0); }
  const now = new Date().toISOString();
  await client.query('BEGIN');
  await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, VERSION, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, VERSION, 'minor', AUTHOR_ID, MESSAGE, now]);
  await client.query('COMMIT');
} finally {
  client.release();
  await pool.end();
}
