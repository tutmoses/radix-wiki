/**
 * Sweep 439b — ideas rotation, staleness head. /ideas/dao-coi-code-of-conduct was the
 * oldest card in the category (bulk-touched 1 September, verified 21 August) and was
 * about to be stamped rather than edited. Checking its sources first found a commit it
 * does not carry, and one of its edits contradicts the card's sharpest section.
 *
 * Read 2026-09-16 from api.github.com and raw.githubusercontent.com:
 *   Both policies still sit in pending/governance/ in Shadaffy/radix-dao-governance,
 *   last touched by 753a04f, "docs(framework): pre-ratification quality pass across the
 *   policy library", 2026-08-25T08:35:41Z, 23 files changed. The card says both "last
 *   took substantive edits on 5 August 2026" and gives byte sizes from that reading;
 *   the CoI is now 16,294 bytes (was 16,206) and the Code of Conduct 12,913 (was 13,068).
 *   The CoI's diff in that commit is +5/-0, a Version / Last updated block alone.
 *   The Code of Conduct's is +7/-2 and two of the three changed lines are substantive:
 *     - "does not address any suspension of voting rights on compliance grounds
 *       (Compliance Operations Policy §2.4), which is reserved for legal advice"
 *       became "Suspension of voting rights on statutory compliance grounds is governed
 *       by the Compliance Operations Policy §2.4A."
 *     - appeal escalation to the Dispute Resolution & Arbitration Policy became the
 *       appellant's non-refusable election rather than a RAC judgement about its own
 *       impartiality.
 *   Compliance Operations Policy §2.4A (new section, same commit) lets the RAC suspend
 *   the voting rights attaching to holdings whose holder has not met a KYC / beneficial-
 *   owner / BOIR requirement under Marshall Islands law and Operating Agreement Art. X:
 *   emergency decision threshold (DAO Parameters §5.2), prior written notice and a
 *   14-day cure period, limited to that holder's holdings, lapses on compliance, subject
 *   to the Compliance Challenge (Proposal & Voting Framework §8) and to arbitration.
 *   It closes: "This section is the only ground on which voting power recognised under
 *   Proposal & Voting Framework §6.1 may be set aside."
 *   GP-PRE-1 §5 gained a manifest of all 21 ratified documents with file, version v1.0.0
 *   and a SHA-256 column; every hash cell currently reads "[to be recorded at signing]".
 *
 * So the card's "No sanction reaches the vote" section is right about the Code of Conduct
 * and now incomplete about the framework: there is exactly one ground, it is named, and
 * it was added three weeks ago.
 */
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, withClient } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG = 'ideas', SLUG = 'dao-coi-code-of-conduct';
const SENTINEL = '2.4A';
const VERSION = '2.1.0';
const MESSAGE =
  'Both policies took a pre-ratification quality pass on 25 August 2026 (commit 753a04f) that '
  + 'the card did not carry: each is now versioned v1.0.0, GP-PRE-1 gained a 21-document manifest '
  + 'with an unfilled SHA-256 column, and the Code of Conduct took two substantive edits. One of '
  + 'them qualifies this card\'s sharpest section: compliance-grounds suspension of voting rights '
  + 'moved from "reserved for legal advice" to Compliance Operations Policy §2.4A, a drafted '
  + 'procedure and the framework\'s only ground for setting voting power aside. Appeal escalation '
  + 'to arbitration also became the appellant\'s non-refusable election. Byte sizes and the '
  + '"last substantive edit" date corrected.';

// [find, replace] — every find is verbatim from the stored HTML.
const SPANS = [
  [
    '<tr><th>Latest</th><td>5 Aug 2026 – both policies drafted and folded into the GP-PRE-1 ratification set; neither is voted on separately</td></tr>',
    '<tr><th>Latest</th><td>25 Aug 2026 – both versioned v1.0.0 in a pre-ratification pass; still in the GP-PRE-1 set, neither voted on separately</td></tr>',
  ],
  [
    '(16,206 bytes) and the <a href="https://github.com/Shadaffy/radix-dao-governance/blob/master/pending/governance/code-of-conduct.md" target="_blank" rel="noopener">Code of Conduct</a> (13,068 bytes) both last took substantive edits on 5 August 2026, in a commit titled "close the workbook review findings for ratification."',
    '(16,294 bytes) and the <a href="https://github.com/Shadaffy/radix-dao-governance/blob/master/pending/governance/code-of-conduct.md" target="_blank" rel="noopener">Code of Conduct</a> (12,913 bytes) were last edited on <a href="https://github.com/Shadaffy/radix-dao-governance/commit/753a04f5660df78545c147be5ac1e5b2b3821bfc" target="_blank" rel="noopener">25 August 2026</a>, in a pre-ratification quality pass across 23 files that stamped every ratified document v1.0.0 and gave <a href="https://github.com/Shadaffy/radix-dao-governance/blob/master/pending/GP-PRE-1-Framework-Ratification.md" target="_blank" rel="noopener">GP-PRE-1</a> a manifest listing all 21 by file, version and SHA-256 &ndash; a column whose every cell still reads <em>to be recorded at signing</em>, so the hashes are a slot rather than a commitment. Before that the substantive work was a 5 August commit titled "close the workbook review findings for ratification."',
  ],
  [
    'Suspension covers forums, calls, working groups, repositories, grant and compensation processes and candidacy for role – not voting.</p>',
    'Suspension covers forums, calls, working groups, repositories, grant and compensation processes and candidacy for role – not voting.</p>'
    + '<p>That is a limit on this Code, and since 25 August the framework says plainly where the limit ends. The sentence deferring compliance-grounds suspension to legal advice was replaced with a pointer to <a href="https://github.com/Shadaffy/radix-dao-governance/blob/master/pending/governance/compliance-operations-policy.md" target="_blank" rel="noopener">Compliance Operations Policy</a> §2.4A, a section written in the same commit. It lets the RAC suspend the voting rights attaching to the holdings of a holder who has not met a KYC, beneficial-owner or BOIR requirement under Marshall Islands law and Article X of the Operating Agreement: decided at the emergency threshold, on prior written notice with a 14-day cure period, reaching only that holder\'s holdings, lapsing the moment the requirement is met or shown not to apply, and challengeable both under the Proposal &amp; Voting Framework and in arbitration. Its closing line is the one that matters for reading this card: it is <strong>the only ground</strong> on which voting power recognised by the framework may be set aside.</p>'
    + '<p>The two provisions do not conflict; they divide. A conduct finding cannot touch the vote, and the one thing that can is not a sanction at all but a statutory gate, with a cure period rather than a penalty at the end of it. Until 25 August the card could say the franchise was beyond the framework\'s reach, because the framework had left that question to counsel. It has answered it since.</p>',
  ],
  [
    'Permanent exclusion carries an appeal whether or not one is brought: where nobody appeals within 14 days, the exclusion is still referred for determination under the Dispute Resolution &amp; Arbitration Policy before it takes effect.</p>',
    'Permanent exclusion carries an appeal whether or not one is brought: where nobody appeals within 14 days, the exclusion is still referred for determination under the Dispute Resolution &amp; Arbitration Policy before it takes effect. The 25 August pass moved the other direction on the same policy: an appellant may now elect in the notice of appeal to have the appeal determined in arbitration rather than by the RAC, and that election is not refusable. It had been available only where the RAC decided it could not seat an impartial panel, which was the RAC judging its own impartiality on an appeal against its own finding.</p>',
  ],
  [
    '<li><s>Draft the Conflict of Interest Policy and the Code of Conduct</s> – both written, last revised 5 August 2026.</li>',
    '<li><s>Draft the Conflict of Interest Policy and the Code of Conduct</s> – both written, both v1.0.0, last revised 25 August 2026.</li>',
  ],
];

await withClient(async (client) => {
  if (isLockedPage(TAG, SLUG)) throw new Error(`${TAG}/${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log(`  already carries "${SENTINEL}" — no write`);
    return;
  }

  // Walk every text-bearing block, infobox children included.
  const texts = [];
  for (const b of blocks) {
    if (typeof b.text === 'string') texts.push(b);
    for (const n of b.blocks || []) if (typeof n.text === 'string') texts.push(n);
  }
  for (const [find, repl] of SPANS) {
    const hits = texts.filter((t) => t.text.includes(find));
    if (hits.length !== 1) throw new Error(`span matched ${hits.length} blocks, expected 1: ${find.slice(0, 70)}…`);
    hits[0].text = hits[0].text.replace(find, repl);
  }

  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${VERSION}`
    + `  (${JSON.stringify(page.content).length} -> ${JSON.stringify(blocks).length} chars)`);
  if (DRY) { console.log('  ' + MESSAGE); return; }

  const now = new Date().toISOString();
  const json = JSON.stringify(blocks);
  await client.query('BEGIN');
  await client.query(
    'UPDATE pages SET content = $1, version = $2, updated_at = $3, last_verified_at = $3 WHERE id = $4',
    [json, VERSION, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, VERSION, 'minor', AUTHOR_ID, MESSAGE, now]);
  await client.query('COMMIT');
  console.log('    written');
});
