// Run 399. babylon-node v1.4.0.0 "Eagle Ray" published as a FINAL release at 03:59:09 UTC
// on 10 September 2026. Both tags - v1.4.0.0-RC1 of 8 September and v1.4.0.0 - resolve to
// the same commit, 7400951e0eb76a725f39d04d57da293fb335bd0e, which is also main's tip and
// the head of a new release/eagle-ray branch. The page said the repository's "latest
// release" still resolves to v1.3.0.5-test.1; the final release carries no pre-release
// flag, so GitHub and the ghproxy mirror both return v1.4.0.0 (read 07:06 UTC).
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/tech/core-protocols';
const SLUG = 'babylon-node';
const SENTINEL = '7400951e0eb76a725f39d04d57da293fb335bd0e';
const DRY = process.argv.includes('--dry-run');

const REL = 'https://github.com/radixdlt/babylon-node/releases/tag/v1.4.0.0';
const A = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

const sub = (block, needle, repl, where) => {
  const t = block.text;
  if (!t.includes(needle)) throw new Error(`${where}: not matched -> ${needle.slice(0, 70)}`);
  block.text = t.replace(needle, repl);
};

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  const flat = JSON.stringify(blocks);
  if (flat.includes(SENTINEL)) { console.log('  already applied - no write'); process.exit(0); }

  // --- infobox: the Latest release row.
  const box = blocks.find((b) => b.type === 'infobox');
  if (!box?.blocks?.length) throw new Error('infobox not found');
  const table = box.blocks.find((b) => b.text?.includes('Latest release'));
  if (!table) throw new Error('infobox table not found');
  const iStart = table.text.indexOf('<tr><th>Latest release</th>');
  const iEnd = table.text.indexOf('</tr>', iStart);
  if (iStart < 0 || iEnd < 0) throw new Error('Latest release row not found');
  table.text = table.text.slice(0, iStart)
    + `<tr><th>Latest release</th><td>${A(REL, 'v1.4.0.0')}, 10 September 2026, the final Eagle Ray release; it tags commit <code>7400951e</code>, the same commit as the v1.4.0.0-RC1 candidate of 8 September, and carries no pre-release flag</td>`
    + table.text.slice(iEnd);

  // --- block 3: the protocol-update table names the node release that carries Eagle Ray.
  const trig = blocks.find((b) => b.text?.includes('EnactAtStartOfEpochUnconditionally'));
  if (!trig) throw new Error('protocol trigger section not found');
  sub(trig, '<td>Eagle Ray</td><td>v1.4.0.0-RC1</td>', '<td>Eagle Ray</td><td>v1.4.0.0</td>', 'block 3 table');
  sub(trig, 'released in v1.4.0.0-RC1 gives it', 'released in v1.4.0.0 gives it', 'block 3 prose');

  // --- block 4: main's tip now carries two tags.
  const branch = blocks.find((b) => b.text?.includes("<code>main</code>'s tip is now"));
  if (!branch) throw new Error('branch section not found');
  sub(branch,
    `tagged ${A('https://github.com/radixdlt/babylon-node/releases/tag/v1.4.0.0-RC1', 'v1.4.0.0-RC1')}, the first release since v1.3.0 to carry a protocol change`,
    `tagged ${A('https://github.com/radixdlt/babylon-node/releases/tag/v1.4.0.0-RC1', 'v1.4.0.0-RC1')} on 8 September and ${A(REL, 'v1.4.0.0')} on 10 September, the first release since v1.3.0 to carry a protocol change, and the head of a third branch, <code>release/eagle-ray</code>`,
    'block 4');

  // --- block 5: the pre-release consequence is spent.
  const both = blocks.find((b) => b.text?.includes('It is a release candidate flagged as a pre-release'));
  if (!both) throw new Error('both-halves section not found');
  const k = both.text.indexOf('It is a release candidate flagged as a pre-release');
  if (!both.text.trimEnd().endsWith('</p>')) throw new Error('block 5 does not end on a paragraph');
  both.text = both.text.slice(0, k)
    + `The candidate was flagged a pre-release, so the repository's <q>latest release</q> resolved to <code>v1.3.0.5-test.1</code>, a rebuild of the halted version tagged that same lunchtime. The final release, ${A(REL, '<code>v1.4.0.0</code>')}, followed at 03:59:09 UTC on 10 September 2026, with container images pushed between 04:31 and 04:50 UTC. It tags commit <code>7400951e0eb76a725f39d04d57da293fb335bd0e</code>, which is the commit the candidate already tagged, so the code an operator installs is the code they could have installed on 8 September; what the final release adds is the absence of the pre-release flag, and with it a ${A('https://api.github.com/repos/radixdlt/babylon-node/releases/latest', 'latest release')} that resolves to Eagle Ray for GitHub and for the <code>ghproxy.radixdlt.com</code> mirror ${A('/developers/infrastructure/01-running-a-node', 'the node installer reads')}. Read at 07:07:53 UTC on 10 September the ledger had not moved: installation by operators and two thirds of stake back online both remain.</p>`;

  const version = '1.3.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Eagle Ray shipped as a final release, v1.4.0.0, at 03:59:09 UTC on 10 September 2026. It tags 7400951e0eb76a725f39d04d57da293fb335bd0e, the same commit as the 8 September candidate, and is the head of a new release/eagle-ray branch. With no pre-release flag, GitHub and ghproxy both return it, which retires the v1.3.0.5-test.1 reading the infobox and the release section carried.',
       now]);
    await client.query('COMMIT');
    console.log('  committed');
  }
} finally {
  client.release();
  await pool.end();
}
