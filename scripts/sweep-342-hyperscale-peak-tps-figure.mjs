// sweep-342-hyperscale-peak-tps-figure.mjs
//
// Three pages still put the January 2026 Hyperscale peak at "above 800,000"
// TPS. The figure is unsourced; the Foundation's own post reports "peaks of
// over 700k TPS", and /contents/tech/research/hyperscale-500k-tps carries
// 700,000+. Run 181 (2 Aug 2026) purged this from five pages and missed these
// three, two of which sit in the contents/tech rotation and one of which is
// the homepage.
//
//   node scripts/sweep-342-hyperscale-peak-tps-figure.mjs --dry-run
//   node scripts/sweep-342-hyperscale-peak-tps-figure.mjs

import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');

// Exact stored phrasings, verified against the DB before writing.
const SWAPS = [
  ['peaks above 800,000 TPS across 128 shards', 'peaks above 700,000 TPS across 128 shards'],
  ['(peaking above 800,000) across 128 shards', '(peaking above 700,000) across 128 shards'],
];

const TARGETS = [
  ['', ''],
  ['contents/tech/comparisons', 'radix-vs-cosmos'],
  ['contents/tech/comparisons', 'radix-vs-polkadot'],
];

const bumpPatch = (v) => {
  const [maj, min, pat] = String(v || '1.0.0').split('.').map((n) => parseInt(n, 10) || 0);
  return `${maj}.${min}.${pat + 1}`;
};

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  let written = 0;
  for (const [tagPath, slug] of TARGETS) {
    if (isLockedPage(tagPath, slug)) { console.log(`  SKIP ${tagPath}/${slug} — LOCKED`); continue; }

    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [tagPath, slug]);
    if (!rows.length) { console.log(`  ${tagPath}/${slug} — page not found, skipped`); continue; }
    const page = rows[0];

    const before = JSON.stringify(page.content);
    let after = before;
    let hits = 0;
    for (const [from, to] of SWAPS) {
      const n = after.split(from).length - 1;
      if (n) { after = after.split(from).join(to); hits += n; }
    }

    if (!hits) { console.log(`  ${tagPath || '(root)'}/${slug || '(hub)'} — no 800,000 peak claim, already applied`); continue; }

    const version = bumpPatch(page.version);
    console.log(`  ${DRY ? '[dry] ' : ''}${tagPath || '(root)'}/${slug || '(hub)'}  v${page.version} -> v${version}  (${hits} fixed)`);

    if (!DRY) {
      const now = new Date().toISOString();
      await client.query('BEGIN');
      await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
        [after, version, now, page.id]);
      await client.query(
        `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [cuid(), page.id, after, page.title, version, 'patch', AUTHOR_ID,
         'Correct the January 2026 Hyperscale peak from an unsourced 800,000 TPS to the reported figure. The Foundation\'s ' +
         'own post says "peaks of over 700k TPS", and /contents/tech/research/hyperscale-500k-tps already carries 700,000+. ' +
         'Last three pages holding the figure the run-181 pass removed elsewhere.',
         now]);
      await client.query('COMMIT');
      written++;
    }
  }
  console.log(`\n  ${DRY ? '[dry] would write' : 'wrote'} ${DRY ? TARGETS.length : written} pages`);
} finally {
  client.release();
  await pool.end();
}
