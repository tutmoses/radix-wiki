import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

// Run 325, developers rotation. /developers/ai-agents/radix-skills was the head of
// the never-verified queue (last_verified_at NULL since the page was written).
//
// Re-measured 29 August 2026, every figure on the page checked at source:
//   GitHub API repos/xstelea/radix-skills   created 2026-06-21T07:43:04Z,
//     pushed_at 2026-06-21T07:56:26Z, license null, forks 1, stars 1 (was 0).
//   commits: still exactly two, 87c1318 "Initial Radix skill" 07:51:29Z and
//     a78dd32 "Improve public skill copy" 07:56:20Z, both 21 June.
//   git tree, recursive: 48 blobs, 592,010 B. radix/references/ holds 40 files
//     totalling 533,896 B, of which 38 are guide-*.md at 523,691 B, and
//     radix/scripts/validate-radix-skill.py is 39,786 B. The page's "40 reference
//     files ~534 KB", "38 topic guides" and "40 KB Python validation script" are
//     all exact; nothing to correct.
//   skills.sh listing: InstallAction userInteractionCount 9 (was 6), scan verdicts
//     unchanged at two passes and one Snyk warn.
//
// So the only movement in the seven weeks since publication is adoption, and the
// page's adoption paragraph is the one place that should say so.

const TAG_PATH = 'developers/ai-agents';
const SLUG = 'radix-skills';
const SENTINEL = 'Re-read on 29 August 2026';
const DRY = process.argv.includes('--dry-run');

const FIND = `listing recorded <strong>six installs</strong> and the GitHub repository zero stars and one fork on the day it was announced &mdash; useful context for anyone reading the reaction as evidence of adoption.</p>`;

const REPLACE = `listing recorded <strong>six installs</strong> and the GitHub repository zero stars and one fork on the day it was announced &mdash; useful context for anyone reading the reaction as evidence of adoption. Re-read on 29 August 2026, three weeks later: <strong>nine installs</strong>, one star, one fork, and still the same two June commits, so the announcement moved the install count by three and the code not at all.</p>`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
    [TAG_PATH, SLUG],
  );
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  const target = blocks.find((b) => b.text?.includes(FIND));
  if (!target) throw new Error('adoption sentence not found');
  target.text = target.text.replace(FIND, REPLACE);

  const version = '1.1.1';
  const before = JSON.stringify(page.content).length;
  const json = JSON.stringify(blocks);
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  ${before} -> ${json.length} B`);

  if (!DRY) {
    const now = new Date().toISOString();
    await client.query('BEGIN');
    await client.query(
      'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, version, now, page.id],
    );
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        cuid(), page.id, json, page.title, version, 'patch', AUTHOR_ID,
        'Re-measured every figure on this page at source (GitHub API, recursive git tree, skills.sh listing) on 29 August 2026. File counts and sizes are exact and the repository is unchanged at two 21 June commits with no licence; installs have moved 6 -> 9 and stars 0 -> 1, so the adoption sentence now carries both readings.',
        now,
      ],
    );
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
