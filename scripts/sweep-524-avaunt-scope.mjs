// Sweep 524: /ecosystem/avaunt-staking, 3 Oct 2026. Scope check banked by run 522, read against the
// 1 Oct 2026 rule (no owner-badge handovers traced between private accounts, no per-validator fee
// or stake figures; link the validator's Radix Dashboard page instead). The sale was announced
// publicly by both parties, so the announcement and the delegator guidance stay. Removed: the
// account-level trace of the badge (state versions, account addresses, amounts, the venue fee),
// the new owner's fee and owner-stake transactions, the dated stake and rank reads, and the
// "25% fee took effect" section. The Dashboard link already in "The rest of this page" carries
// the current name, fee and stake.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'ecosystem';
const SLUG = 'avaunt-staking';
const CUT_FROM = '<h3>The transfer had already finalized';
const KEEP_FROM = '<h3>The rest of this page</h3>';
const CUT_TAIL = '<h3>The 25% fee took effect';
const NEW = '<p>The badge moved on 21 August, the afternoon of the announcement, so the node has been StakeSafe\'s since.</p>';

const DRY = process.argv.includes('--dry-run');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();
try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query('SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));
  const top = blocks[0];
  if (!top.text.includes(CUT_FROM)) { console.log('  already applied, no write'); process.exit(0); }
  const i = top.text.indexOf(CUT_FROM), j = top.text.indexOf(KEEP_FROM), k = top.text.indexOf(CUT_TAIL);
  if (!(i > 0 && j > i && k > j)) throw new Error(`markers out of order: ${i} ${j} ${k}`);
  top.text = top.text.slice(0, i) + NEW + top.text.slice(j, k);
  for (const bad of ['state version', 'account_rdx', '1,456,311', '25%', 'epoch', 'rank 9', 'Subsidy Sunset']) {
    if (top.text.includes(bad)) throw new Error(`still contains ${bad}`);
  }
  if (/\u2014|\u00a0/.test(NEW)) throw new Error('em dash or nbsp in new text');

  const version = '3.4.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  block0 ${page.content[0].text.length} -> ${top.text.length} chars`);
  if (DRY) console.log(top.text);
  if (!DRY) {
    const json = JSON.stringify(blocks);
    const now = new Date().toISOString();
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
        'Sweep 524: scope edit under the 1 Oct 2026 rule. Kept the public announcement of the sale to StakeSafe and the delegator guidance; removed the account-level trace of the owner badge, the new owner\'s fee and owner-stake transactions, the dated stake and rank reads and the 20 Sep fee section. The validator\'s Radix Dashboard page, already linked, carries its current name, fee and stake.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
