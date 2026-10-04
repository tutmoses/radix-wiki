/**
 * Sweep 535: the Foundation-instance sentence on /ideas/dao-governance-app-consultation-v2
 * still said proposal 3 "closes on 4 October". It closed at 15:32 UTC that day with
 * 95% for reimbursing the original hUSDC holders (component_rdx1czn9hr... proposals KVS
 * key 3, 83 ballots; recorded on hyperlane-asset-drain-2026#gp3-result by
 * sweep-535-gp3-result.mjs).
 */
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ideas';
const SLUG = 'dao-governance-app-consultation-v2';
const SENTINEL = '#gp3-result';

const FIND = 'which <a href="/contents/history/hyperlane-asset-drain-2026#gp3-quorum" rel="noopener">passed quorum on 1 October</a> and closes on 4 October. For a week the two instances have been running';
const REPLACE = 'which passed quorum on 1 October and <a href="/contents/history/hyperlane-asset-drain-2026#gp3-result" rel="noopener">closed on 4 October</a> with 95% of the vote for reimbursing the original hUSDC holders. For a week the two instances ran';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  let json = JSON.stringify(page.content);
  if (json.includes(SENTINEL)) {
    console.log('  already applied, no write');
    process.exit(0);
  }
  const f = JSON.stringify(FIND).slice(1, -1);
  const n = json.split(f).length - 1;
  if (n !== 1) throw new Error(`expected 1 match, got ${n}`);
  json = json.replace(f, () => JSON.stringify(REPLACE).slice(1, -1));
  JSON.parse(json);

  const version = '1.7.1';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  if (!DRY) {
    const now = new Date().toISOString();
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'patch', AUTHOR_ID,
        'Proposal 3 on the Foundation instance closed 15:32 UTC 4 Oct, 95% for reimbursing the original hUSDC holders (component_rdx1czn9hr... proposals key 3, 83 ballots). Sentence moved to the past tense; link now points at hyperlane-asset-drain-2026#gp3-result.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
