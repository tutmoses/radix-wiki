// sweep 485: hyperscale-vm – the lead developer's 24 September answers on how contracts
// that are not rebuilt before a migration genesis would be handled, how the migration
// would be rehearsed, and a native upgrade system planned in place of proxy patterns.
// Also refreshes the commit count and last push read from GitHub on 25 September.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'contents/tech/research';
const SLUG = 'hyperscale-vm';
const SENTINEL = 'hyperscale_rs/13028';

const NEW_PARA = `<p>Contracts whose developers do not rebuild them before that genesis <a href="https://t.me/hyperscale_rs/13028" target="_blank" rel="noopener">could be rebuilt later</a>, he said, and enabled by a vote on the beacon chain, the chain that coordinates the shards; until then their blueprints would sit disabled. The transformation would be rehearsed on <a href="https://t.me/hyperscale_rs/13029" target="_blank" rel="noopener">testnets built from mainnet dumps</a>, so that anyone could check the result before it applies. Because the engine restricts which state a call can reach, the usual proxy pattern for upgradable contracts would be awkward; he <a href="https://t.me/hyperscale_rs/13033" target="_blank" rel="noopener">plans instead</a> a native upgrade system for blueprints and components, opt-in per blueprint, with each upgrade applied at the same epoch on every shard through beacon-chain witnesses. None of this is built yet.</p>`;

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
    if (!block.text.includes(from)) throw new Error(`anchor not found: ${from.slice(0, 60)}`);
    block.text = block.text.replace(from, to);
  };

  const infobox = blocks.find((b) => b.type === 'infobox').blocks[0];
  swap(infobox, '1,218 on <code>main</code>, all by flightofthefox (read 24 September 2026)',
    '1,253 on <code>main</code>, all by flightofthefox (read 25 September 2026)');

  const rel = blocks.find((b) => b.text?.startsWith('<h2>Relationship to the Radix Engine'));
  const anchor = 'since most of a dApp\'s code is not contract code.</p>';
  swap(rel, anchor, anchor + '\n' + NEW_PARA);

  const status = blocks.find((b) => b.text?.startsWith('<h2>Status</h2>'));
  swap(status, 'All 1,218 commits on <code>main</code> to 24 September 2026 are by flightofthefox, and the last push was on 19 September.',
    'All 1,253 commits on <code>main</code> to 25 September 2026 are by flightofthefox, and the last push was on 25 September.');

  const version = '1.2.0';
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
        'Migration: contracts not rebuilt before genesis could be enabled later by beacon-chain vote; rehearsal on testnets from mainnet dumps; native opt-in upgrade system planned instead of proxies (t.me/hyperscale_rs 13028, 13029, 13033, 24 Sep). Commit count and last push refreshed from GitHub, 25 Sep.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
