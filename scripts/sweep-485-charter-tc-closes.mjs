// sweep 485: /ideas/radix-network-dao-charter – the GP-PRE-1 Temperature Check (tc/0) closed at
// 11:50 UTC on 25 September. Result read off vote.radixdao.org/tc/0 at 15:05 UTC; the
// governance component showed no transaction after the close (no outcome recorded, no proposal).
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ideas';
const SLUG = 'radix-network-dao-charter';
const SENTINEL = 'id="the-temperature-check-closes"';

const SECTION = `<h2 id="the-temperature-check-closes">The Temperature Check closes (25 September 2026)</h2><p>The Temperature Check closed at 11:50 UTC on 25 September with 869m XRD of voting power for GP-PRE-1 and 5m against: 99.4% approval from 148 accounts, on the <a href="https://vote.radixdao.org/tc/0" target="_blank" rel="noopener">ballot page</a>. The 875m cast is just over twice the check's quorum and about 65% of the 1,351m quorum the full proposal will need.</p><p>The next step is promoting the check to a Governance Proposal, the seven-day ballot that ratifies the framework. Read at 15:05 UTC, no transaction had touched the governance component since the close, so neither the check's outcome nor the proposal is on the ledger yet.</p>`;

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

  const infobox = blocks.find((b) => b.type === 'infobox');
  const row = /(<td><strong>Vote status<\/strong><\/td><td>)(.*?)(<\/td>)/;
  const table = infobox.blocks.find((b) => row.test(b.text ?? ''));
  if (!table) throw new Error('vote status row not found');
  console.log('  old row:', table.text.match(row)[2]);
  table.text = table.text.replace(row, `$1Temperature Check closed 11:50 UTC 25 Sep 2026 at <a href="https://vote.radixdao.org/tc/0" target="_blank" rel="noopener">tc/0</a>: 99.4% for, on 875m XRD cast against a 405m quorum. The Governance Proposal had not opened by 15:05 UTC$3`);

  const at = blocks.findIndex((b) => b.text?.includes('id="the-temperature-check-opens"'));
  if (at < 0) throw new Error('anchor section not found');
  blocks.splice(at + 1, 0, { id: uid(), type: 'content', text: SECTION });

  const version = '2.7.0';
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
        'GP-PRE-1 Temperature Check closed 25 Sep: 869m for, 5m against (99.4%), 148 accounts, quorum met (vote.radixdao.org/tc/0). No outcome or Governance Proposal on the ledger as of 15:05 UTC.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
