// sweep 486: the first May be outdated notice this wiki has shown rendered on /ecosystem/xrd-domains
// as scheduled (15:56 UTC 25 September 2026, the 181st day); a cache-busted load at 19:05 UTC
// showed it. Freshness recorded it in the future tense; this records the sighting.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'policy';
const SLUG = 'freshness';
const SENTINEL = 'rendered it at 19:05 UTC that day';

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
    console.log('  already applied – no write');
    process.exit(0);
  }

  const swap = (block, from, to) => {
    if (!block.text.includes(from)) throw new Error(`anchor not found: ${from.slice(0, 70)}`);
    block.text = block.text.replace(from, to);
  };
  const block = blocks.find((b) => b.text?.includes('<h2>How verification is recorded</h2>'));
  swap(block,
    '180 whole days old at that reading, and it shows the notice from 15:56 UTC on 25 September 2026.',
    `180 whole days old at that reading, and it began showing the notice at 15:56 UTC on 25 September 2026: a load of the page that bypassed the cache ${SENTINEL}, the first <em>May be outdated</em> notice this wiki has displayed.`);
  swap(block,
    'The first <em>May be outdated</em> notice this wiki displays will therefore appear on a page the process cannot currently clear.</p><p>So will the second.',
    'So the first notice sits on a page the process cannot currently clear.</p><p>So will the second.');

  const version = '1.8.1';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'patch', AUTHOR_ID,
        'Records the first May be outdated notice as seen: /ecosystem/xrd-domains rendered it on a cache-busted load at 19:05 UTC 25 September 2026, on schedule.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
