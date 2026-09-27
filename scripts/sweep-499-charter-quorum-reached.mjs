// sweep 499: /ideas/radix-network-dao-charter – GP-PRE-1 (Governance Proposal 0) passed its
// 1,351m XRD quorum on 27 September. Tally read off vote.radixdao.org/vote-results and
// /account-votes (the ballot page's own endpoints) at 23:04 UTC 27 Sep: 1,438.67m for, no other
// option, 167 accounts. Quorum crossing reported in t.me/radix_dlt/1005246 at 15:24 UTC.
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ideas';
const SLUG = 'radix-network-dao-charter';
const SENTINEL = 'id="quorum-reached"';

const SECTION = `<h2 id="quorum-reached">Quorum reached (27 September 2026)</h2><p>GP-PRE-1 passed its 1,351m XRD quorum on the afternoon of 27 September, two days into the seven-day ballot. A member <a href="https://t.me/radix_dlt/1005241" target="_blank" rel="noopener">counted 89% of quorum</a> at 13:54 UTC, and at 15:24 UTC <a href="https://t.me/radix_dlt/1005246" target="_blank" rel="noopener">the main Telegram channel reported</a> it reached, with no vote against.</p><p>At 23:04 UTC on 27 September the <a href="https://vote.radixdao.org/proposal/0" target="_blank" rel="noopener">ballot page</a> tallied 1,439m XRD of voting power for GP-PRE-1 from 167 accounts, and none against or abstaining. That is 106% of the quorum and about three times the 473m floor of YES votes, so all three thresholds are met. They are met now, not settled: the ballot runs until 15:18 UTC on 2 October and every vote cast before then counts. Approval would fall below 66% of decisive votes only if more than about 741m XRD voted against.</p>`;

const VOTE_STATUS = `Temperature Check closed 11:50 UTC 25 Sep 2026 at <a href="https://vote.radixdao.org/tc/0" target="_blank" rel="noopener">tc/0</a>: 99.4% for, on 875m XRD cast against a 405m quorum. Governance Proposal open at <a href="https://vote.radixdao.org/proposal/0" target="_blank" rel="noopener">proposal/0</a> until 15:18 UTC 2 Oct 2026; quorum reached 27 Sep, with 1,439m for and none against from 167 accounts at 23:04 UTC`;

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
  table.text = table.text.replace(row, `$1${VOTE_STATUS}$3`);

  const at = blocks.findIndex((b) => b.text?.includes('id="the-ballot-a-day-in"'));
  if (at < 0) throw new Error('anchor section not found');
  blocks.splice(at + 1, 0, { id: uid(), type: 'content', text: SECTION });

  const version = '2.10.0';
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
        'GP-PRE-1 reached its 1,351m quorum on 27 Sep (t.me/radix_dlt/1005246, 15:24 UTC). Tally at 23:04 UTC 27 Sep from vote.radixdao.org/proposal/0: 1,439m for, none against, 167 accounts; all three thresholds met, ballot open to 15:18 UTC 2 Oct. Infobox Vote status updated.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
