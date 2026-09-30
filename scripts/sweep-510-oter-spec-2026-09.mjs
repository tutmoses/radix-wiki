// scripts/sweep-510-oter-spec-2026-09.mjs
//
// Ecosystem rotation, run 510. Tāhuna was at the head of the staleness queue, and
// re-reading its sources on 30 September 2026 found both it and OTER, the oracle it
// resolves on, had rewritten their dispute specifications since the pages were last
// verified.
//
// oter.io (Last-Modified 14:29 UTC 30 Sep) now carries "Protocol specification
// rev. 2026-09". Against the rev. 2026-07 text both wiki pages describe:
//   - vote weight is LINEAR in stake, argued as the only curve a split cannot beat;
//     the √stake curve and its 24.1% -> 3.6% simulation are gone
//   - every staker votes on every dispute; the beacon-drawn jury (~97 of 100 seated)
//     is gone, and the beacon is listed as an ecosystem service independent of the vote
//   - correct stakers earn OTER vote rewards minted per ballot plus 15% of the losing
//     bond in the request's bond asset (was: rUSDC, no platform token); wrong-side
//     ballots are slashed
//   - failed round: 3 tries, then a 2-day window in which the admin may close the
//     question as invalid, then anyone can
//   - governance is bicameral: XRD holders ratify sensitive methods through a bridge
//     governor (was: no second electorate); 100m hard cap on OTER
// tahuna.org/resolution now agrees on the 70% bar and on staker pay, and no longer
// says an admin decides after five failures; instead a stuck question reopens on a
// cooldown (6 h, doubling to 30 days) and "is never voided". That still contradicts
// OTER's close-as-invalid, so the disagreement table shrinks to the rows that remain.
// Tāhuna's timeline still reads "Q3 2026 · Testnet" on the last day of Q3, site
// unchanged since 3 Sep, GitHub org still 0 public repos.
//
//   node scripts/sweep-510-oter-spec-2026-09.mjs --dry-run
//   node scripts/sweep-510-oter-spec-2026-09.mjs
//
// Idempotent: each page is skipped if its sentinel is already present.

import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, assertLinkShapes } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const SENTINEL = 'rev. 2026-09';
const OTER = 'https://oter.io';
const RES = 'https://tahuna.org/resolution';
const A = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

// ---------------------------------------------------------------- OTER
const oterEdits = {
  version: '2.5.0',
  message: 'OTER published protocol specification rev. 2026-09 on oter.io (read 30 Sep 2026): vote weight is now linear in stake '
    + 'rather than √stake, every staker votes on every dispute instead of a beacon-drawn jury, correct stakers are paid in minted OTER '
    + 'plus 15% of the losing bond in its own asset, a question that fails three rounds can be closed as invalid by the admin and then '
    + 'by anyone, and sensitive rule changes need XRD-holder ratification. Infobox, lifecycle, beacon, parameters, governance and status '
    + 'updated; the superseded July figures kept as history. Beacon health re-read live. Source: https://oter.io',
  subs: [
    ['<tr><th>Dispute resolution</th><td>Staked jury, timelock-sealed ballots, single round</td></tr>',
     '<tr><th>Dispute resolution</th><td>Vote of all OTER stakers, timelock-sealed ballots, one round per 48-hour cycle</td></tr>'],
    ['<tr><th>Voting power</th><td>√stake (square root of staked amount)</td></tr>',
     '<tr><th>Voting power</th><td>Linear in stake (√stake until spec rev. 2026-09)</td></tr>'],
    ['BLS12-381, 3-second period</td></tr>',
     'BLS12-381, 3-second period, independent of the vote</td></tr>'],
    ['<tr><th>Governance</th><td>Staker DAO – same sealed √stake vote as a dispute</td></tr>',
     '<tr><th>Governance</th><td>Stakers propose and vote; XRD holders ratify sensitive changes</td></tr>\n<tr><th>Token</th><td>OTER, 100m hard cap</td></tr>'],
    ['Only contested answers go to a vote, decided by staked jurors casting',
     'Only contested answers go to a vote, decided by OTER stakers casting'],
    ['The design combines sealed-ballot juries, bonded answers, and atomic settlement.',
     'The design combines sealed ballots, bonded answers, and atomic settlement.'],
    [`Per the project's published specification the slash is split <strong>80% to the winner, 15% to the correct voters, and 5% to the protocol</strong>, with voter rewards ${A(OTER, 'paid in rUSDC rather than a platform token')}.`,
     `Per the project's published specification the forfeited bond is split <strong>80% to the winner, 15% to the correct stakers, and 5% to the protocol</strong>, in whatever asset that question was bonded in. Stakers on the winning side also ${A(OTER, 'earn OTER vote rewards, minted per correct ballot')}, and a ballot against the settled verdict costs part of its stake, paid to the stakers who got it right.`],
    ['For the last of these OTER points at a companion resolver',
     'For the last of these the July specification pointed at a companion resolver'],
    ['The published specification is dated <em>rev. 2026-07</em>.',
     'The specification then published was dated <em>rev. 2026-07</em>.'],
    ['and is itself pre-launch, with a testnet targeted for Q3 2026.',
     'and is itself pre-launch; its site still listed a Q3 2026 testnet on the last day of that quarter.'],
    ['and a mainnet deploy after that.</p>',
     `and a mainnet deploy after that. By 30 September 2026 oter.io carried a revised specification, <em>rev. 2026-09</em>, which counts stake linearly, lets every staker vote on every dispute and adds XRD-holder ratification of sensitive rule changes (see <a href="#protocol-parameters" rel="noopener">Protocol parameters</a>); the site still describes the protocol as pre-launch.</p>`],
  ],
  blocks: {
    'e33ec1bf-99a2-48a4-b37d-767259e9eda0': `<h2>The OTER Beacon</h2><p>The project runs the ${A('https://random.oter.io/', 'OTER Beacon')}, a ${A('https://drand.love', 'drand')}-aligned min-pk BLS12-381 randomness beacon whose output is verifiable natively on Radix. Its ${A('https://random.oter.io/info', 'public info endpoint')} returned the scheme <code>oter-min-pk-g2-pop</code> on 29 July 2026: unchained, public keys in G1 and signatures in G2, domain-separated under <code>oter-jury-beacon:v1</code>, on a <strong>3-second period</strong>. The ${A('https://random.oter.io/health', 'health endpoint')} reported the chain live on 30 September 2026, at round 32,663,926 and one second behind head.</p><p>The domain tag records what the beacon was built for. Under the July specification it seated each dispute's jury: jurors committed timelock-encrypted votes while the beacon round that would seat them was named but unpublished, the contract verified that round's signature on-chain, derived the seed as <code>keccak256(signature)</code> and allocated seats by <code>keccak256(seed ‖ voter)</code>, seating roughly 97 of every 100 revealed votes. The September revision drops the draw. ${A(OTER, 'Every OTER staker has a vote on every dispute')}, and the site now lists the beacon as an ecosystem service any Radix project can verify on-chain, "independent of the OTER vote". In July OTER also stated that it had upstreamed the beacon verification into the Radix engine itself.</p>`,
    '2b2de153-14a3-457f-bad3-cdccb8511a10': `<h2 id="protocol-parameters">Protocol parameters</h2><p>The following defaults are published in OTER's own protocol specification, marked <em>rev. 2026-09</em> when ${A(OTER, 'read on oter.io')} on 30 September 2026, and are subject to change by staker governance. They are recorded here as documented, not as independently verified on-ledger behaviour: the oracle is not yet on mainnet.</p><table>
<tbody>
<tr><th>Challenge window</th><td>4 hours default, configurable per question</td></tr>
<tr><th>Vote cycle</th><td>48 hours – 24 h sealed commit, 12 h reveal, 12 h to re-propose and dispute</td></tr>
<tr><th>Re-vote latency</th><td>Next cycle – an escalated question re-enters the next cycle rather than waiting out an extra round</td></tr>
<tr><th>Who votes</th><td>Every staker, on every dispute</td></tr>
<tr><th>Consensus threshold</th><td>70% supermajority of revealed stake</td></tr>
<tr><th>Quorum</th><td>Exponential moving average, easing in at 5% for the cold start then tracking real participation</td></tr>
<tr><th>Voting power</th><td>Linear – a revealed ballot counts for exactly the OTER staked behind it</td></tr>
<tr><th>Losing bond</th><td>Forfeited in full – 80% winner / 15% correct stakers / 5% protocol, in the request's bond asset</td></tr>
<tr><th>Bond assets</th><td>rUSDC or XRD for questions, XRD for consultations and elections, set per identifier</td></tr>
<tr><th>Batch size</th><td>25 questions per vote round</td></tr>
<tr><th>Failed round</th><td>3 tries – bonds refund and nobody is slashed; after the third, a 2-day window in which the admin may close the question as invalid, after which anyone can</td></tr>
<tr><th>Unstake cooldown</th><td>7 days</td></tr>
<tr><th>Identifier kinds</th><td>4 – yes/no query, consultation, election, governance; new kinds plug in as identifiers</td></tr>
<tr><th>Supply cap</th><td>100m OTER; vote rewards are minted inside it</td></tr>
</tbody>
</table><p>The weighting is the largest change from the July specification, which counted votes by the square root of stake and published a simulation cutting the top holder's share of voting weight from 24.1% under linear weighting to 3.6%. The September datasheet counts stake linearly, on the reasoning that linear is the only curve a split cannot beat: spread across a hundred accounts, a stake carries the same weight as it does in one, where a concave curve pays a large holder to split. Concentration is to be limited once, by a hard cap at the token distribution, rather than inside the vote.</p>`,
    'aae602ae-d92a-43ad-8bbd-d51927e72d0b': `<h2>Governance</h2><p>OTER's parameters and question types are changed by the same machinery that settles a dispute, rather than by a team key. Any stake-ticket holder can bond a rule change, but the target must already sit on the DAO's allowlist and the exact action is bound into the proposal at creation, so it cannot be swapped afterwards. Unlike a question, a proposal gets no optimistic pass-through: every rule change is ${A(OTER, 'forced to a vote immediately')}, on the same sealed, stake-weighted ballots and the same 70% supermajority.</p><p>Execution is fail-closed. Only a settled <em>Approve</em> dispatches, replaying exactly the action that was voted on against the bound target, and the proposer's bond returns with a reward. A rejected proposal executes nothing and forfeits the proposer's bond to the stakers who turned it down, which is the protocol's answer to rulebook spam. There is no separate governance token. The September specification adds a second electorate for the sensitive methods and parameter sets: stakers propose and vote, and XRD holders ratify through a bridge governor, so those changes need both. An administrator can bootstrap the allowlist but never decide a vote. For how Radix approaches on-ledger governance more broadly, see <a href="/contents/tech/core-concepts/radix-governance" rel="noopener">Radix Governance</a>.</p>`,
  },
};

// ---------------------------------------------------------------- Tāhuna
const tahunaEdits = {
  version: '1.2.0',
  message: 'Resolution rewritten against both projects\' September documentation (read 30 Sep 2026): OTER spec rev. 2026-09 drops the '
    + 'beacon-drawn jury and √stake weighting, and tahuna.org/resolution now matches it on the 70% bar and staker pay and no longer '
    + 'says an admin decides a stuck market. The disagreement table shrinks to the one conflict left: Tāhuna says a stuck question '
    + 'reopens on a doubling cooldown and is never voided, OTER lets it be closed as invalid after three rounds. Status: Q3 2026 '
    + 'testnet still listed on the last day of Q3; GitHub org still has no public repositories. Sources: https://tahuna.org/resolution, '
    + 'https://oter.io, https://api.github.com/orgs/Tahuna-Labs',
  subs: [
    ['<tr><th>Resolution</th><td><a href="/ecosystem/oter" rel="noopener">OTER</a> – optimistic proposer, beacon-drawn √stake jury on dispute</td></tr>',
     '<tr><th>Resolution</th><td><a href="/ecosystem/oter" rel="noopener">OTER</a> – optimistic proposer, stake-weighted vote of OTER stakers on dispute</td></tr>'],
    ['<tr><th>Testnet</th><td>Q3 2026 (targeted)</td></tr>',
     '<tr><th>Testnet</th><td>Q3 2026 (targeted; not live on 30 Sep 2026)</td></tr>'],
  ],
  blocks: {
    'a80babe1-511a-4c76-9b89-737a2abd3635': `<h2>Resolution</h2><p>Tāhuna describes itself as the markets layer only; confirming an outcome is ${A(RES, 'delegated to OTER')}, a separate project it depends on. When a market reaches its deadline a proposer submits a candidate outcome and posts a proposer bond, opening a <strong>four-hour challenge window</strong>, the default in ${A(OTER, "OTER's own protocol specification")}, which marks it configurable per question. If nobody disputes it, the outcome finalizes, the market settles and the bond is returned. The project expects most markets with clear evidence to take this path, with no vote at all.</p><p>A challenger who posts a counter-bond escalates the question to <a href="/ecosystem/oter" rel="noopener">OTER</a>, where every OTER staker may cast one timelock-encrypted ballot, weighted by the OTER staked behind it. No ballot can be decrypted by anyone, including the staker who cast it, until the round closes and ${A('https://drand.love', 'drand')} releases the decryption key, at which point every ballot is decrypted at once. The leading outcome settles the market once it holds at least <strong>70% of the revealed stake</strong>; short of that, the question goes to another round. Tāhuna contrasts this with UMA's commit–reveal cycle, where a voter has to return for a second reveal phase, and frames its own relationship to OTER as mirroring Polymarket's to UMA. Stakers who vote with the settled outcome earn OTER and a share of the losing bond, stakers on the wrong side are slashed, and the market creator funds a requester reward when the question is posted, paid to whichever side's bond wins the dispute.</p><p>Until September both projects described a narrower vote: a jury seated by a draw from OTER's randomness beacon, with voting power growing as the square root of stake. OTER's ${A(OTER, 'specification rev. 2026-09')}, on oter.io by 30 September 2026, drops both, and Tāhuna's page was revised to match.</p><h3>Where the two specifications disagree</h3><p>Both projects are pre-launch and both descriptions are their own documentation, so nothing below has been observed on-ledger. The September revisions brought the two into line on who votes, on the 70% bar and on how correct stakers are paid. They still disagree on what happens to a question no round can settle.</p><table><tbody><tr><th></th><th>${A(RES, 'Tāhuna, "How resolution works"')}</th><th>${A(OTER, 'OTER, protocol specification rev. 2026-09')}</th></tr><tr><th>After three failed rounds</th><td>the question reopens on a cooldown and "is never voided"; both bonds are refunded after each round without a verdict</td><td>bonds refund and nobody is slashed; then a two-day window in which the admin may close the question as invalid, after which anyone can</td></tr><tr><th>Retry timing</th><td>six hours before the next attempt, doubling each time up to thirty days</td><td>an escalated question re-enters the next 48-hour vote cycle</td></tr></tbody></table><p>The difference decides what a trader holds when a market cannot be settled. Under Tāhuna's description the position stays open, and its collateral locked, for as long as the retries run. Under OTER's the question can end as invalid, which OTER's own example settlement contract redeems at half the collateral on each side. Tāhuna's page previously said the opposite of both: that after five failed attempts resolution could be lifted to an admin call. Its September text drops that and states that OTER "does not hand the outcome to an admin".</p>`,
    '689b442d-32da-4255-91cb-7d683fde7698': `<h2>Status and roadmap</h2><p>Tāhuna is <strong>pre-launch</strong>. On 30 September 2026, the last day of the quarter its timeline gives for a testnet, ${A('https://tahuna.org', 'tahuna.org')} still read "Now · Pre-launch", "Q3 2026 · Testnet" and "Q4 2026 · Mainnet", offered a waitlist rather than a live application, and had not changed since 3 September. The ${A('https://github.com/Tahuna-Labs', 'Tahuna-Labs GitHub organisation')}, registered in May 2026, still publishes no public repositories when re-checked through the GitHub API the same day, so the contracts are not open to inspection. The project states it is not available to residents of jurisdictions where prediction markets are prohibited.</p><p>Tāhuna's dependency on <a href="/ecosystem/oter" rel="noopener">OTER</a> means the two ship on linked timelines: OTER is likewise pre-launch, with its randomness beacon live in production but the oracle itself not yet on mainnet.</p>`,
  },
};

// ---------------------------------------------------------------- apply
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

const leaves = (bs) => bs.flatMap((b) => [b, ...(b.blocks || [])]);

async function apply(slug, edits) {
  if (isLockedPage('ecosystem', slug)) throw new Error(`ecosystem/${slug} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', ['ecosystem', slug]);
  if (!rows.length) throw new Error(`${slug} not found`);
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));
  if (leaves(blocks).some((b) => (b.text || '').includes(SENTINEL))) {
    console.log(`  ${slug}: already applied - no write`);
    return;
  }
  for (const [from, to] of edits.subs) {
    const hits = leaves(blocks).filter((b) => (b.text || '').includes(from));
    if (hits.length !== 1) throw new Error(`${slug}: expected 1 match, got ${hits.length}: ${from.slice(0, 70)}`);
    hits[0].text = hits[0].text.replace(from, to);
  }
  for (const [id, text] of Object.entries(edits.blocks)) {
    const b = blocks.find((x) => x.id === id);
    if (!b) throw new Error(`${slug}: block ${id} not found`);
    b.text = text;
  }
  if (!leaves(blocks).some((b) => (b.text || '').includes(SENTINEL))) throw new Error(`${slug}: sentinel missing after edit`);
  assertLinkShapes(blocks, `ecosystem/${slug}`);
  const json = JSON.stringify(blocks);
  const added = [...edits.subs.map(([, to]) => to), ...Object.values(edits.blocks)].join('');
  if (/[\u2014\u00a0]/.test(added)) throw new Error(`${slug}: em dash or nbsp in new text`);
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${edits.version}  (${edits.subs.length} substitutions, ${Object.keys(edits.blocks).length} blocks rewritten)`);
  if (DRY) return;
  const now = new Date().toISOString();
  await client.query('BEGIN');
  await client.query(
    'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
    [json, edits.version, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, edits.version, 'minor', AUTHOR_ID, edits.message, now]);
  await client.query('COMMIT');
  console.log(`  ${slug}: written`);
}

try {
  await apply('oter', oterEdits);
  await apply('tahuna', tahunaEdits);
} catch (e) {
  try { await client.query('ROLLBACK'); } catch {}
  console.error('  FAILED:', e.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
