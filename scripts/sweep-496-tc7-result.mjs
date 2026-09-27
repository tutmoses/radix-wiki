/**
 * Sweep 496: temperature check #7 on Radix Consultation, the allocation of the
 * ~443k USDC of Hyperlane collateral the attacker's stuck transfer left behind,
 * closed at 08:00:02 UTC on 27 September 2026 (deadline 1790496002 on the
 * component). Read at 11:05 UTC that day:
 *   - component_rdx1czn9hr...: quorum 402,876,916, approval threshold 0.5,
 *     proposal quorum 671,470,000; TC 7 vote_count 135, revote_count 3,
 *     elevated_proposal_id None.
 *   - api-consultation.mountain-top.live/vote-results?type=temperature_check&entityId=7:
 *     For 831,883,728.78, no Against entry (TC 5's reply lists Against when it exists).
 * Records the result on /contents/history/hyperlane-asset-drain-2026 in the
 * infobox Recovery row, the trapped-USDC section and What is unresolved.
 */
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'contents/history';
const SLUG = 'hyperlane-asset-drain-2026';
const SENTINEL = 'id="tc7-result"';

const COMPONENT = 'https://dashboard.radixdlt.com/component/component_rdx1czn9hrgd30x742k6jw2e6psj9jlkqvu2cj4hcry60p7f38hxd3k3xt';
const TALLY = 'https://api-consultation.mountain-top.live/vote-results?type=temperature_check&amp;entityId=7';
const ext = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

const EDITS = [
  {
    find: `${ext('https://consultation.mountain-top.live/tc/7', 'temperature check #7')}, 22 to 27 September 2026</td>`,
    replace: `${ext('https://consultation.mountain-top.live/tc/7', 'temperature check #7')}, passed on 27 September 2026 and awaiting a governance proposal. Not yet recovered</td>`,
  },
  {
    find: 'If the temperature check passes, the options go forward to a governance proposal, where the allocation is decided.</p>',
    replace: `If the temperature check passes, the options go forward to a governance proposal, where the allocation is decided.</p><p id="tc7-result">It passed. The vote closed at 08:00&nbsp;UTC on 27 September with ${ext(TALLY, '831.9m XRD of voting power For')} and none Against, about twice the ${ext(COMPONENT, 'Consultation component')}'s 402.9m XRD quorum, cast in 135 ballots, three of which replaced an earlier one. A temperature check asks only whether a question should go forward, so no option has won yet. That choice falls to the governance proposal, which needs 671.5m XRD to reach quorum and had not been opened when the component was read at 11:05&nbsp;UTC the same day. Nor had the Foundation said the collateral was recovered, and without that nothing is paid under any option.</p>`,
  },
  {
    find: 'has put to <a href="#the-trapped-usdc">a community vote</a> that closes on 27 September.',
    replace: 'has put to <a href="#the-trapped-usdc">a community vote</a>. The temperature check passed on 27 September, so the allocation goes to a governance proposal; neither that proposal nor the recovery had happened by the end of that morning.',
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

  const version = '3.5.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  if (!DRY) {
    const now = new Date().toISOString();
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
        'Temperature check #7 closed at 08:00 UTC on 27 September and passed: 831.9m XRD For, none Against, against a 402.9m quorum, 135 ballots (collector api-consultation.mountain-top.live, component_rdx1czn9hr...). The allocation now goes to a governance proposal, not yet opened at 11:05 UTC; recovery not yet announced. Infobox Recovery row, The trapped USDC and What is unresolved updated.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
