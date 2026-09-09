import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

// Run 392. The operational-status page's front-end census was last re-run at
// ninety-seven hours and its node-software line stops at v1.3.0.5, which a
// release candidate on 8 September has since moved. Appends the day-nine
// reading and the census re-run at 198 hours.

const TAG_PATH = 'contents/resources';
const SLUG = 'radix-ecosystem-operational-status';
const BLOCK_ID = '283f5a75-ba22-4f58-8c5a-000d685ceba7';
const SENTINEL = 'id="halt-day-nine"';
const DRY = process.argv.includes('--dry-run');

const PARAS = [
  '<p id="halt-day-nine">Read at <strong>03:10 UTC on 9 September 2026</strong>, the Gateway returns the ledger it has returned since the stop, state version 557,840,622 at epoch 339,896, round 102, one hundred and ninety-seven hours and fifty-one minutes without a committed round; <code>/state/validators/list</code> answers HTTP 500 and now says so in words, reporting itself "8 days, 5 hours, 51 minutes behind" at a sync delay of <strong>712,260 seconds</strong> against the 720 it tolerates. <a href="/contents/tech/releases/stokenet" rel="noopener">Stokenet</a> is advancing normally at epoch 3,352.</p>',
  '<p><strong>The node software exists now, and it is flagged a pre-release.</strong> The paragraph above is superseded: at 15:35 UTC on 8 September babylon-node published <a href="https://github.com/radixdlt/babylon-node/releases/tag/v1.4.0.0-RC1" target="_blank" rel="noopener">v1.4.0.0-RC1</a>, its first release since 1 June 2026 and the build that carries Eagle Ray. Because it is marked a pre-release, GitHub’s <code>/releases/latest</code> still resolves to v1.3.0.5-test.1, an empty tag cut by a bot three hours earlier, and so does <code>ghproxy.radixdlt.com</code>, which is what the <a href="/developers/infrastructure/01-running-a-node" rel="noopener">babylonnode installer reads</a>. Both were re-checked at 03:04 UTC on 9 September and both still return the test tag.</p>',
  '<p><strong>The front-end census, re-run at one hundred and ninety-eight hours.</strong> Every row is unchanged from the ninety-seven-hour reading except one, and the change is a recovery rather than a failure: <code>stats.defiplaza.net/pools/radixplaza</code> answers HTTP 200 in about a second, where it returned HTTP 500 after twenty seconds on 4 and 5 September and timed out on 2 September. What it serves is the reason this page exists. The dashboard prints $110K of total value locked in its header and $0.000 of total value locked "Today" in the chart below it, over a pairs table with no rows, and <a href="/ecosystem/defiplaza#halt-reading" rel="noopener">the two trackers covering those pools now disagree about them by 74%</a>. Astrolescent’s per-token page still returns HTTP 500 and <code>app.caviarnine.com</code> still refuses the connection, which is <a href="/ecosystem/caviarnine" rel="noopener">CaviarNine’s own wind-down</a>. The other ten shells still answer 200, and still resolve nothing.</p>',
].join('');

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

  const body = blocks.find((b) => b.id === BLOCK_ID);
  if (!body) throw new Error('log block not found');
  const before = body.text.length;
  body.text = body.text + PARAS;

  const version = '1.13.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  block ${BLOCK_ID}: ${before} -> ${body.text.length} chars`);

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
       'Day nine of the halt: Gateway reading at 197h51m, the node release candidate that supersedes the v1.3.0.5 line above, and the front-end census re-run at 198 hours, whose one change is the DeFiPlaza analytics dashboard recovering to serve two different totals on one page.', now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
