// Run 349, ecosystem rotation. One genuine death in the ecosystem link audit: the $HIT
// "predefined schedule" citation pointed at a GitBook page that no longer exists. The
// schedule was not deleted — it was folded into the Rug-Proof staking page, and Addix's
// own markdown twin now renders the old reference as broken://pages/ApivIDiX9hWGnuRRkDI1.
// Repointed to where the schedule actually lives.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'ecosystem';
const SLUG = 'addix';
const DEAD = 'https://addix-xrd.gitbook.io/usdhit-on-radix/rug-proof-emission-schedule';
const LIVE = 'https://addix-xrd.gitbook.io/usdhit-on-radix/proof-of-usdhit/rug-proof-usdhit-staking';
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

  let json = JSON.stringify(page.content);
  const hits = json.split(DEAD).length - 1;
  if (hits === 0) {
    console.log('  already applied — no write');
    process.exit(0);
  }
  json = json.split(DEAD).join(LIVE);
  const blocks = JSON.parse(json);

  const version = '3.2.3';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  ${hits} link(s) repointed`);
  if (!DRY) {
    const now = new Date().toISOString();
    const out = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [out, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, out, page.title, version, 'patch', AUTHOR_ID,
       "Dead link fix: the $HIT emission-schedule citation pointed at addix-xrd.gitbook.io/usdhit-on-radix/rug-proof-emission-schedule, which now answers 404. Addix's own markdown twin renders the same reference as broken://pages/ApivIDiX9hWGnuRRkDI1 and carries the release schedule inside the Rug-Proof $HIT Staking page, so the link is repointed there.", now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
