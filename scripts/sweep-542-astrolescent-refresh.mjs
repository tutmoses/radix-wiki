// Sweep 542: /ecosystem/astrolescent was the ecosystem staleness head (last touched 4 Sep). Its price line
// dated from 26 July, and its funding section still described the network halt in the present tense, a
// month after the 11 September restart. Re-read 6 Oct 2026: $ASTRL 7.41 XRD on Astrolescent's own price
// feed, 18.77m of 36m circulating; total supply 36,000,000 on the Gateway. Also links /ecosystem/hydraswap,
// an orphan since the 1 Oct status-index deletion, from the aggregator it is built on.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'ecosystem';
const SLUG = 'astrolescent';
const SENTINEL = 'href="/ecosystem/hydraswap"';
const DRY = process.argv.includes('--dry-run');

const REPLACE = [
  ['As of 26 July 2026, $ASTRL traded at approximately <strong>7.66 <a href="/contents/tech/core-protocols/xrd-token" rel="noopener">XRD</a></strong> (~$0.0079) per token. <em>Ledger facts verified via the Radix Gateway on 26 July 2026; market figures move continuously.</em>',
    'As of 6 October 2026, $ASTRL traded at approximately <strong>7.41 <a href="/contents/tech/core-protocols/xrd-token" rel="noopener">XRD</a></strong> per token on Astrolescent&#39;s own price feed, which counts about 18.8 million of the 36 million as circulating. <em>Ledger facts verified via the Radix Gateway on 6 October 2026; market figures move continuously.</em>'],
  ['Astrolescent\'s own price feed has been serving the last quotes the pools produced before the stop.',
    'The network <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">restarted on 11 September 2026</a>, and when re-read on 6 October Astrolescent&#39;s swap front end and price feed were quoting live prices again.'],
  ['routing and splitting swaps across Radix DEXes for optimal execution.</li>',
    'routing and splitting swaps across Radix DEXes for optimal execution. Third-party front ends such as <a href="/ecosystem/hydraswap" rel="noopener">HydraSwap</a> route their trades through its API.</li>'],
];

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query('SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));
  if (blocks.some((b) => b.text?.includes(SENTINEL))) {
    console.log('  already applied — no write');
    process.exit(0);
  }
  for (const [from, to] of REPLACE) {
    const block = blocks.find((b) => b.type === 'content' && b.text.includes(from));
    if (!block) throw new Error(`no match: ${from.slice(0, 60)}`);
    block.text = block.text.replace(from, to);
  }
  const version = '3.4.0';
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
        'Sweep 542: $ASTRL price re-read 6 Oct 2026 (7.41 XRD on Astrolescent\'s feed, ~18.8m of 36m circulating; supply 36,000,000 on the Gateway), replacing the 26 July figure. Funding section no longer describes the halt in the present tense: the network restarted 11 Sep and the front end quotes live. Aggregator entry links HydraSwap, which routes through the Astrolescent API.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
