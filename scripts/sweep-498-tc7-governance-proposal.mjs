/**
 * Sweep 498: the allocation of the ~443k USDC of stranded Hyperlane collateral went to
 * a governance proposal the afternoon temperature check #7 closed. Read at ~19:07 UTC
 * on 27 September 2026:
 *   - component_rdx1czn9hr...: proposal_count 4; proposals KVS key 3, "Allocation of
 *     Recoverable hUSDC Collateral Following the 31 August 2026 Exploit",
 *     temperature_check_id 7, start 1790523165 (15:32:45 UTC 27 Sep), deadline
 *     1791127965 (15:32:45 UTC 4 Oct), quorum 671,470,000, vote_count 24, revote_count 1.
 *   - api-consultation.mountain-top.live/vote-results?type=proposal&entityId=3:
 *     option 0 (reimburse hUSDC holders) 128,159,110.5; option 1 (pro-rata to all
 *     victims) 40,986,768.2; option 2 (DAO treasury) no entry.
 * Records it on /contents/history/hyperlane-asset-drain-2026.
 */
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'contents/history';
const SLUG = 'hyperlane-asset-drain-2026';
const SENTINEL = 'id="gp3-open"';

const PROPOSAL = 'https://consultation.mountain-top.live/proposal/3';
const TALLY = 'https://api-consultation.mountain-top.live/vote-results?type=proposal&amp;entityId=3';
const ext = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

const EDITS = [
  {
    find: `${ext('https://consultation.mountain-top.live/tc/7', 'temperature check #7')}, passed on 27 September 2026 and awaiting a governance proposal. Not yet recovered</td>`,
    replace: `${ext(PROPOSAL, 'governance proposal #3')}, open from 27 September to 15:32 UTC on 4 October 2026, after ${ext('https://consultation.mountain-top.live/tc/7', 'temperature check #7')} passed. Not yet recovered</td>`,
  },
  {
    find: 'Nor had the Foundation said the collateral was recovered, and without that nothing is paid under any option.</p>',
    replace: `Nor had the Foundation said the collateral was recovered, and without that nothing is paid under any option.</p><p id="gp3-open">The proposal opened at 15:32&nbsp;UTC the same afternoon as ${ext(PROPOSAL, 'proposal #3')} on the same component, and closes at 15:32&nbsp;UTC on 4 October. It puts the same three options and needs 671.5m XRD of votes to reach quorum. Four hours in, 24 ballots had been cast, with ${ext(TALLY, '128.2m XRD behind reimbursing the original hUSDC holders and 41.0m behind a pro-rata share for every holder of a Hyperlane asset')}, and none yet for the DAO treasury: a quarter of the way to quorum. The proposal's own text restates the condition. Whatever wins is carried out only if the Foundation recovers the collateral to a wallet it controls, and if it cannot, the vote is moot.</p>`,
  },
  {
    find: 'The temperature check passed on 27 September, so the allocation goes to a governance proposal; neither that proposal nor the recovery had happened by the end of that morning.',
    replace: 'The temperature check passed on 27 September and the allocation is now <a href="#gp3-open">a governance proposal</a> that closes on 4 October; the recovery itself had not been announced when it opened.',
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
    console.log('  already applied — no write');
    process.exit(0);
  }
  for (const { find, replace } of EDITS) {
    const f = JSON.stringify(find).slice(1, -1);
    const n = json.split(f).length - 1;
    if (n !== 1) throw new Error(`expected 1 match, got ${n}: ${find.slice(0, 80)}`);
    json = json.replace(f, () => JSON.stringify(replace).slice(1, -1));
  }
  JSON.parse(json);

  const version = '3.6.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  if (!DRY) {
    const now = new Date().toISOString();
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
        'The TC #7 allocation opened as governance proposal #3 at 15:32 UTC on 27 September, closing 15:32 UTC 4 October, quorum 671.5m (proposals KVS key 3 on component_rdx1czn9hr...). Early tally from api-consultation.mountain-top.live at ~19:07 UTC: 128.2m for reimbursing hUSDC holders, 41.0m pro-rata, none for the treasury, 24 ballots. Infobox Recovery row, new paragraph p#gp3-open, What is unresolved updated.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
