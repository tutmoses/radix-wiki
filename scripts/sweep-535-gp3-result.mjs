/**
 * Sweep 535: governance proposal #3 (allocation of the ~443k USDC of trapped
 * Hyperlane collateral) closed at 15:32:45 UTC on 4 October 2026. Read at
 * ~23:05 UTC on 4 October:
 *   - component_rdx1czn9hr... proposals KVS key 3: vote_count 83, revote_count 2,
 *     quorum 671,470,000, deadline 1791127965, last updated at state version
 *     560,709,764 (before the close).
 *   - api-consultation.mountain-top.live/vote-results?type=proposal&entityId=3:
 *     option 0 (reimburse hUSDC holders) 796,003,120.5; option 1 (pro-rata)
 *     44,709,423.4; option 2 (DAO treasury) 1,134,508.5.
 *   - No recovery announcement in t.me/RadixAnnouncements or radix_dlt by then;
 *     t.me/radix_dlt/1006347 (14:48 UTC 4 Oct) asks for exactly that status.
 * Records the result on /contents/history/hyperlane-asset-drain-2026.
 */
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'contents/history';
const SLUG = 'hyperlane-asset-drain-2026';
const SENTINEL = 'id="gp3-result"';

const TALLY = 'https://api-consultation.mountain-top.live/vote-results?type=proposal&amp;entityId=3';
const ext = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

const EDITS = [
  {
    find: 'governance proposal #3</a>, open from 27 September to 15:32 UTC on 4 October 2026 and past its quorum by 1 October, with reimbursing the original hUSDC holders ahead. Not yet recovered</td>',
    replace: 'governance proposal #3</a>, which closed at 15:32 UTC on 4 October 2026 with 95% of the vote for reimbursing the original hUSDC holders. Not yet recovered</td>',
  },
  {
    find: 'The recovery itself had still not been announced.</p>',
    replace: `The recovery itself had still not been announced.</p><p id="gp3-result">The vote closed at 15:32&nbsp;UTC on 4 October. The component ended with 83 ballots, two of them changed, and ${ext(TALLY, 'the final tally')} put 796.0m XRD behind reimbursing the original hUSDC holders, 44.7m behind the pro-rata share and 1.1m behind the DAO treasury: 841.8m in all, 95% of it on the first option. So if the Foundation recovers the collateral, the accounts that held hUSDC at the exploit snapshot get it back as hUSDC, in proportion to what they held, and holders of the other Hyperlane assets get nothing from this pool. By the end of that day no recovery had been announced, and ${ext('https://t.me/radix_dlt/1006347', 'holders in the main Radix chat were asking')} what happens next.</p>`,
  },
  {
    find: 'that closes on 4 October and has <a href="#gp3-quorum">already reached quorum</a>; the recovery itself has not been announced.',
    replace: 'that closed on 4 October <a href="#gp3-result">in favour of reimbursing the original hUSDC holders</a>; the recovery itself has not been announced.',
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

  const version = '3.8.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  if (!DRY) {
    const now = new Date().toISOString();
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
        'Governance proposal #3 closed 15:32 UTC 4 Oct: read ~23:05 UTC from component_rdx1czn9hr... (83 ballots, 2 revotes) and the collector tally (796.0m reimburse hUSDC holders, 44.7m pro-rata, 1.1m treasury; 841.8m, 95% option 1). New paragraph p#gp3-result, infobox Recovery row, What is unresolved sentence. No recovery announced yet.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
