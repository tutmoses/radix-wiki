import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

// Run 457: the poisoned 12 September datapoint has left Ociswap's seven-day window.
// Past-tense the 15 September reading and add the clean 19 September one.
const TAG_PATH = 'ecosystem';
const SLUG = 'ociswap';
const BLOCK_ID = 'abc0c3f2-6207-42d4-ac7d-4a718664e74c';
const SENTINEL = '19:04 UTC on 19 September 2026';

const REPLACEMENTS = [
  ['The reported seven-day volume is about three trillion times what the pool traded in the same period.',
   'The seven-day volume reported on 15 September was about three trillion times what the pool traded in the same period.'],
  ['The one-hour and twenty-four-hour windows on the same endpoint are unaffected. The all-time total is not:',
   'The one-hour and twenty-four-hour windows on the same endpoint were unaffected. The all-time total was not:'],
];
const APPEND = '<p>The seven-day window has since moved past 12 September. Read again at 19:04 UTC on 19 September 2026, <a href="https://api.ociswap.com/statistics" target="_blank" rel="noopener">the endpoint</a> gave a seven-day volume of 9,194,469 XRD across 3,755 swaps, of which <a href="https://api.ociswap.com/pools/component_rdx1czgtqmx9hatgtvuzep0ds8vkjc22agmlxuvpdzpecj7mcawvvjts4m" target="_blank" rel="noopener">the XRD/BONK pool</a> was credited 134 XRD, and <a href="https://defillama.com/protocol/ociswap" target="_blank" rel="noopener">DefiLlama</a> gave 5,207 USD over the same seven days. The all-time figure does not roll off. It stood at 48,587,050,626,683,404 XRD on the same read, and still carries the pool\'s 11,069,975,987,354,485 XRD of lifetime volume.</p>';

const DRY = process.argv.includes('--dry-run');
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
  const block = blocks.find((b) => b.id === BLOCK_ID);
  if (!block) throw new Error('block not found');
  if (block.text.includes(SENTINEL)) {
    console.log('  already applied — no write');
    process.exit(0);
  }
  for (const [from, to] of REPLACEMENTS) {
    if (!block.text.includes(from)) throw new Error(`missing: ${from.slice(0, 60)}`);
    block.text = block.text.replace(from, to);
  }
  block.text += APPEND;

  const version = '3.3.0';
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
       'The 12 September datapoint that inflated Ociswap\'s seven-day volume has left the window. Re-read api.ociswap.com/statistics at 19:04 UTC on 19 September 2026: 9,194,469 XRD over seven days across 3,755 swaps, 134 XRD of it on the XRD/BONK pool; DefiLlama 5,207 USD over seven days. The 15 September reading is now past tense; the all-time total, 48,587,050,626,683,404 XRD, still carries the pool\'s 11.07 quadrillion and stays as written.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
