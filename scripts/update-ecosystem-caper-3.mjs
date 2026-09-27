/**
 * update-ecosystem-caper-3 (caper sweep #478, foundations rotation). /ecosystem/caper's
 * "Legislative and Executive Proposals" subsection, read against the deployed
 * contract at caper HEAD 92028c7 on 27 September 2026.
 *
 * It described a non-binding "legislative proposal" type, an execution delay
 * that exists so dissenters can exit first, and proposal and ballot fees that
 * "fund platform operations". In the contract every option sits on one ranked
 * ballot; kinds 0/1/3/4/5 execute after the market window and kind 6 (DEBATE)
 * executes nothing and trigger_proposal refuses it (caper
 * contracts/common/src/lib.rs); the creation fee is deposited irrevocably into
 * the caper's treasury (contracts/core/src/caper_dao.rs create_proposal) and the
 * ballot fee is banked to the treasury at cast (contracts/logic/src/lib.rs
 * VOTE_FEE). The threshold is a share of weight cast, with no turnout quorum.
 *
 * VOICE.md §4 Caper overlay: outcome level, no fee amounts or shares in prose.
 *
 * Idempotent: skipped if the sentinel is already stored.
 */
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, assertLinkShapes, withClient } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ecosystem';
const SLUG = 'caper';
const SENTINEL = 'Proposals That Act and Proposals That Debate';
const VERSION = '2.6.0';

const EDITS = [
  ["<h3>Legislative and Executive Proposals</h3>", "<h3>Proposals That Act and Proposals That Debate</h3>"],
  ["<p>The governance system distinguishes between two types of proposals: legislative proposals that serve as non-binding signals of community intention, and executive proposals that trigger specific blockchain transactions upon approval. Executive proposals include a mandatory execution delay following vote completion, allowing members who disagree with outcomes to exercise exit rights before implementation. This mechanism ensures member autonomy while maintaining community decision-making authority.</p>",
   "<p>Most options on a proposal carry an action the treasury performs if the option wins and survives the market window: a payment to any Radix account, an investment in another caper&#39;s token or the sale of one, a change to how the caper&#39;s own token is presented, and, for the platform&#39;s own caper only, an upgrade of the platform&#39;s logic. A debate option carries no action. It is ranked and can win like any other, and there the proposal ends, with no market window because there is nothing to execute. <a href=\"https://caper.network/wiki/foundations/paying-someone-from-a-caper\" target=\"_blank\" rel=\"noopener\">Caper&#39;s page on paying from a treasury</a> lists each kind against the contract.</p>"],
  ["<p>Proposal creation and vote submission both require fees to deter spam and fund platform operations. Combined with the vote weight incentive system, this fee structure eliminates the need for traditional\u00a0<a href=\"https://en.wikipedia.org/wiki/Quorum\">quorum</a>\u00a0requirements, enabling more agile governance where uncontroversial proposals can pass with relatively low turnout while still maintaining security against manipulation.</p>",
   "<p>Creating a proposal and casting a ballot each cost a fee, and both are paid into the caper&#39;s own treasury rather than to the platform; the creation fee is kept whether the proposal passes or fails. There is no turnout <a href=\"https://en.wikipedia.org/wiki/Quorum\" target=\"_blank\" rel=\"noopener\">quorum</a>. An option passes on its share of the weight actually cast, so a proposal few members care about can pass on a small vote, and it still has to survive the market window.</p>"],
];

const MESSAGE =
  "Legislative and Executive Proposals described an older Caper: a non-binding legislative proposal type, an execution delay granted so dissenters could exit first, and fees that fund platform operations. In the deployed contract every option is ranked on one ballot; five kinds execute an action after the market window (PAYOUT, INVEST, DIVEST, METADATA, UPGRADE for $CAPER only) and DEBATE executes nothing and skips the window (caper contracts/common/src/lib.rs ProposalOptionData.kind); the 500 XRD creation fee is banked by the caper and kept on pass or fail (contracts/core/src/caper_dao.rs create_proposal) and the 100 XRD ballot fee is banked to the caper's treasury (contracts/logic/src/lib.rs VOTE_FEE); exit is open at any time rather than in a delay. Rewritten at outcome level, read 27 September 2026 at caper HEAD 92028c7. Filed by caper sweep #478 (foundations rotation).";

const replaceOnce = (haystack, needle, replacement) => {
  const i = haystack.indexOf(needle);
  if (i < 0) throw new Error(`string not found: ${JSON.stringify(needle.slice(0, 70))}`);
  if (haystack.indexOf(needle, i + 1) >= 0) throw new Error(`string is not unique: ${JSON.stringify(needle.slice(0, 70))}`);
  return haystack.slice(0, i) + replacement + haystack.slice(i + needle.length);
};

await withClient(async (client) => {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${TAG_PATH}/${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
    [TAG_PATH, SLUG],
  );
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  if (JSON.stringify(page.content).includes(SENTINEL)) {
    console.log('  already applied - no write');
    return;
  }
  const blocks = JSON.parse(JSON.stringify(page.content));
  for (const [from, to] of EDITS) {
    const target = blocks.find((b) => (b.text || '').includes(from));
    if (!target) throw new Error(`no block holds ${JSON.stringify(from.slice(0, 60))}`);
    target.text = replaceOnce(target.text, from, to);
  }
  assertLinkShapes(blocks, page.title);
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${VERSION}  (${EDITS.length} edits)`);
  if (DRY) return;
  const now = new Date().toISOString();
  const json = JSON.stringify(blocks);
  await client.query('BEGIN');
  await client.query(
    'UPDATE pages SET content = $1, version = $2, updated_at = $3, last_verified_at = $3 WHERE id = $4',
    [json, VERSION, now, page.id],
  );
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, VERSION, 'minor', AUTHOR_ID, MESSAGE, now],
  );
  await client.query('COMMIT');
});
