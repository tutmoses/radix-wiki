// sweep 409 — split the Hyperlane drain page.
//
// The page had grown to 17,000 words across 38 blocks, 74% of it a dated
// chronology written while the outage was live. With the network back the
// chronology is a record rather than the news, and a reader arriving now has to
// read twelve days of provisional readings — several of which the page later
// corrects — to learn what happened and that it is over.
//
// This moves the twenty-three chronology blocks to a new page under the same tag
// and replaces them on the article with one summary section. Nothing is deleted.
//
// It also settles three things the restart sweep left behind:
//   * "The halt" still cites 21:19:06.179 / 557,840,622 as the last round. The
//     transaction stream showed the ledger ran five state versions further; the
//     correction lived only in the block that is moving out.
//   * The lead still says the network "has produced no round since".
//   * "What is unresolved" says two questions stand and then lists three.
//
// Run:  node scripts/sweep-409-drain-split.mjs [--dry-run]

import pg from 'pg';
import { config } from 'dotenv';
import { bump } from 'wiki-formant/versioning';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'contents/history';
const SLUG = 'hyperlane-asset-drain-2026';
const TIMELINE_SLUG = 'hyperlane-asset-drain-2026-timeline';
const TIMELINE_HREF = `/${TAG_PATH}/${TIMELINE_SLUG}`;
const ARTICLE_HREF = `/${TAG_PATH}/${SLUG}`;
const SENTINEL = 'the-fix-and-the-restart';

/** The h2 ids of every block that leaves the article, in the order they carry. */
const MOVE = [
  'day-two', 'shape-of-the-fix', 'standing-decision', 'day-three-instruments',
  'day-three-foundation', 'day-three-council-returns',
  'day-three-evening-first-technical-account', 'day-four-two-prices',
  'day-five-the-fix-is-on-github', 'day-six-the-paperwork-moves',
  'day-seven-the-repository-moves', 'day-eight-the-restart-gets-a-forecast',
  'day-eight-evening-the-fix-merges', 'day-eight-night-not-enough',
  'day-nine-the-node-half', 'day-nine-afternoon-the-build',
  'day-nine-evening-the-release-candidate', 'day-ten-stokenet', 'day-ten-night',
  'day-eleven-hold', 'sweep405-day-twelve', 'sweep408-restart',
  'reading-your-own-account',
];

/** Moves last, as an appendix: it is a how-to for an outage rather than a day. */
const APPENDIX = 'reading-your-own-account';

// ---------------------------------------------------------------------------
// The summary section that replaces the chronology on the article.
// ---------------------------------------------------------------------------

const SUMMARY = `<h2 id="${SENTINEL}">The fix, and the restart</h2>
<p>Radix mainnet was down for <strong>254 hours, 15 minutes and 40 seconds</strong>, and for most of them the only public account of the repair was a Telegram channel. What follows is the summary. The day-by-day record, with the ledger and repository readings each statement was checked against at the hour it was made, is on <a href="${TIMELINE_HREF}" rel="noopener">a separate page</a>.</p>
<h3 id="the-four-steps">The four steps</h3>
<p>At 12:16&nbsp;UTC on 1 September the <a href="/ecosystem/radix-accountability-council" rel="noopener">Radix Accountability Council</a> published the shape of the repair, and it did not change: code fixes to the Radix Engine; updates to the node software carrying a protocol upgrade; a coordinated deployment of those across nodes; and a coordinated return to liveness. It attached no dates, and none of the four acquired one until the third. The Foundation's announcement channel spoke twice in the whole outage, on 31 August and at 08:58&nbsp;UTC on 2 September, and the second post pointed readers to the council for anything further. Its blog carried nothing at all.</p>
<p>The first two steps were written by one contributor and were readable in public before anyone said so. The last two needed the few dozen node operators who had agreed the halt among themselves, and they are what the ten days were spent on.</p>
<h3 id="eagle-ray-engine-half">Eagle Ray: the Engine half</h3>
<p>The fix was written on the night of the drain. <a href="https://github.com/radixdlt/radixdlt-scrypto/pull/2093" target="_blank" rel="noopener">Pull request #2093</a> against radixdlt-scrypto was opened at 12:26&nbsp;UTC on 2 September by 0xOmarA, the contributor whose forensic notes this page records from the first night, and its earliest commit is dated 22:41&nbsp;UTC on 31 August &ndash; one hour and twenty-two minutes after the last round. The commit that adds the receiver check is dated 00:12&nbsp;UTC on 1 September, hours before the first official update said anything in public.</p>
<p>Its content is a flash protocol update named <a href="/contents/tech/releases/protocol-updates" rel="noopener">Eagle Ray</a>, which advances the system logic from <code>SystemVersion::V4</code> to <code>V5</code>, and V5 turns on a single check. Before an invocation runs, the system asks whether the calling frame can actually see the node whose method it is calling &ndash; direct methods, the type used for recall and other direct vault access, requiring direct visibility of the receiver &ndash; and rejects the call otherwise with a new <code>SystemError::InvalidInvokeAccess</code>. That is the handle nobody tried, given a lock. The test it rewrites is <code>test_recall_on_internal_vault</code>, which used to fail obscurely inside the kernel's frame construction and now fails cleanly at the system layer.</p>
<p>It then sat unreviewed for five days. A seventh commit landed at 16:50&nbsp;UTC on 7 September and the branch merged forty-three minutes later, at 17:33:31; ninety seconds after that <a href="https://github.com/radixdlt/radixdlt-scrypto/releases/tag/v1.4.0" target="_blank" rel="noopener">Scrypto v1.4.0</a> was published, the first Scrypto release since January 2026, with the repository's licence text as its release notes and no description of the flaw, the fix or the update. The merge touches 587 files, but 538 of those are transaction-scenario receipts regenerated under the new protocol version; the engine change is 80 lines, plus 43 in the system callback that runs the check.</p>
<h3 id="the-node-half">The node half, and the epoch it named</h3>
<p><a href="https://github.com/radixdlt/babylon-node/pull/1076" target="_blank" rel="noopener">Pull request #1076</a> against <a href="/contents/tech/core-protocols/babylon-node" rel="noopener">babylon-node</a>, the software every validator runs, opened at 06:00&nbsp;UTC on 8 September from the same author with no description, and it carried the first public answer to what a restart would look like. <code>EAGLE_RAY_ENACTMENT_EPOCH</code> is set to <strong>339,898</strong> with the trigger <code>EnactAtStartOfEpochUnconditionally</code>, which makes it the only protocol update in Radix's mainnet history that does not wait for the validator set to signal readiness. Anemone, Bottlenose and Cuttlefish each required validators holding 75% of stake to signal over days or weeks; this one enacts on an epoch number alone.</p>
<p>The same pull request added a subsystem the node did not have, a <strong>user transaction moratorium</strong>: a range of epochs in which consensus continues and user transactions are refused. Mainnet got exactly one range, epoch 339,897 inclusive to 339,898 exclusive, commented for the incident. Three places enforce it &ndash; the mempool, the consensus pacemaker's vote, and a verifier on proposals arriving from other nodes &ndash; so a node that skipped the update could still propose a user transaction and the rest would decline to vote for it.</p>
<p>It merged at 15:28&nbsp;UTC on 8 September, with no reviews and no comments, after being force-pushed and retargeted from <code>develop</code>, whose tip had not moved since March 2025, onto <code>main</code>, the line the releases actually come from. A release candidate followed seven minutes later.</p>
<p>The final release, <a href="https://github.com/radixdlt/babylon-node/releases/tag/v1.4.0.0" target="_blank" rel="noopener">v1.4.0.0</a> at 03:59&nbsp;UTC on 10 September, resolves to the same commit as that candidate: byte for byte identical, with the pre-release flag as the only difference. The flag is not cosmetic. GitHub reports as latest the newest release that is neither a draft nor a pre-release, so from 8 to 10 September the answer was <code>v1.3.0.5-test.1</code> &ndash; a rebuild of the exact version mainnet halted on &ndash; and that is what the <code>babylonnode</code> installer fetched. An operator running a standard install on 10 September got the fix. The day before, they got the flaw.</p>
<h3 id="deployment-then-liveness">Deployment, and then liveness</h3>
<p>The update was rehearsed before it was run. The council reported at 18:43&nbsp;UTC on 9 September that Stokenet, the public test network, had taken the new software and protocol end to end, and Stokenet's own ledger corroborates it in the way that matters to someone waiting on mainnet: sampled hourly it never dropped a beat, committing exactly twelve epochs in each of the twenty-eight hours around the deployment. That is what a protocol update is meant to look like from outside, which is also why an unbroken ledger is not by itself proof that one enacted.</p>
<p>Operators were told to wait three times: on 7 September because a library release is not a node build, on 8 September because a candidate is not a release, and again at 09:13&nbsp;UTC on 10 September when a final build existed and the coordination did not. The instruction changed at 16:15&nbsp;UTC that day &ndash; upgrade now, from official sources, and leave a healthy node online &ndash; and nothing published after it named a time. That was deliberate. Asked on the morning of 11 September whether an announcement would precede the fork, Daffy answered that there would be none, because the moment could not be predicted, and gave the order plainly as secure liveness first, announce after.</p>
<p>At 07:12&nbsp;UTC on 11 September <a href="/ecosystem/stakesafe" rel="noopener">StakeSafe</a>'s <a href="https://validators.stakesafe.net" target="_blank" rel="noopener">adoption dashboard</a> read 31.22% of active validator-set stake on v1.4.0.0, and the twelve largest validators all read a v1.3 version and all read offline. That was not a stalled upgrade. Faraz said so in the main Radix group at 10:11&nbsp;UTC: the largest nodes were upgraded and waiting to boot together, so that the network would come back well clear of two thirds rather than marginally above it. The dashboard reports the version a node last advertised, so an offline validator shows whatever it was running when it stopped.</p>
<h3 id="eleven-september">11 September</h3>
<p>Radix mainnet committed a round at <strong>11:35:28.96&nbsp;UTC on 11 September 2026</strong>, its first in ten days, at epoch 339,897 round 5. That epoch then ran to round 106 under the moratorium and every ledger entry in the window is a system transaction, which is the moratorium working: consensus certifying rounds and refusing user payloads. At the start of epoch 339,898 the fork enacted and the moratorium lifted together, and at <strong>11:39:25.129&nbsp;UTC</strong> round 2 of that epoch committed 17 user transactions at once, five of them failing, as a queue ten days old cleared. Just under four minutes of empty blocks separate the network coming back from the network being usable. Read at 13:10&nbsp;UTC, 80.85% of a 4,873,528,908&nbsp;XRD active set was on the release.</p>
<p>The first published test of the fix is on the ledger, and it is the exploit. At 12:35:05.915&nbsp;UTC <a href="https://dashboard.radixscan.io/transaction/txid_rdx1n23szuw226jqjhqt2v8zeguwh545xlyarmwfg0g3dgcsfy4dnceqf4a269/summary" target="_blank" rel="noopener">a transaction</a> published a package to mainnet whose blueprint is named <code>VaultDrainer</code>, with methods <code>drain</code> and <code>drain_victim_pays</code>. It committed successfully for a fee of 14.14&nbsp;XRD, which is a package publish succeeding rather than a drain succeeding. The operator who submitted it said so in the developer group a minute earlier: it is the drainer that had been run against the unpatched network throughout testing, put on mainnet to verify the fix is operative against live vaults.</p>
<p>No official channel announced any of it. The council's most recent message is still the upgrade instruction of 10 September, and <a href="https://docs.radixdlt.com/docs/eagle-ray" target="_blank" rel="noopener">the documentation page for Eagle Ray</a> still answered HTTP 404 hours after the update it is supposed to document enacted on mainnet.</p>`;

// ---------------------------------------------------------------------------
// Corrections to blocks that stay.
// ---------------------------------------------------------------------------

const EDITS = [
  // The lead: the network is no longer stopped.
  {
    where: 'lead',
    from: 'At 21:19 UTC Radix mainnet was halted by its node runners and has produced no round since.',
    to: 'At 21:19 UTC Radix mainnet was halted by its node runners, and it produced no round for the next ten days; the <a href="/contents/tech/releases/protocol-updates" rel="noopener">Eagle Ray</a> protocol update enacted and transactions resumed at 11:39&nbsp;UTC on 11 September 2026.',
  },
  // "The halt": the boundary the restart reading corrected, and past tense.
  {
    where: 'the halt, opening',
    from: 'Radix mainnet stopped producing rounds at <strong>21:19:06.179 UTC on 31 August 2026</strong>. The <a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">Gateway status endpoint</a> has reported the same ledger ever since — state version 557,840,622, epoch 339,896, round 102 — and every endpoint that reads state now refuses with <code>NotSyncedUpError</code>, a sync delay that grows by a second every second because the ledger no longer moves. That is why wallets, the dashboard and the explorers went dark within minutes of the halt: they are all reading the same stalled Gateway.',
    to: 'Radix mainnet committed its last round before the stop at <strong>21:19:48.939 UTC on 31 August 2026</strong> &ndash; state version 557,840,627, epoch 339,897, round 4. The <a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">Gateway status endpoint</a> reported a different ledger for the whole of the outage, state version 557,840,622 at epoch 339,896 round 102, timestamped 21:19:06.179&nbsp;UTC: its aggregator stopped five state versions short of the tip, and the gap was invisible for as long as neither number moved. Every endpoint that reads state refused with <code>NotSyncedUpError</code> for the next ten days, a sync delay that grew by a second every second because the ledger no longer moved. That is why wallets, the dashboard and the explorers went dark within minutes of the halt: they were all reading the same stalled Gateway.',
  },
  {
    where: 'the halt, third paragraph',
    from: 'The order of the evening matters, because the exploit was public knowledge before the network was stopped and the fix is not written yet.',
    to: 'The order of the evening matters, because the exploit was public knowledge before the network was stopped and the fix was not yet written.',
  },
  {
    where: 'the halt, third paragraph',
    from: 'No resumption time has been given. The Council\'s notice puts it plainly:',
    to: 'No resumption time was given that night, or for the ten days after it. The Council\'s notice put it plainly:',
  },
  {
    where: 'the halt, timeline table',
    from: '<td><strong>21:19:06.179</strong></td><td>Last round on the ledger — epoch 339,896, round 102, state version 557,840,622</td>',
    to: '<td><strong>21:19:48.939</strong></td><td>Last round on the ledger — epoch 339,897, round 4, state version 557,840,627</td>',
  },
  // "What is unresolved": the opening counts two and the section lists three.
  {
    where: 'what is unresolved',
    from: 'Two questions stand where three did, and the ledger can be asked about them again.',
    to: 'Three questions stand, and the ledger can be asked about them again.',
  },
];

/** Cross-references inside the moved blocks that pointed at blocks staying behind. */
const MOVED_EDITS = [
  {
    where: 'day three, instruments',
    from: 'for tokens whose remaining supply on Radix is the residue in the table above: 1,092.79 hUSDC and 0.036292 hUSDT',
    to: `for tokens whose remaining supply on Radix is the residue <a href="${ARTICLE_HREF}" rel="noopener">the article</a> records: 1,092.79 hUSDC and 0.036292 hUSDT`,
  },
  {
    where: 'day three, evening',
    from: '<a href="#the-cause">the code reading above</a>',
    to: `<a href="${ARTICLE_HREF}#the-cause" rel="noopener">the code reading in the article</a>`,
  },
  {
    where: 'reading your own account',
    from: '&mdash; the last one the ledger reached, at 21:19:06.179 UTC on 31 August &mdash;',
    to: '&mdash; the last one the Gateway reported, at 21:19:06.179 UTC on 31 August &mdash;',
  },
];

const EXTERNAL_LINKS_TAIL = '</ul>';
const SEE_ALSO = `<li><a href="${TIMELINE_HREF}" rel="noopener">Day-by-day record of the halt</a> &ndash; every reading this page summarises, in the order it was taken</li></ul>`;

const TIMELINE_LEAD = `<p>This is the day-by-day record of the ten days Radix mainnet spent halted after the <a href="${ARTICLE_HREF}" rel="noopener">Hyperlane asset drain</a> of 31 August 2026, from the first official update on 1 September to the restart at 11:35&nbsp;UTC on 11 September. The article it belongs to carries the incident, the cause and a summary of the repair; this is the working record underneath it.</p>
<p>Every entry states what was read, from where, and at what hour, and the readings are left as they were taken rather than edited to agree with what came later. One correction is worth knowing before reading them. The halt boundary cited throughout below, state version 557,840,622 at epoch 339,896 round 102, is the Gateway status endpoint's reading; after the restart the transaction stream showed the ledger had run five state versions further, to epoch 339,897 round 4 at 21:19:48.939&nbsp;UTC. The entries still carry the Gateway's number, because what each day could be checked against at the time is the point of keeping them.</p>`;

const TIMELINE_META = {
  date: '2026-09-11',
  type: 'Milestone',
  excerpt:
    'The ten days Radix mainnet spent halted after the Hyperlane asset drain, recorded a day at a time: the four-step repair, the Eagle Ray protocol update, the node release, and the restart on 11 September 2026.',
};

const applyEdit = (text, { from, to, where }) => {
  if (!text.includes(from)) throw new Error(`${where}: substring not found\n  ${from.slice(0, 90)}…`);
  return text.replace(from, to);
};

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  ssl: { rejectUnauthorized: false },
});
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);

  const { rows } = await client.query(
    'SELECT id, title, version, content, metadata FROM pages WHERE tag_path = $1 AND slug = $2',
    [TAG_PATH, SLUG],
  );
  if (!rows.length) throw new Error('article not found');
  const page = rows[0];

  if (JSON.stringify(page.content).includes(SENTINEL)) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  const blocks = JSON.parse(JSON.stringify(page.content));
  const idOf = (b) => (typeof b.text === 'string' ? (b.text.match(/<h2 id="([a-z0-9-]+)"/) || [])[1] : undefined);

  // 1. partition.
  const moving = [];
  const keeping = [];
  for (const b of blocks) (MOVE.includes(idOf(b)) ? moving : keeping).push(b);
  if (moving.length !== MOVE.length)
    throw new Error(`expected ${MOVE.length} blocks to move, matched ${moving.length}`);

  // The appendix is a how-to written for the outage, not a day in it; it goes last.
  const ax = moving.findIndex((b) => idOf(b) === APPENDIX);
  moving.push(...moving.splice(ax, 1));

  // 2. repoint the cross-references that pointed at blocks staying behind.
  for (const edit of MOVED_EDITS) {
    const i = moving.findIndex((b) => b.text.includes(edit.from));
    if (i < 0) throw new Error(`${edit.where}: cross-reference not found`);
    moving[i] = { ...moving[i], text: applyEdit(moving[i].text, edit) };
  }

  // 3. correct the blocks that stay, and drop the summary in where the chronology was.
  for (const edit of EDITS) {
    const i = keeping.findIndex((b) => typeof b.text === 'string' && b.text.includes(edit.from));
    if (i < 0) throw new Error(`${edit.where}: substring not found on any kept block`);
    keeping[i] = { ...keeping[i], text: applyEdit(keeping[i].text, edit) };
  }

  const li = keeping.findIndex((b) => typeof b.text === 'string' && b.text.includes('<h2>External links</h2>'));
  if (li < 0) throw new Error('external links block not found');
  keeping[li] = { ...keeping[li], text: applyEdit(keeping[li].text, { where: 'external links', from: EXTERNAL_LINKS_TAIL, to: SEE_ALSO }) };

  const oi = keeping.findIndex((b) => typeof b.text === 'string' && b.text.includes('<h2 id="off-the-chain">'));
  if (oi < 0) throw new Error('"What the halt does off the chain" block not found');
  keeping.splice(oi + 1, 0, { id: uid(), type: 'content', text: SUMMARY });

  const timelineBlocks = [{ id: uid(), type: 'content', text: TIMELINE_LEAD }, ...moving];

  const version = bump(page.version, 'major');
  const metadata = {
    ...(page.metadata && typeof page.metadata === 'object' ? page.metadata : {}),
    excerpt:
      'On 31 August 2026 twenty-six transactions emptied every Hyperlane-bridged asset on Radix. The cause was a Radix Engine flaw, the network was halted for ten days, and the Eagle Ray fix enacted on 11 September 2026.',
  };

  const words = (bs) =>
    bs.reduce((n, b) => n + String(b.text || '').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length, 0);

  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}`);
  console.log(`    v${page.version} -> v${version}`);
  console.log(`    article  ${blocks.length} blocks / ${words(blocks)}w -> ${keeping.length} blocks / ${words(keeping)}w`);
  console.log(`    timeline ${timelineBlocks.length} blocks / ${words(timelineBlocks)}w (new page ${TAG_PATH}/${TIMELINE_SLUG})`);

  if (!DRY) {
    const now = new Date().toISOString();
    const articleJson = JSON.stringify(keeping);
    const timelineJson = JSON.stringify(timelineBlocks);
    const timelineId = cuid();
    const title = 'Hyperlane Asset Drain and Network Halt: Day-by-Day Record';

    await client.query('BEGIN');

    const dup = await client.query('SELECT id FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, TIMELINE_SLUG]);
    if (dup.rows.length) throw new Error(`${TIMELINE_SLUG} already exists`);

    await client.query(
      `INSERT INTO pages (id, slug, title, content, tag_path, metadata, version, author_id, created_at, updated_at, last_verified_at)
       VALUES ($1,$2,$3,$4,$5,$6,'1.0.0',$7,$8,$8,$8)`,
      [timelineId, TIMELINE_SLUG, title, timelineJson, TAG_PATH, JSON.stringify(TIMELINE_META), AUTHOR_ID, now],
    );
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,'1.0.0','major',$5,$6,$7)`,
      [
        cuid(),
        timelineId,
        timelineJson,
        title,
        AUTHOR_ID,
        'Split out of hyperlane-asset-drain-2026: the twenty-two dated entries covering 1 to 11 September 2026, plus the pinned-read appendix, moved verbatim with their cross-references repointed at the article. New lead states that the readings are left as taken and that the halt boundary they cite is the Gateway\'s, corrected after the restart.',
        now,
      ],
    );

    await client.query(
      'UPDATE pages SET content=$1, version=$2, metadata=$3, updated_at=$4, last_verified_at=$4 WHERE id=$5',
      [articleJson, version, JSON.stringify(metadata), now, page.id],
    );
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,'major',$6,$7,$8)`,
      [
        cuid(),
        page.id,
        articleJson,
        page.title,
        version,
        AUTHOR_ID,
        'Split. The twenty-three chronology blocks written during the outage move to contents/history/hyperlane-asset-drain-2026-timeline and are replaced by one summary section, "The fix, and the restart", covering the council\'s four steps, Eagle Ray and Scrypto v1.4.0, babylon-node v1.4.0.0 with the unconditional enactment epoch and the user transaction moratorium, the Stokenet rehearsal, the coordinated boot, and the restart of 11 September. Corrects "The halt" and its timeline table to the true last round (21:19:48.939 UTC, epoch 339,897 round 4, state version 557,840,627) rather than the Gateway aggregator\'s reading, which only the moved restart block had carried; retires "has produced no round since" in the lead; fixes "What is unresolved", which counted two questions and listed three.',
        now,
      ],
    );

    // The one inbound deep link, which pointed at a block that has moved.
    const relink = await client.query(
      `UPDATE pages SET content = REPLACE(content::text, $1, $2)::jsonb
       WHERE content::text LIKE '%' || $1 || '%' RETURNING slug`,
      [`${SLUG}#sweep408-restart`, `${SLUG}#${SENTINEL}`],
    );

    await client.query('COMMIT');
    console.log(`    written; relinked ${relink.rows.length} inbound anchor(s): ${relink.rows.map((r) => r.slug).join(', ') || 'none'}`);
  }
} finally {
  client.release();
  await pool.end();
}
