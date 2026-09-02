import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

// Run 341, ecosystem rotation. The page's departure section stops on 19-21 August with an
// open note ("the change had not been made"). Twelve days on, measured rather than assumed:
// the sunset page has not appeared, the DEX is still trading and still soliciting liquidity,
// LSULP has lost 12% of supply, the validators have not moved, and the "A New Chapter"
// rewrite was deployed the day BEFORE the announcement, not the same day.

const TAG_PATH = 'ecosystem';
const SLUG = 'caviarnine';
const SENTINEL = 'Twelve days on: what actually changed';
const DRY = process.argv.includes('--dry-run');

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

const HQ_OLD = '<tr><td><strong>HQ</strong></td><td>Bangkok, Thailand (<a href="https://docs.caviarnine.com/introduction/team" target="_blank" rel="noopener">team</a>)</td></tr>';
const HQ_NEW = '<tr><td><strong>Entities</strong></td><td><a href="https://docs.caviarnine.com/introduction/terms-and-conditions" target="_blank" rel="noopener">CaviarNine Limited</a> (British Virgin Islands) and Caviar Labs (Singapore)</td></tr>';

const CHANGE_OLD = 'The change had not been made when this page was updated: <a href="https://www.caviarnine.io" target="_blank" rel="noopener">caviarnine.io</a> was still serving the full trading interface on 19 August 2026.';
const CHANGE_NEW = 'The change had not been made on the day of the announcement, and it had not been made twelve days later either: <a href="https://www.caviarnine.io" target="_blank" rel="noopener">caviarnine.io</a> was serving the full trading interface on 19 August 2026 and again on 31 August 2026, measured in <em>Twelve days on</em> below.';

const REWRITE_OLD = 'Its website was rewritten the same day as "A New Chapter", describing a team that now builds';
const REWRITE_NEW = `Its website at <a href="https://www.caviarnine.com" target="_blank" rel="noopener">caviarnine.com</a> was rewritten as "A New Chapter" no later than 18 August 2026, the day before the announcement rather than the same day as it: the build served on 31 August 2026 came back from Vercel's London edge with an <code>age</code> of 1,144,107 seconds, which places the deployment that produced it at or before 05:20&nbsp;UTC on 18 August. It describes a team that now builds`;

const ROSTER_OLD = 'as a Web3 software house, with the Radix products listed alongside earlier decommissioned ones.';
const ROSTER_NEW = 'as a Web3 software house. The roster that page printed on 31 August 2026 runs to eight items in four states: Cantex on the Canton Network; three Radix products carried as live, <a href="/ecosystem/surge" rel="noopener">Surge</a>, <a href="https://www.justlock.io" target="_blank" rel="noopener">JustLock</a> and the CaviarNine DEX itself; QubitSwap marked in development; and DSOR and <a href="/ecosystem/radit" rel="noopener">Radit</a> marked decommissioned. A company that has said goodbye to Radix still lists three Radix products among the five it is not decommissioning.';

const ANCHOR = '<h3>Why, and the numbers behind it</h3>';

const SECTION = `<h3>${SENTINEL} (31 August 2026)</h3>
<p>The sunset page has not appeared. On 31 August 2026, twelve days after the announcement and ten after the correction that promised a front end "supporting remove LP only", <a href="https://www.caviarnine.io" target="_blank" rel="noopener">caviarnine.io</a> was serving the complete application: a navigation bar of Trade, Earn, Tokens, Portfolio, Charts and Ignition, a trade card offering Swap, Limit and Liquidity with a live quote of 1&nbsp;XRD to 0.00084051&nbsp;hUSDC, a cross-chain swap entry labelled NEW, and no notice of the wind-down anywhere on the page. The Shape Liquidity page was still soliciting new positions in its own words: "Choose your pool below with the tokens you would like to be exposed to. If that pool of tokens doesn't exist you can create one."</p>
<p>It is also still trading. The operator's own pool table listed <strong>36 main pools</strong> holding <strong>$78,150</strong> and carrying <strong>$144,759</strong> of volume over the preceding seven days, led by XRD/hUSDC at $36,585, hWBTC/hUSDC at $35,374 and hETH/hUSDC at $25,469. Those are the site's own figures rather than a third party's, and they describe a venue in operation rather than one closing.</p>
<p>What has moved is the liquidity. <strong>LSULP</strong>'s total supply, read live at epoch <strong>339,774</strong> (31 August 2026, 11:06&nbsp;UTC), stood at <strong>235,758,772.06</strong>, against the 267,774,125.70 read at epoch 336,318 on the day of the announcement: <strong>32,015,353.64 units redeemed in twelve days, 12.0%</strong>, or about one per cent of the pool a day, sustained. The front end is inviting deposits and the pool is draining at the same time, which is the practical shape of a wind-down announced but not yet carried out.</p>
<p>The validators have not followed. At epoch <strong>339,775</strong> both CaviarNine validators were registered and charging a zero fee, with <strong>CaviarNine-2</strong> at 115,634,605.92&nbsp;XRD and <strong>CaviarNine-1</strong> at 113,591,258.13. CaviarNine-2 had shed 4,022,122&nbsp;XRD between 25 and 30 August; over the day to 31 August it gained 24,508 while CaviarNine-1 gave up 110,474, so the pair moved by less than a tenth of a per cent between them. The outflow that followed the announcement has stopped rather than accelerated: delegated stake is not leaving with the pool liquidity.</p>
`;

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${TAG_PATH}/${SLUG} is LOCKED`);

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied - no write');
    process.exit(0);
  }

  const ib = blocks[0].blocks[0];
  const d = blocks[1];
  const checks = [
    ['infobox HQ row', ib.text.includes(HQ_OLD)],
    ['change-had-not sentence', d.text.includes(CHANGE_OLD)],
    ['rewritten-same-day clause', d.text.includes(REWRITE_OLD)],
    ['roster clause', d.text.includes(ROSTER_OLD)],
    ['anchor heading', d.text.includes(ANCHOR)],
  ];
  for (const [name, ok] of checks) if (!ok) throw new Error(`find-string missing: ${name}`);

  ib.text = ib.text.replace(HQ_OLD, HQ_NEW);
  d.text = d.text
    .replace(CHANGE_OLD, CHANGE_NEW)
    .replace(REWRITE_OLD, REWRITE_NEW)
    .replace(ROSTER_OLD, ROSTER_NEW)
    .replace(ANCHOR, SECTION + ANCHOR);

  const version = '5.4.0';
  const now = new Date().toISOString();
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  infobox HQ row -> Entities row (docs.caviarnine.com/introduction/team is 404)`);
  console.log(`  + section "${SENTINEL}" (${SECTION.length} chars) before "Why, and the numbers behind it"`);

  if (!DRY) {
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query(
      'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Twelve days on, measured: the promised sunset page has not appeared (caviarnine.io served the full app on 31 Aug, Liquidity tab live, Shape Liquidity still inviting new pools, 36 main pools, $78,150 TVL, $144,759 7d volume), LSULP supply is down 32,015,353.64 units (12.0%) from the announcement-day read at epoch 336,318 to 235,758,772.06 at epoch 339,774, and both validators are steady at epoch 339,775. Corrects "rewritten the same day": the A New Chapter build was deployed at or before 18 Aug 05:20 UTC, a day before the announcement (Vercel edge age 1,144,107s). Infobox HQ row replaced - docs.caviarnine.com/introduction/team now 404s, so the Bangkok claim lost its source; the incorporated entities cited from the live terms page instead.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
