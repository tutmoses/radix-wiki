// Sweep 476: Surge's margin pool has committed nothing since 27 August 2026.
// Read on 24 September 2026 (epoch 343,539): the MarginPool component
// component_rdx1crezrp...ltrc9g lists its newest transaction at 20:57 UTC on
// 27 August, before the network halt of 31 August, and its sUSD vault holds
// 32,547.79. No closing date found on surge.trade or in search.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ecosystem';
const SLUG = 'surge';
const SENTINEL = 'since 27 August 2026';

const REPLACE = [
  [
    '<td>🟢 Live — unwinding in stages, announced 19 August 2026</td>',
    '<td>🟠 Idle – no pool transaction since 27 August 2026; unwind announced 19 August 2026</td>',
  ],
  [
    '<td><strong>Pool (Aug 2026)</strong></td><td>33,245.53 sUSD held; net ≈ $24.3K – read on-ledger 11 Aug 2026</td>',
    '<td><strong>Pool (Sep 2026)</strong></td><td>32,548 sUSD held – read on-ledger 24 Sep 2026</td>',
  ],
  [
    'was still committing keeper transactions.</p>',
    'was still committing keeper transactions.</p>\n<p>That traffic has since stopped. Read on 24 September 2026, the pool component had committed no transaction since 27 August 2026, four days before the <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">network halt</a> at the end of that month, and none in the two weeks after mainnet restarted on 11 September. Its vault held 32,548 sUSD, about 700 fewer than on 11 August. No closing date for open positions had been announced.</p>',
  ],
];

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content, metadata FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied, no write');
    process.exit(0);
  }
  const walk = (bs, from, to) => {
    let n = 0;
    for (const b of bs) {
      if (typeof b.text === 'string' && b.text.includes(from)) { b.text = b.text.split(from).join(to); n++; }
      if (Array.isArray(b.blocks)) n += walk(b.blocks, from, to);
    }
    return n;
  };
  for (const [from, to] of REPLACE) {
    const n = walk(blocks, from, to);
    if (n !== 1) throw new Error(`expected 1 match, got ${n} for "${from.slice(0, 60)}"`);
  }
  const metadata = { ...page.metadata, status: '🟠 Dormant' };

  const version = '2.5.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, metadata=$2, version=$3, updated_at=$4 WHERE id=$5',
      [json, JSON.stringify(metadata), version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
        'Surge pool idle since 27 August 2026 (on-ledger read, 24 September): status to Dormant, pool figure refreshed, no closing date announced yet.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
