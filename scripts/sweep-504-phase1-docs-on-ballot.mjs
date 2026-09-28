/**
 * Sweep 504 – ideas rotation, second slice. /ideas/dao-adopt-phase1-governance-docs
 * still said on 28 September that GP-PRE-1 had no submission or vote date and that
 * the 6 September amendments lived only in the personal repository. Both were
 * overtaken: the ballot opened 25 September, and RadixDAO/governance-framework
 * took nine commits on 18-19 September.
 *
 * Read 2026-09-28 ~19:10 UTC:
 *   vote.radixdao.org/vote-results?type=proposal&entityId=0 – option 0 (for) only,
 *     1,605,496,435 voting power; /account-votes – 174 entries.
 *   git clone RadixDAO/governance-framework, 15 commits, head 470a047 (20 Sep).
 *     ef7a213..9d75687 (18 Sep) amend Charter 12.2, Dispute Resolution 7, RAC-member
 *     misconduct routing, Election Methods Guide; 9b490d1..725af3e (19 Sep) Temperature
 *     Check floor; dfe938c (19 Sep) re-signs 12 PDFs and updates the GP-PRE-1 manifest
 *     (message names Charter, Parameters Registry, P&V Framework, Compliance Operations,
 *     Dispute Resolution as amended in the discussion window).
 *   Unchanged since de48c49 (27 Aug): execution-and-treasury-actions-policy.md
 *     (5.3 line 98 still "Where RAC determines that a refusal is invalid ... may instruct
 *     remaining signers to proceed with execution directly", no 8.2 carve-out),
 *     roles-registry.md (line 122 "The mechanism is selected by the RAC when it creates
 *     the election"), source-code-stewardship-policy.md (6.1 has no start for the
 *     patch timelines). Shadaffy/radix-dao-governance pushed_at 2026-09-06T21:30:55Z.
 */
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage, withClient } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ideas';
const SLUG = 'dao-adopt-phase1-governance-docs';
const VERSION = '2.2.0';
const SENTINEL = 'on-the-ballot-28-september-2026';
const REPO = 'https://github.com/RadixDAO/governance-framework';

const SWAPS = [
  [
    '<th>Latest</th><td>8 Sep 2026 – Discussion phase open-ended; the 6 Sep amendments are in the personal repo, not the DAO\'s</td>',
    '<th>Latest</th><td>28 Sep 2026 – GP-PRE-1 on ballot until 2 Oct, quorum passed 27 Sep, no vote against</td>',
  ],
  [
    '<li>Submit GP-PRE-1 and open the vote; no submission or vote date is published.</li>',
    '<li>Submit GP-PRE-1 and open the vote. Done – on ballot from 25 September to 2 October 2026.</li>',
  ],
  [
    '<li>Publish which deployment the vote runs on \u2014 <a href="/ideas/dao-governance-app-consultation-v2" rel="noopener">the DAO-dedicated Consultation instance</a> at vote.radixdao.org, or the older consultation.mountain-top.live that ran the first three votes.</li>',
    '<li>Publish which deployment the vote runs on. Done – <a href="/ideas/dao-governance-app-consultation-v2" rel="noopener">the DAO-dedicated Consultation instance</a> at vote.radixdao.org.</li>',
  ],
  [
    `Record the ratified versions in <a href="https://github.com/Shadaffy/radix-dao-governance" target="_blank" rel="noopener">the operative repository</a>`,
    `Record the ratified versions in <a href="${REPO}" target="_blank" rel="noopener">the operative repository</a>`,
  ],
];

const HTML =
  `<h2 id="${SENTINEL}">On the ballot (28 September 2026)</h2>`
  + '<p>GP-PRE-1 went to its binding vote on 25 September at '
  + '<a href="https://vote.radixdao.org/proposal/0" target="_blank" rel="noopener">vote.radixdao.org</a>, '
  + 'after a five-day Temperature Check that approved it with 99.4%. It passed its 1,351m XRD quorum on '
  + '27 September, and at 19:10 UTC on 28 September the ballot page tallied 1,605m XRD of voting power in '
  + 'favour from 174 accounts, with none against or abstaining. The vote closes at 15:18 UTC on 2 October. '
  + '<a href="/ideas/radix-network-dao-charter" rel="noopener">The Charter card</a> follows the ballot day '
  + 'by day.</p>'
  + '<p>The text on the ballot is the one in the DAO\'s own repository, which answers the question the '
  + '8 September section left open. <a href="' + REPO + '/commits/main" target="_blank" rel="noopener">'
  + 'RadixDAO/governance-framework</a> took nine commits on 18 and 19 September: amendments from the '
  + 'discussion to the Charter, the Parameters Registry, the Proposal &amp; Voting Framework, Compliance '
  + 'Operations and Dispute Resolution, then twelve PDFs re-rendered and re-signed, with the GP-PRE-1 '
  + 'manifest updated to their hashes. Three of the review fixes Daffy reported on 6 September are not in '
  + 'the balloted text: the three documents they touch have not changed in that repository since 27 August. '
  + 'Execution &amp; Treasury Actions §5.3 still lets the RAC instruct signers past any refusal it '
  + 'judges invalid; the Roles Registry still reads that the RAC selects the election mechanism when it '
  + 'creates the election; and Source Code Stewardship still does not say when the 72-hour Critical patch '
  + 'window starts. The personal repository that carries those fixes has not been pushed since '
  + '6 September.</p>';

await withClient(async (client) => {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log(`  already carries "${SENTINEL}" – no write`);
    return;
  }
  const texts = (bs) => bs.flatMap((b) => (b.blocks ? texts(b.blocks) : [b]));
  for (const [from, to] of SWAPS) {
    const hit = texts(blocks).filter((b) => typeof b.text === 'string' && b.text.includes(from));
    if (hit.length !== 1) throw new Error(`swap matched ${hit.length}: ${from.slice(0, 60)}`);
    hit[0].text = hit[0].text.replace(from, to);
  }
  blocks.push({ id: uid(), type: 'content', text: HTML });

  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${VERSION}`);
  if (DRY) { console.log(HTML.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')); return; }

  const now = new Date().toISOString();
  const json = JSON.stringify(blocks);
  await client.query('BEGIN');
  await client.query(
    'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
    [json, VERSION, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, VERSION, 'minor', AUTHOR_ID,
      'Run 504: GP-PRE-1 is on ballot (25 Sep to 2 Oct), quorum passed 27 Sep, 1,605m XRD for from 174 '
      + 'accounts at 19:10 UTC 28 Sep (vote.radixdao.org JSON). New section on-the-ballot-28-september-2026: '
      + 'the DAO repo took nine commits on 18-19 Sep and re-signed 12 PDFs, so it carries the balloted text; '
      + 'three 6 Sep review fixes (E&T 5.3, Roles Registry election mechanism, patch clock) are absent from its '
      + 'sources. Latest row, two deliverables and the operative-repository link updated.',
      now]);
  await client.query('COMMIT');
});
