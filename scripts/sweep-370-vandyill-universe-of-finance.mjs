/**
 * Run 370 (community rotation) — /community/vandyill misses his largest active project.
 *
 * The page, last edited 18 August 2026, covers the agent-payment repositories and notes correctly
 * that they have had no commits since March. Reading github.com/quackstra on 5 September 2026
 * shows where the work went instead: universe-of-finance, created 26 March and pushed at 09:38:58
 * UTC that same morning, is an open research site measuring transaction throughput across the
 * whole financial system, and it polls five public ledgers live. One of the five is Radix.
 *
 * The reason to publish this rather than bank it is what its own data file records. Regenerated at
 * 09:38:57 UTC on 5 September, data/live/chains.json holds Radix at status "stale", last successful
 * read 2026-08-31T19:38:53Z at 0.36 tps and state version 557,815,096, with every attempt since
 * returning HTTP 500. That is an independent instrument, built by a community member for an
 * unrelated purpose, registering the halt from outside this wiki's own probes.
 */
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'community';
const SLUG = 'vandyill';
const SENTINEL = 'universe-of-finance';

const SECTION =
  '<h2>Universe of Finance</h2>'
  + '<p>His largest active project is not on that list. <a target="_blank" rel="noopener" href="https://quackstra.github.io/universe-of-finance/">Universe of Finance</a>, begun on 26 March 2026 and still being pushed to on 5 September, is an open research site with a single question behind it: how many financial transactions does the world actually process, and how fast. It ranks twenty-eight categories of payment system by throughput, card networks and interbank rails alongside public ledgers, and tags each figure with its vintage and a confidence grade. The argument lives in those tags. Every traditional category is a period-2024 annual estimate, because no live feed for one exists, while the open ledgers report themselves continuously; the site scores that gap as an opacity index rather than leaving it as a footnote.</p>'
  + '<p>Five chains are polled directly to supply the live half of the comparison: Bitcoin, Ethereum, Solana, <a rel="noopener" class="link" href="/contents/tech/core-protocols/radix-engine">Radix</a> and the XRP Ledger, each read from a keyless public endpoint. <strong>The Radix feed has been frozen since the halt.</strong> Its published data file, regenerated at 09:38:57&nbsp;UTC on 5 September 2026, carries Radix at status <code>stale</code> with its last successful reading timed 19:38:53&nbsp;UTC on 31 August, an hour and forty minutes before <a rel="noopener" class="link" href="/contents/history/hyperlane-asset-drain-2026">the network committed its last round</a>: 0.36 transactions per second at state version 557,815,096, with every attempt since returning HTTP&nbsp;500. The entry is held stale rather than rewritten to zero, which is the right call and not the automatic one. It is an outside instrument, built for an unrelated purpose, arriving at the same reading as this wiki’s own probes of the halt.</p>'
  + '<p>Three smaller sites reuse the method on subjects with no crypto content at all, which is how the method shows: <a target="_blank" rel="noopener" href="https://github.com/quackstra/universe-of-movement">Universe of Movement</a> measures the aggregate speed of the human race by transport mode, <a target="_blank" rel="noopener" href="https://quackstra.github.io/universe-of-onion/">Universe of Onion</a> does a reproducible census of the global onion trade, and both publish the same thing the finance site does, an honesty note saying which figures are anchored in measured volume and which are derived.</p>';

const DRY = process.argv.includes('--dry-run');
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  if (/\u00A0/.test(SECTION)) throw new Error('SECTION contains a literal U+00A0');
  if (/\u2014/.test(SECTION)) throw new Error('SECTION contains an em dash');

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied - no write');
    process.exit(0);
  }

  const at = blocks.findIndex((b) => b.text?.includes('data-iframe-embed'));
  if (at < 0) throw new Error('embed block not found; refusing to guess a position');
  blocks.splice(at, 0, { id: uid(), type: 'content', text: SECTION });

  const version = '6.1.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  blocks ${page.content.length} -> ${blocks.length}, new section inserted at index ${at}`);

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Adds Universe of Finance, his largest active project and absent from this page: an open research site ranking 28 payment systems by throughput, created 26 March 2026 and pushed again on 5 September. Its live data file, read the same morning, holds the Radix feed stale since 19:38:53 UTC on 31 August at 0.36 tps and state version 557,815,096, with every attempt since returning HTTP 500. Independent outside corroboration of the halt.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
