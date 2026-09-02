import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');

// --- freshness: the 19 August census and the oldest-reading sentence are both re-measured ---
const F_OLD_CENSUS = 'Read on 19 August 2026, 180 of the wiki&rsquo;s 363 pages carry a verification stamp and 183 have never been verified &ndash; and every stamp on the wiki was written by the sweep, because nothing else can write one.';
const F_NEW_CENSUS = 'Read on 2 September 2026, 281 of the wiki&rsquo;s 381 pages carry a verification stamp and 100 have never been verified &ndash; against 180 of 363 a fortnight earlier, and every stamp on the wiki was written by the sweep, because nothing else can write one.';

const F_OLD_OLDEST = 'No page currently meets the threshold. The oldest reading on the wiki is an unverified page last edited on 28 March 2026, 143 days ago.';
const F_NEW_OLDEST = 'No page currently meets the threshold, and one page is close to it. The oldest reading on the wiki is <a href="/ecosystem/xrd-domains" class="link">XRD Domains</a>, never verified and last edited on 28 March 2026, 158 days ago as of this reading, which crosses 180 days on 24 September 2026. It is also one of the two pages the wiki locks against script edits, so the sweep that clears this notice everywhere else cannot edit that page to correct whatever a re-check found, and a stamp written to it would assert a verification the sweep is not in a position to act on. The first <em>May be outdated</em> notice this wiki displays will therefore appear on a page the process cannot currently clear.';

// --- conflict of interest: the Ecosystem denominator has moved, the import figure has not ---
const C_OLD = 'Of the 147 pages under <a href="/ecosystem" class="link">Ecosystem</a>, 111 arrived in a single import';
const C_NEW = 'Of the 150 pages under <a href="/ecosystem" class="link">Ecosystem</a>, 111 arrived in a single import';

const EDITS = [
  { slug: 'freshness', version: '1.4.0', changeType: 'minor',
    sentinel: 'crosses 180 days on 24 September 2026',
    subs: [[F_OLD_CENSUS, F_NEW_CENSUS], [F_OLD_OLDEST, F_NEW_OLDEST]],
    message: 'Re-measured both dated figures. The census moves from 180 of 363 stamped on 19 August to 281 of 381 on 2 September, never-verified 183 to 100. The oldest reading is now named: /ecosystem/xrd-domains at 158 days, which crosses the 180-day threshold on 24 September 2026 and is one of the two pages locked against script edits, so the first outdated notice this wiki shows will sit on a page the sweep cannot clear.' },
  { slug: 'conflict-of-interest', version: '1.2.2', changeType: 'patch',
    sentinel: 'Of the 150 pages under',
    subs: [[C_OLD, C_NEW]],
    message: 'Ecosystem now holds 150 pages, not 147; the 111-page Notion import figure is re-counted from the revisions table and is unchanged.' },
];

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  for (const e of EDITS) {
    if (isLockedPage('policy', e.slug)) throw new Error(`policy/${e.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', ['policy', e.slug]);
    if (!rows.length) throw new Error(`policy/${e.slug} not found`);
    const page = rows[0];

    const blocks = JSON.parse(JSON.stringify(page.content));
    if (blocks.some((b) => b.text?.includes(e.sentinel))) {
      console.log(`  ${e.slug}: already applied - no write`);
      continue;
    }

    let hits = 0;
    for (const b of blocks) {
      if (typeof b.text !== 'string') continue;
      for (const [from, to] of e.subs) {
        if (b.text.includes(from)) { b.text = b.text.replace(from, to); hits++; }
      }
    }
    if (hits !== e.subs.length) throw new Error(`${e.slug}: matched ${hits} of ${e.subs.length} find-strings - aborting before write`);

    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${e.version}  ${hits} substitution(s)`);
    if (!DRY) {
      const now = new Date().toISOString();
      const json = JSON.stringify(blocks);
      await client.query('BEGIN');
      await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, e.version, now, page.id]);
      await client.query(
        `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [cuid(), page.id, json, page.title, e.version, e.changeType, AUTHOR_ID, e.message, now]);
      await client.query('COMMIT');
      console.log('    written');
    }
  }
} finally {
  client.release();
  await pool.end();
}
