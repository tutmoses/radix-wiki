// Sweep 397 (ecosystem rotation) — /ecosystem/caper described a governance system
// that was replaced three times after the page was written on 2 August 2026, and a
// "Caper Venture Fund" that does not exist.
//
// Sources, all opened: caper.network/wiki/governance/proposals dates the change from
// ballot-only to ballot-then-market (29 August 2026) and the redeployment of
// 7 September; /wiki/foundations/leaving-a-caper gives the two assertions the exit
// method makes; /wiki/foundations/what-a-founder-can-take gives the four-way split of
// a buy, in which the platform's slice goes to the Commons rather than to a fund.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ecosystem';
const SLUG = 'caper';
const SENTINEL = 'id="market-window"';

const EDITS = [
  ['summary exit claim',
   'The platform employs a unique governance system that calculates voting power and treasury exit rights based on both token holdings and historical voting participation, creating economic incentives for sustained community engagement.',
   'The platform employs a governance system that calculates voting power from both token holdings and voting history, and settles a member&#39;s claim on the treasury against a non-transferable stake token that trading and voting both mint. Since 29 August 2026 a proposal has had to survive two independent tests rather than one: a ranked ballot, and then a window in which the caper&#39;s own market can object.'],

  ['market window section',
   '<h3>Legislative and Executive Proposals</h3>',
   `<h3 id="market-window">The Market Window</h3>
<p>Clearing the ballot is not the whole test. Since 29 August 2026 the winning option has to survive a second phase in which the caper&#39;s own market can object. Someone triggers the winner, which locks the caper&#39;s trailing average token price as a baseline and opens a market window, and the treasury performs the action only if the average price across that window finishes at or above the baseline. Holding through the window counts as consent, buying as support, and selling is the objection. <a href="https://caper.network/wiki/governance/proposals" target="_blank" rel="noopener">Caper&#39;s own account of the mechanism</a> dates this and the two arrangements before it: until 26 August 2026 a caper decided by ranked ballot alone, from 26 to 28 August the ballot was removed and price decided on its own, and the deployment of 7 September 2026 keeps both phases and measures the window as an exact price-time integral.</p>
<h3>Legislative and Executive Proposals</h3>`],

  ['commons slice, not a venture fund',
   '<p>The Caper Venture Fund&#39;s automatic stake acquisition in new projects creates ongoing relationships between the platform and launched DAOs. Projects receiving CVF support gain access to promotional opportunities, technical assistance, and potential partnership networks that can accelerate growth and improve operational effectiveness.</p>',
   '<p>No separate fund selects projects to back. What connects the platform to every caper launched on it is a slice of each purchase, taken in the same contract call that mints the buyer&#39;s tokens: the trade fee goes to that caper&#39;s own treasury, the founder takes a slice of the payment and a slice of the tokens, and a smaller token slice goes to the Commons, which is the treasury of the platform&#39;s own caper. The platform accrues its position in a caper trade by trade rather than being granted one, and the split is <a href="https://caper.network/wiki/foundations/what-a-founder-can-take" target="_blank" rel="noopener">documented against the contract method that performs it</a>.</p>'],

  ['exit gate',
   'Member departure from capers occurs through the combination of token liquidation and treasury claim realization based on accumulated vote weight. Long-term participants who have contributed substantially to governance processes can realize significantly greater returns than passive token holders, reflecting their contribution to organizational value creation.',
   'A member leaves by calling the caper&#39;s <code>exit</code> method. It is not a proposal, so it is not voted on and needs nobody&#39;s approval, and the contract checks only that the member holds some of that caper&#39;s governance tokens and some of its non-transferable stake token. Stake tokens are minted by taking part: one for each ranked ballot cast, and 0.01 for every XRD traded. A member who has only ever bought can therefore exit, and one who has also voted leaves with a larger claim on the treasury. <a href="https://caper.network/wiki/foundations/leaving-a-caper" target="_blank" rel="noopener">Caper states the gate as those two assertions</a>.'],
];

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (blocks.some((b) => (b.text || '').includes(SENTINEL))) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  let text = blocks[0].text;
  for (const [label, find, sub] of EDITS) {
    if (!text.includes(find)) throw new Error(`find-string missed: ${label}`);
    text = text.replace(find, sub);
    console.log(`  ok: ${label}`);
  }
  blocks[0].text = text;

  const version = '2.2.0';
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
       'Corrects three mechanics against Caper\'s own documentation: governance has had a second, market-based phase since 29 August 2026; the exit gate is a stake token minted by trading as well as voting, not accumulated vote weight; and there is no Caper Venture Fund, only a per-buy token slice to the Commons.', now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
