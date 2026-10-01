/**
 * Sweep 516: /ideas/dao-governance-app-consultation-v2 was last read on 23 August, when
 * the DAO instance held nothing and the Foundation instance's certificate had lapsed.
 * Read at epoch 345,748 (19:10 UTC 1 October 2026):
 *   - component_rdx1cp90ys... (Radix DAO Consultations): temperature_check_count 1,
 *     proposal_count 1, majority_judgment_election_count 0. TC 0 = GP-PRE-1, start
 *     1789905040 (11:50 UTC 20 Sep), deadline 1790337040 (25 Sep), 155 votes / 7
 *     revotes, outcome Passed recorded 1790349506, continuation Proposal(0). Proposal 0
 *     start 1790349531 (15:18 UTC 25 Sep), deadline 1790954331 (15:18 UTC 2 Oct),
 *     parameter set dao-constitutional v1 (7 days, quorum 1,350,832,592, 0.66),
 *     190 votes / 4 revotes. vote.radixdao.org/vote-results: option 0 1,836,492,030;
 *     /account-votes 186 accounts, all option 0.
 *   - component_rdx1czn9hr... (Foundation): temperature_check_count 8, proposal_count 4
 *     (was 7 / 3 on 11 Aug). consultation.mountain-top.live certificate reissued
 *     25 Aug 2026 (Let's Encrypt, to 23 Nov); api-consultation.mountain-top.live
 *     answers /vote-results and /account-votes.
 */
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ideas';
const SLUG = 'dao-governance-app-consultation-v2';
const SENTINEL = 'id="both-instances-live"';
const ext = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const int = (href, text) => `<a href="${href}" rel="noopener">${text}</a>`;

const DAO_COMPONENT = 'https://dashboard.radixdlt.com/component/component_rdx1cp90ys553uwxuckev249x5wezucqru0u4qr7qdxdc9tlpmnh93242k';
const FND_COMPONENT = 'https://dashboard.radixdlt.com/component/component_rdx1czn9hrgd30x742k6jw2e6psj9jlkqvu2cj4hcry60p7f38hxd3k3xt';

const LATEST_OLD = "23 Aug 2026 &ndash; the DAO instance is public at vote.radixdao.org and parameterised, but its temperature-check, proposal and election counts all read 0; the Foundation instance's certificate has lapsed";
const LATEST_NEW = '1 Oct 2026 &ndash; both instances carry a live vote: GP-PRE-1 on the DAO instance (1,836.5m XRD for, 186 accounts, closes 2 Oct) and the hUSDC allocation on the Foundation instance (past quorum, closes 4 Oct); no election has opened';

const SECTION = `<h2 id="both-instances-live">Both instances carry a live vote (1 October 2026)</h2>
<p>The empty ballot box filled. Read live at epoch 345,748 on 1 October 2026, the ${ext(DAO_COMPONENT, 'Radix DAO Consultations')} component holds one temperature check and one proposal, both of them GP-PRE-1, the ${int('/ideas/dao-adopt-phase1-governance-docs', 'constitutional ratification')} of the ${int('/ideas/radix-network-dao-charter', 'Charter')} and its 20 policies. The temperature check ran from 20 to 25 September, drew 155 votes, and is recorded in the component as Passed, with a continuation field pointing at proposal 0. The Foundation instance&rsquo;s temperature checks store only the id of the proposal each was lifted to; this is the first on either instance to carry its result on the ledger rather than in an announcement. Proposal 0 opened at 15:18&nbsp;UTC on 25 September under the dao-constitutional parameter set, which the component snapshots into the proposal itself (seven days, 1,350.8m XRD quorum, 66% approval), and closes at 15:18&nbsp;UTC on 2 October. By the reading it held 190 ballots, four of them re-cast, and ${ext('https://vote.radixdao.org/vote-results?type=proposal&amp;entityId=0', 'the published tally')} put 1,836.5m XRD on Approve from 186 accounts, with nothing on Reject or Abstain. The Majority Judgment election store is still empty, so the ${int('/ideas/dao-elect-permanent-rac', 'permanent RAC election')} has not opened.</p>
<p>The DAO front end now publishes a tally of its own. The 23 August reading found no collector in the build; the host now answers ${ext('https://vote.radixdao.org/account-votes?type=proposal&amp;entityId=0', 'vote.radixdao.org/account-votes')} with every voting account and the weight assigned to it, the per-account view the Foundation build never exposed in public. The weight is still computed off-ledger from balances at the snapshot by whoever runs that endpoint, so the trust assumption the ${ext('https://blog.oter.io/posts/xrd-governance-design-disclosure', 'OTER disclosure')} names is unchanged; what has changed is that the arithmetic can be checked account by account.</p>
<p>The ${ext(FND_COMPONENT, 'Foundation instance')} moved as well, after being described on 4 August as staying up only until the Foundation winds down. Its certificate was reissued on 25 August, so the links on this page to TC 4 through 6 and Proposals 1 and 2 open again, and the collector at api-consultation.mountain-top.live, which answered 404 at its root in August, serves the same two endpoints for that instance. Its counts have gone from seven temperature checks and three proposals on 11 August to eight and four: ${ext('https://consultation.mountain-top.live/tc/7', 'temperature check 7')} and ${ext('https://consultation.mountain-top.live/proposal/3', 'proposal 3')}, the Foundation's question of how to allocate the 443k USDC of Hyperlane collateral it hopes to recover, which ${int('/contents/history/hyperlane-asset-drain-2026#gp3-quorum', 'passed quorum on 1 October')} and closes on 4 October. For a week the two instances have been running a binding vote each, one for the DAO and one for the Foundation, which is the split Daffy set out on 4 August working as described.</p>`;

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
  if (blocks.some((b) => b.text?.includes(SENTINEL))) {
    console.log('  already applied, no write');
    process.exit(0);
  }
  const infobox = blocks.find((b) => b.type === 'infobox');
  const row = infobox.blocks.find((b) => b.text?.includes(LATEST_OLD));
  if (!row) throw new Error('Latest row not found');
  row.text = row.text.replace(LATEST_OLD, LATEST_NEW);
  blocks.push({ id: uid(), type: 'content', text: SECTION });

  const version = '1.6.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  (${blocks.length} blocks)`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
        'Both Consultation instances read live at epoch 345,748 (1 Oct 2026): the DAO component holds GP-PRE-1 as TC 0 (155 votes, Passed on-ledger, continuation to proposal 0) and proposal 0 (190 ballots, 1,836.5m XRD Approve from 186 accounts per vote.radixdao.org/vote-results, closes 15:18 UTC 2 Oct), elections 0; vote.radixdao.org now serves per-account tallies. Foundation component at 8 TCs / 4 proposals (TC 7, proposal 3 past quorum), certificate reissued 25 Aug. New section, Latest row.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
