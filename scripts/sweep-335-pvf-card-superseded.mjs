/**
 * Sweep 335 (ideas rotation) — the Proposal & Voting Framework card is answered.
 *
 * The card was written in July 2026 from the RDD structure thread and asks the
 * DAO to "lock the mechanics": initiator thresholds in absolute XRD/LSU, quorums
 * in absolute XRD, whether a Temperature Check auto-graduates, and a no-confidence
 * override. Every one of those is now settled, in a document that is currently
 * being put to the community: Proposal & Voting Framework v1.0.0 (27 Aug 2026) is
 * one of the twenty-one documents in the GP-PRE-1 ratification manifest, in its
 * seven-day Discussion phase since 30 Aug 2026.
 *
 * The card also cites Shadaffy/radix-dao — the reference library, last pushed
 * 7 May 2026 — as the governing repo. The operative repo is
 * RadixDAO/governance-framework.
 *
 * Sources read for this edit (raw.githubusercontent, main @ 14a0510):
 *   pending/governance/proposal-and-voting-framework.md  §2, §3.1-3.3, §6.1
 *   pending/parameters/dao-parameters-registry.md        §3.1, §3.2, §3.3, §3.3A, §7 (removal)
 */
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'ideas';
const SLUG = 'dao-proposal-voting-framework';
const SENTINEL = 'id="settled-by-the-ratifiable-framework"';
const DRY = process.argv.includes('--dry-run');

const NEW_BLOCK = `<h2 id="settled-by-the-ratifiable-framework">Settled by the framework now under ratification</h2>
<p>Every deliverable above has an answer, and the answer is a document the community is currently being asked to adopt. <a href="https://github.com/RadixDAO/governance-framework/blob/main/pending/governance/proposal-and-voting-framework.md" target="_blank" rel="noopener">Proposal &amp; Voting Framework v1.0.0</a>, dated 27 August 2026, is one of the twenty-one documents in the <a href="/ideas/radix-network-dao-charter" rel="noopener">GP-PRE-1 ratification manifest</a>, and has been in its seven-day Discussion phase since 30 August 2026. It is not in force. It is also the most consequential of the three documents the Transition RAC named as highest-leverage for a reader to check before voting, alongside the Charter and the <a href="/ideas/dao-parameters-registry" rel="noopener">DAO Parameters Registry</a>.</p>
<p>The shape of the answer is that the numbers left the framework. Almost nothing quantitative lives in the Proposal &amp; Voting Framework itself: it defines the pipeline and the vote types, and every threshold, quorum and duration is a cross-reference into the Parameters Registry, which can be amended without touching the framework text.</p>
<h3 id="what-changed-against-the-july-framing">What changed against the July framing</h3>
<ul>
<li><strong>The initiator thresholds are gone entirely.</strong> §2 gives any Governance Participant the right to submit a proposal with "no minimum holding, prior registration, or approval from any DAO body", flowing from Charter §4.1 sovereignty. The 0.5M LSU-XRD and 2M XRD gates above have no successor.</li>
<li><strong>Quorums are percentages of eligible voting power, not absolute XRD.</strong> Parameters §3.2: Constitutional 10%, Governance Process 7%, Treasury &amp; Budget 7%, Executable 5%, Temperature Check 3% — measured as participation, YES + NO + ABSTAIN. Approval is the YES share of decisive votes, excluding ABSTAIN (§3.3): 66% Constitutional, 60% Governance Process, 50% for the rest.</li>
<li><strong>A third test was added that the July design had no equivalent of.</strong> Parameters §3.3A sets a Minimum Affirmative Support floor — YES power as a share of the whole electorate, independent of quorum: 3.5% Constitutional, 2% Governance Process, 1.5% Treasury &amp; Budget, 1% Executable. It exists because ABSTAIN counts toward quorum but not toward approval, so without it a proposal could be carried over quorum largely by abstentions and then decided by a very small affirmative base. Each figure is set at roughly half the YES share a zero-abstention vote clearing its own quorum at its own approval threshold would produce.</li>
<li><strong>Temperature Checks neither auto-graduate nor sit at the RAC's discretion.</strong> §3.3 makes elevation a duty of the Governance Operator, exercised through the Owner Badge, within the TC Elevation Window — five business days (Parameters §3.1). Miss it without recording documented grounds with the RAC and the elevation backstop in the Governance Continuity Framework §4.2A fires.</li>
<li><strong>The no-confidence override does not survive as a distinct instrument.</strong> Removal of a role holder is an ordinary Governance Process proposal — 7% quorum, ≥60% YES, subject to the §3.3A floor — and the registry states the reason for the cross-reference: unseating should cost at least what seating cost. There is no 75% / 1.5B XRD lever.</li>
<li><strong>The 7-day voting window became a range with a discussion period in front of it.</strong> Parameters §3.1: Draft Discussion ≥5 days, Temperature Check voting 5–7 days, DAO Proposal voting 5–7 days.</li>
</ul>
<h3 id="what-the-framework-demands-of-the-voting-app">What the framework demands of the voting app</h3>
<p>The last deliverable above — wire the framework to the on-chain app so votes are computed from ledger state — is the one that is now a stated capability requirement rather than an aspiration. §6.1 fixes voting power at a snapshot taken by the system when each vote opens, not chosen by the RAC or the proposer and not alterable afterwards, with a single exception: a rerun reuses the snapshot of the round it re-runs, because the remedy a rerun offers is time and it would not be that if the electorate changed with it. The framework then says outright that a governance component unable to open a rerun against the stored snapshot of an earlier round <em>cannot run those provisions as specified</em>. Eligible holdings are tiered (Parameters §8A): liquid XRD and LSU converted at the redemption rate are the constitutional floor, while LSULP and DEX pool positions sit in an RAC-maintained register that can change without a constitutional amendment. See <a href="/ideas/dao-governance-app-consultation-v2" rel="noopener">the governance app</a>, now at Consultation V3, for the deployment this lands on.</p>
<p>One caveat carries across from the ratification thread and applies to every link on this card: what is ratified is the <strong>signed PDF</strong> of each document, published to the Official Venue and hashed in the manifest. The markdown cited here is the working source it was rendered from, it stays editable after the vote, and where the two differ the PDF governs.</p>`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content, metadata FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  // 1. Date the July framing, and repoint the operative-repo citation.
  const body = blocks[1];
  if (body?.type !== 'content') throw new Error('block 1 is not the body block');
  const beforeBody = body.text;
  body.text = body.text
    .replace('<h2>Deliverables</h2>', '<h2>Deliverables, as the card set them in July 2026</h2>')
    .replace(
      '<li>Governed by <a href="https://github.com/Shadaffy/radix-dao" target="_blank" rel="noopener">Daffy&rsquo;s Radix DAO framework</a> (repo <code>Shadaffy/radix-dao</code>);',
      '<li>Governed by the operative repository <a href="https://github.com/RadixDAO/governance-framework" target="_blank" rel="noopener"><code>RadixDAO/governance-framework</code></a>, which moved off a personal account on 29 August 2026; the older <a href="https://github.com/Shadaffy/radix-dao" target="_blank" rel="noopener"><code>Shadaffy/radix-dao</code></a> is the reference library of unactivated drafts, last pushed 7 May 2026. See')
    .replace(
      "<li>Governed by <a href=\"https://github.com/Shadaffy/radix-dao\" target=\"_blank\" rel=\"noopener\">Daffy's Radix DAO framework</a> (repo <code>Shadaffy/radix-dao</code>);",
      '<li>Governed by the operative repository <a href="https://github.com/RadixDAO/governance-framework" target="_blank" rel="noopener"><code>RadixDAO/governance-framework</code></a>, which moved off a personal account on 29 August 2026; the older <a href="https://github.com/Shadaffy/radix-dao" target="_blank" rel="noopener"><code>Shadaffy/radix-dao</code></a> is the reference library of unactivated drafts, last pushed 7 May 2026. See');
  if (body.text === beforeBody) throw new Error('body replacements all no-opped — aborting');
  if (body.text.includes('Deliverables</h2>') && !body.text.includes('July 2026</h2>')) throw new Error('deliverables heading not dated');
  if (/Daffy(&rsquo;|')s Radix DAO framework/.test(body.text)) throw new Error('repo citation not repointed');

  // 2. Append the resolution section.
  blocks.push({ id: uid(), type: 'content', text: NEW_BLOCK });

  // 3. The work is live in a ratification vote, not merely approved.
  const meta = { ...(page.metadata || {}), status: '🔵 In Progress' };
  const ib = blocks.find((b) => b.type === 'infobox');
  const cell = ib?.blocks?.[0];
  if (!cell) throw new Error('infobox cell not found');
  const beforeCell = cell.text;
  cell.text = cell.text
    .replace('<tr><th>Status</th><td>🟡 Approved</td></tr>',
      '<tr><th>Status</th><td>🔵 In Progress</td></tr><tr><th>Document</th><td>Proposal &amp; Voting Framework v1.0.0, in the GP-PRE-1 manifest</td></tr>');
  if (cell.text === beforeCell) throw new Error('infobox status row not matched');

  const version = '2.0.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  body ${beforeBody.length} -> ${body.text.length} B; blocks ${page.content.length} -> ${blocks.length}`);
  console.log(`  status ${(page.metadata || {}).status} -> ${meta.status}`);

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, metadata=$3, updated_at=$4, last_verified_at=$4 WHERE id=$5',
      [json, version, JSON.stringify(meta), now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'major', AUTHOR_ID,
       'Answer the July 2026 deliverables against Proposal & Voting Framework v1.0.0, one of the 21 documents in the GP-PRE-1 ratification manifest and in Discussion since 30 Aug 2026. Initiator thresholds abolished (any participant may submit, no minimum holding); quorums and approvals are now percentages of eligible voting power with a new Minimum Affirmative Support floor; TC elevation is a duty of the Governance Operator within a 5-business-day window with a continuity backstop; the no-confidence override does not survive as a separate instrument (removal is an ordinary Governance Process proposal). Adds the per-vote snapshot rule and the rerun capability the framework requires of the deployed component. Repoints the governing-repo citation from the Shadaffy reference library to RadixDAO/governance-framework. Status 🟡 Approved -> 🔵 In Progress.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
