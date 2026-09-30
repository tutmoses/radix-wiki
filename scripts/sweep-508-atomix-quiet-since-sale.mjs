/**
 * sweep 508 - ecosystem rotation: Atomix re-read on ledger.
 *
 * Run 30 September 2026.
 *
 * The Atomix Fee Collection component
 * (component_rdx1cq94mg7jakn9w5lnaeajvhsavj7nrqntnsype98sg6w2sqy9050mvz,
 * address read from the atomix.trade bundle) listed from 21 Aug 2026 to the
 * ledger tip at state version 560,459,652 on 30 Sep: three transactions, all
 * on 21 August (the 4.5 XRD fee, the 43,689.33 XRD validator-sale fee, the
 * 43,693.83 XRD sweep), nothing after. The front end still answers 200 on
 * Fly, Last-Modified 21 Aug 2026 15:11 GMT, and its bundle still ships the
 * "atomix beta" modal. The page now says so, dated.
 *
 * Idempotent: skipped if the sentinel is already stored.
 */
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ecosystem';
const SLUG = 'atomix';
const SENTINEL = 'Re-read on 30 September 2026';

const BETA_OLD = 'As of August 2026 the interface still carries a beta notice';
const BETA_NEW = 'As of September 2026 the interface still carries a beta notice';
const SWEEP_END = 'in a single withdrawal. Avaunt built Atomix, and when Avaunt sold its validator it used Atomix to do it.</p>';
const QUIET = `<p>${SENTINEL}, the component had recorded nothing since that sweep: the <a href="https://dashboard.radixdlt.com/component/component_rdx1cq94mg7jakn9w5lnaeajvhsavj7nrqntnsype98sg6w2sqy9050mvz/recent-transactions" target="_blank" rel="noopener">fee collector's history</a> ends with the three transactions of 21 August, so no trade has settled through Atomix in the forty days since. The front end is still up, and its last deployment is dated the same afternoon as the sale.</p>`;

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
  if (blocks.some((b) => b.text?.includes(SENTINEL))) {
    console.log('  already applied - no write');
    process.exit(0);
  }
  let hits = 0;
  for (const b of blocks) {
    if (b.text?.includes(BETA_OLD)) { b.text = b.text.replace(BETA_OLD, BETA_NEW); hits++; }
    if (b.text?.includes(SWEEP_END)) { b.text = b.text.replace(SWEEP_END, SWEEP_END + QUIET); hits++; }
  }
  if (hits !== 2) throw new Error(`expected 2 replacements, got ${hits}`);

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
        'Fee collector re-read to the ledger tip on 30 Sep 2026 (state version 560,459,652): no transaction since the three of 21 Aug, so no trade has settled in forty days. Beta notice re-dated to September.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
