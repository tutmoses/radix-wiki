/**
 * Sweep 516: governance proposal #3 (the allocation of the ~443k USDC of trapped
 * Hyperlane collateral) passed quorum with three days left. Read at 19:10 UTC on
 * 1 October 2026:
 *   - component_rdx1czn9hr... proposals KVS key 3: vote_count 75, revote_count 2,
 *     quorum 671,470,000, deadline 1791127965 (15:32:45 UTC 4 Oct).
 *   - api-consultation.mountain-top.live/vote-results?type=proposal&entityId=3:
 *     option 0 (reimburse hUSDC holders) 774,449,008.9; option 1 (pro-rata)
 *     44,709,423.4; option 2 (DAO treasury) 1,134,508.5; 73 accounts.
 * Records it on /contents/history/hyperlane-asset-drain-2026.
 */
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'contents/history';
const SLUG = 'hyperlane-asset-drain-2026';
const SENTINEL = 'id="gp3-quorum"';

const TALLY = 'https://api-consultation.mountain-top.live/vote-results?type=proposal&amp;entityId=3';
const ext = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

const EDITS = [
  {
    find: `governance proposal #3</a>, open from 27 September to 15:32 UTC on 4 October 2026, after ${ext('https://consultation.mountain-top.live/tc/7', 'temperature check #7')} passed. Not yet recovered</td>`,
    replace: 'governance proposal #3</a>, open from 27 September to 15:32 UTC on 4 October 2026 and past its quorum by 1 October, with reimbursing the original hUSDC holders ahead. Not yet recovered</td>',
  },
  {
    find: 'and if it cannot, the vote is moot.</p>',
    replace: `and if it cannot, the vote is moot.</p><p id="gp3-quorum">Read on 1 October at 19:10&nbsp;UTC, three days before the close, the proposal had passed quorum. The component recorded 75 ballots from 73 accounts, two of them changed, and ${ext(TALLY, 'the collector’s tally')} put 774.4m XRD behind reimbursing the original hUSDC holders, 44.7m behind the pro-rata share and 1.1m behind the DAO treasury: 820.3m in all against the 671.5m needed, with 94% of it on the first option. The recovery itself had still not been announced.</p>`,
  },
  {
    find: 'The temperature check passed on 27 September and the allocation is now <a href="#gp3-open">a governance proposal</a> that closes on 4 October; the recovery itself had not been announced when it opened.',
    replace: 'The temperature check passed on 27 September and the allocation is now <a href="#gp3-open">a governance proposal</a> that closes on 4 October and has <a href="#gp3-quorum">already reached quorum</a>; the recovery itself has not been announced.',
  },
];

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
  if (json.includes(SENTINEL.replace(/"/g, '\\"'))) {
    console.log('  already applied, no write');
    process.exit(0);
  }
  for (const { find, replace } of EDITS) {
    const f = JSON.stringify(find).slice(1, -1);
    const n = json.split(f).length - 1;
    if (n !== 1) throw new Error(`expected 1 match, got ${n}: ${find.slice(0, 80)}`);
    json = json.replace(f, () => JSON.stringify(replace).slice(1, -1));
  }
  JSON.parse(json);

  const version = '3.7.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  if (!DRY) {
    const now = new Date().toISOString();
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
        'Governance proposal #3 passed quorum: read 19:10 UTC 1 Oct from component_rdx1czn9hr... (75 ballots, 2 revotes) and the collector tally (774.4m reimburse hUSDC holders, 44.7m pro-rata, 1.1m treasury; 820.3m against 671.5m quorum). New paragraph p#gp3-quorum, infobox Recovery row, What is unresolved sentence.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
