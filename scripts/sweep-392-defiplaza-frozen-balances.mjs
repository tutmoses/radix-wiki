import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

// Run 392, ecosystem rotation. /ecosystem/defiplaza carried a 27 August 2026
// reading under a heading that reads as current, on a network that has not
// committed a transaction since 31 August. Adds the 9 September measurement:
// the pairs endpoint re-marks frozen balances, DefiLlama froze its whole
// protocol record on 31 August and still labels it current, and the analytics
// dashboard came back printing two different totals on one page.

const TAG_PATH = 'ecosystem';
const SLUG = 'defiplaza';
const SENTINEL = 'id="halt-reading"';
const DRY = process.argv.includes('--dry-run');

const ANCHOR = '<h2>Team</h2>';

const SECTION = [
  '<h2 id="halt-reading">Reported value during the network halt</h2>',
  '<p>Radix mainnet stopped committing transactions on 31 August 2026 at 21:19 UTC, at state version 557,840,622, and had <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">not restarted eight days later</a>. Nothing in DeFiPlaza’s Radix pools has moved in that time. The dollar figures published for those pools have, and by 9 September the two sources this page cites disagreed about them by 74%.</p>',
  '<p>Read at 03:05 UTC on 9 September 2026, DeFiPlaza’s own <a href="https://defiplaza.net/api/pairs" target="_blank" rel="noopener">pairs endpoint</a> still listed 156 pairs, now holding <strong>$110,466</strong>, with 41 pairs above $100 and 14 above $1,000, and a volume of zero on every one of them. The token balances behind that figure are the ones frozen on 31 August. The endpoint reports 7,530,679.117206777 $XRD in the base pool of its $XRD/DFP2 pair, and the <a href="https://mainnet.radixdlt.com/state/entity/details" target="_blank" rel="noopener">Radix Gateway</a>, asked for that pool pinned to state version 557,840,622, returns 7,530,679.117206777387126939. The balances are the same, so the $72,953 the endpoint has shed since 27 August is a change in the price it marks them at and nothing else.</p>',
  '<p><a href="https://api.llama.fi/protocol/defiplaza" target="_blank" rel="noopener">DefiLlama</a> handles the same problem the opposite way and does not say so. Its record for DeFiPlaza reports a current Radix value of <strong>$191,915</strong> and a current Ethereum value of <strong>$7,673</strong>, and both are the last points of series that end on 31 August 2026. The tracker stopped updating the whole protocol when the Radix ledger stopped, including the Ethereum deployment, which never stopped: DefiLlama’s records for <a href="https://api.llama.fi/protocol/uniswap" target="_blank" rel="noopener">Uniswap</a> and Aave both carried points timestamped 01:1x UTC on 9 September. On 27 August the two sources were 1.7% apart on the same pools. They are 74% apart now, one publishing a nine-day-old number as current and the other re-marking frozen balances at a $XRD price that <a href="/contents/resources/how-to-buy-xrd" rel="noopener">no longer has one value across exchanges</a>.</p>',
  '<p>DeFiPlaza’s <a href="https://stats.defiplaza.net/pools/radixplaza" target="_blank" rel="noopener">analytics dashboard</a> came back on 9 September after a week of failing, having timed out on 2 September and returned HTTP 500 on 4 and 5 September. It answers in about a second and prints two different answers on one page: $110K of total value locked in its header, $0.000 of total value locked “Today” in the chart below it, and a pairs table with no rows.</p>',
].join('');

// The 27 August paragraph opened by asserting present-tense liveness. Date it.
const OLD_OPEN = '<p>DeFiPlaza on Radix remains <a href="https://defiplaza.net" target="_blank" rel="noopener">live and operational</a>. Its <a href="https://defiplaza.net/api/pairs" target="_blank" rel="noopener">public pairs endpoint</a> listed <strong>156 pairs</strong> on 27 August 2026 holding';
const NEW_OPEN = '<p>DeFiPlaza’s Radix deployment was <a href="https://defiplaza.net" target="_blank" rel="noopener">live and operational</a> when it was last measured against a moving ledger. Its <a href="https://defiplaza.net/api/pairs" target="_blank" rel="noopener">public pairs endpoint</a> listed <strong>156 pairs</strong> on 27 August 2026 holding';

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
    console.log('  already applied - no write');
    process.exit(0);
  }

  const body = blocks.find((b) => b.type === 'content' && b.text?.includes(ANCHOR));
  if (!body) throw new Error('body block not found');
  if (!body.text.includes(OLD_OPEN)) throw new Error('status paragraph opener not found');

  body.text = body.text
    .replace(OLD_OPEN, NEW_OPEN)
    .replace(ANCHOR, SECTION + ANCHOR);

  const version = '3.3.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  block ${body.id}: ${page.content.find((b) => b.id === body.id).text.length} -> ${body.text.length} chars`);

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Add the 9 September 2026 reading. The pairs endpoint re-marks balances frozen at state version 557,840,622 and now reports $110,466 against $183,419 on 27 August, verified identical against a pinned Gateway read; DefiLlama froze its whole protocol record on 31 August and still labels it current at $191,915; the analytics dashboard recovered and prints $110K and $0.000 total value locked on one page.', now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
