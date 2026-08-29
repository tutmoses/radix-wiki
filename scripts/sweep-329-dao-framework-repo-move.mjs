/**
 * Run 329 (community rotation, signal-led edit).
 *
 * On 29 August 2026 the Transition RAC moved the DAO's operative governance
 * repository off Daffy's personal GitHub account and into the RadixDAO
 * organisation, opened radixdao.org as the DAO's Official Venue, and published
 * a GP-PRE-1 whose ratified manifest now carries real SHA-256 hashes and a
 * signing certificate. This page was written on 26 August, when every hash cell
 * still read "to be recorded at signing" and the operative repository was
 * Shadaffy/radix-dao-governance.
 *
 * Sources: t.me/RadixAccountabilityCouncil/918 and /920 (29 Aug 2026);
 * github.com/RadixDAO/governance-framework read at the API and at raw on
 * 29 Aug 2026; radixdao.org/notices.json.
 */
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'ideas';
const SLUG = 'radix-network-dao-charter';
const SENTINEL = 'signed-and-staged-29-august-2026';
const DRY = process.argv.includes('--dry-run');

const NEW_SECTION = `<h2 id="${SENTINEL}">Signed and staged (29 August 2026)</h2>
<p>Three days after the reading above, the framework was signed and the repository holding it moved. The Transition RAC <a href="https://t.me/RadixAccountabilityCouncil/920" target="_blank" rel="noopener">announced on 29 August 2026</a> that the community's governance repository now sits with the <a href="https://github.com/RadixDAO" target="_blank" rel="noopener">RadixDAO</a> GitHub organisation as <a href="https://github.com/RadixDAO/governance-framework" target="_blank" rel="noopener"><code>RadixDAO/governance-framework</code></a>, and asked readers to adjust their links to it. The old path is not a redirect: <code>Shadaffy/radix-dao-governance</code> still resolves, still carries the 25 August text, and was last pushed on 25 August 2026, so a citation left pointing at it now quotes a superseded version rather than breaking.</p>
<p>GP-PRE-1 was rewritten in the move, from 15,396 bytes to 8,068, and the rewrite is where the substance is. The proposal now opens with a header naming its thresholds by parameter reference, and its manifest carries <strong>a SHA-256 for every one of the twenty-one documents</strong> rather than the placeholder each cell held on 26 August. A new section &sect;2A identifies the key those signatures chain to &ndash; a single self-signed certificate created by the Transition RAC, serial <code>497dc3092ebc024f6350b92a77fa14790de75b03</code>, SHA-256 fingerprint <code>73B1D38C5F4137307ADDEE4F8AF8BB922F887739C9FD9E499CFEAE10DACDE92D</code> &ndash; and states that a document whose signature chains to any other certificate is not a ratified version whatever its hash. The certificate is <a href="https://radixdao.org/notices/2026-08-29-transition-rac-certificate-technical-information-and-details/" target="_blank" rel="noopener">published on its own</a> so that it can be checked against a signature independently.</p>
<p>Behind the manifest sit the documents themselves. <code>pending/signed/</code> holds <strong>twenty-three signed PDFs</strong>: the twenty-one ratifiable documents, plus the two instruments the community does not vote on &ndash; the Operating Agreement and the Non-Profit DAO LLC Certificate of Formation, the latter dated 13 August 2026 at v1.02. Signed is not filed and neither is ratified. The Certificate of Formation is a document the Transition RAC has executed and has yet to lodge with the Marshall Islands; the <a href="https://t.me/RadixAccountabilityCouncil/918" target="_blank" rel="noopener">same day's earlier update</a> puts the MIDAO submission at Monday 31 August at the earliest, with four to six weeks for the registry to issue the certificate after that.</p>
<p>The repository layout is the status board, and it still reads pre-ratification. <code>constitutional/</code>, <code>governance/</code>, <code>legal/</code>, <code>parameters/</code> and <code>signed/</code> each hold nothing but a <code>.gitkeep</code>; everything in the manifest is under <code>pending/</code>. The <a href="https://github.com/RadixDAO/governance-framework/blob/main/README.md" target="_blank" rel="noopener">repository README</a> spells out what a YES vote physically does: each <code>.md</code> source moves from <code>pending/</code> to its root category folder and each PDF moves from <code>pending/signed/</code> to <code>signed/</code>, leaving the pending folders empty for the next cycle. Every merge to <code>main</code> is meant to correspond to a passed vote, which makes the commit history the audit trail.</p>
<p>The same announcement opened <a href="https://radixdao.org/" target="_blank" rel="noopener">radixdao.org</a> as the DAO's <strong>Official Venue</strong> &ndash; the term the Operating Agreement uses for the place a ratified document must be published to. Its Notices &amp; Records section carries the first two entries, both dated 29 August 2026 and both signed PDFs: the certificate details above at 15:07&nbsp;UTC, and <a href="https://radixdao.org/notices/2026-08-29-transition-rac-s-decisions-to-enable-and-support-the-ratification-process/" target="_blank" rel="noopener">the minute of the Transition RAC's 25 August meeting</a> at 16:41&nbsp;UTC, which records the decisions that enable the ratification process. The site banner states the phase in one line: <em>Phase 1 &middot; Pre-formation. Ratification vote pending. Community decisions are advisory until activation.</em> No date has been set for the vote itself; the RAC says only that it opens with a discussion period supported by a new RadixTalk topic.</p>`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

const replacements = [
  // block 0 — repoint the source of the verbatim text and re-date it
  [`last updated 25 August 2026, taken from <a href="https://github.com/Shadaffy/radix-dao-governance/blob/master/pending/constitutional/charter.md" target="_blank" rel="noopener"><code>pending/constitutional/charter.md</code></a> in the DAO&rsquo;s operative governance repository.`,
   `last updated 27 August 2026, taken from <a href="https://github.com/RadixDAO/governance-framework/blob/main/pending/constitutional/charter.md" target="_blank" rel="noopener"><code>pending/constitutional/charter.md</code></a> in the DAO&rsquo;s operative governance repository, which moved to the <a href="https://github.com/RadixDAO" target="_blank" rel="noopener">RadixDAO</a> organisation on 29 August 2026.`],

  // block 0 — the repository paragraph, now three repositories and a move
  [`<p>The two texts sit in different repositories, and the project says plainly which one governs. <a href="https://github.com/Shadaffy/radix-dao" target="_blank" rel="noopener"><code>Shadaffy/radix-dao</code></a> is the reference library, holding every draft and every policy not yet activated; its own <a href="https://github.com/Shadaffy/radix-dao/blob/master/OPERATIVE-REPO.md" target="_blank" rel="noopener">OPERATIVE-REPO.md</a> directs readers to <a href="https://github.com/Shadaffy/radix-dao-governance" target="_blank" rel="noopener"><code>Shadaffy/radix-dao-governance</code></a> and states that the second repository is updated only when a governance proposal passes. The reference library was last pushed on 7 May 2026. Most cards on this board still cite it rather than the operative repository.</p>`,
   `<p>The two texts sit in different repositories, and the project says plainly which one governs. <a href="https://github.com/Shadaffy/radix-dao" target="_blank" rel="noopener"><code>Shadaffy/radix-dao</code></a> is the reference library, holding every draft and every policy not yet activated, and it was last pushed on 7 May 2026. The operative repository is the one that moved: it was <code>Shadaffy/radix-dao-governance</code> on a personal account until 29 August 2026 and is now <a href="https://github.com/RadixDAO/governance-framework" target="_blank" rel="noopener"><code>RadixDAO/governance-framework</code></a> under the DAO's own organisation, updated only when a governance proposal passes. Most cards on this board still cite the reference library rather than either operative path.</p>`],

  // block 0 — the proposal link, and the voting system it names
  [`<a href="https://github.com/Shadaffy/radix-dao-governance/blob/master/pending/GP-PRE-1-Framework-Ratification.md" target="_blank" rel="noopener">GP-PRE-1, Constitutional Ratification of the Governance Framework</a>, authored by the Transition RAC and put to the community on its own <a href="/ideas/dao-governance-app-consultation-v2" rel="noopener">Consultation V2 system</a>.`,
   `<a href="https://github.com/RadixDAO/governance-framework/blob/main/pending/GP-PRE-1-Framework-Ratification.md" target="_blank" rel="noopener">GP-PRE-1, Constitutional Ratification of the Governance Framework</a>, authored by the Transition RAC and put to the community on its own <a href="/ideas/dao-governance-app-consultation-v2" rel="noopener">consultation system</a>, which the proposal called Consultation V2 on 25 August and calls <strong>Consultation V3</strong> in the 29 August rewrite.`],

  // block 0 — the manifest hashes are no longer placeholders
  [`Read on 26 August 2026, every hash cell in the manifest still reads <em>to be recorded at signing</em>, and the proposal&rsquo;s own submission date reads <em>to be confirmed</em>.`,
   `Read on 26 August 2026 every hash cell in the manifest read <em>to be recorded at signing</em>; read on 29 August all twenty-one carry a hash, and the proposal has dropped the submission-date field it had left <em>to be confirmed</em>.`],

  // block 0 — proposal history link
  [`<a href="https://github.com/Shadaffy/radix-dao-governance/blob/master/PROPOSALS.md" target="_blank" rel="noopener">proposal history</a>`,
   `<a href="https://github.com/RadixDAO/governance-framework/blob/main/PROPOSALS.md" target="_blank" rel="noopener">proposal history</a>`],

  // block 0 — the status section is now the 26 August reading, superseded below
  [`<h2 id="status-26-august-2026">Status (26 August 2026)</h2>`,
   `<h2 id="status-26-august-2026">Status as at 26 August 2026</h2>`],

  // block 1 — the verbatim charter's own header changed with the move
  [`# Radix DAO Charter\n\n| Field | Value |\n|---|---|\n| **Version** | v1.0.0 |\n| **Last updated** | 2026-08-25 |\n`,
   `# Radix DAO Charter\n\n*Version v1.0.0 — Last updated 2026-08-27*\n`],

  // block 2 — infobox
  [`<tr><td><strong>Version</strong></td><td>1.0.0, last updated 25 August 2026</td></tr>`,
   `<tr><td><strong>Version</strong></td><td>1.0.0, last updated 27 August 2026</td></tr>`],
  [`<tr><td><strong>Source</strong></td><td><a href="https://github.com/Shadaffy/radix-dao-governance/blob/master/pending/constitutional/charter.md" target="_blank" rel="noopener">radix-dao-governance</a> &middot; <code>pending/constitutional/charter.md</code></td></tr>`,
   `<tr><td><strong>Source</strong></td><td><a href="https://github.com/RadixDAO/governance-framework/blob/main/pending/constitutional/charter.md" target="_blank" rel="noopener">RadixDAO/governance-framework</a> &middot; <code>pending/constitutional/charter.md</code></td></tr>`],
  [`<tr><td><strong>Ratified by</strong></td><td><a href="https://github.com/Shadaffy/radix-dao-governance/blob/master/pending/GP-PRE-1-Framework-Ratification.md" target="_blank" rel="noopener">GP-PRE-1</a>, with 20 policy documents</td></tr>`,
   `<tr><td><strong>Ratified by</strong></td><td><a href="https://github.com/RadixDAO/governance-framework/blob/main/pending/GP-PRE-1-Framework-Ratification.md" target="_blank" rel="noopener">GP-PRE-1</a>, with 20 policy documents</td></tr>`],
  [`<tr><td><strong>Vote status</strong></td><td>Not submitted; no date set (26 Aug 2026)</td></tr>`,
   `<tr><td><strong>Vote status</strong></td><td>Signed and staged; not submitted, no date set (29 Aug 2026)</td></tr>`],
  [`<tr><td><strong>Discussion</strong></td><td><a href="https://radixtalk.com/c/governance" target="_blank" rel="noopener">RadixTalk Governance</a></td></tr>`,
   `<tr><td><strong>Official Venue</strong></td><td><a href="https://radixdao.org/" target="_blank" rel="noopener">radixdao.org</a></td></tr>\n<tr><td><strong>Discussion</strong></td><td><a href="https://radixtalk.com/c/governance" target="_blank" rel="noopener">RadixTalk Governance</a></td></tr>`],
];

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

  const apply = (text) => {
    let out = text;
    for (const [from, to] of replacements) {
      if (out.includes(from)) { out = out.split(from).join(to); hits.add(from.slice(0, 48)); }
    }
    return out;
  };
  const hits = new Set();
  for (const b of blocks) {
    if (typeof b.text === 'string') b.text = apply(b.text);
    for (const n of b.blocks || []) if (typeof n.text === 'string') n.text = apply(n.text);
  }
  const missed = replacements.filter(([from]) => !hits.has(from.slice(0, 48)));
  if (missed.length) {
    console.error(`  ${missed.length} replacement(s) did not match:`);
    for (const [from] of missed) console.error('   MISS:', from.slice(0, 100));
    throw new Error('aborting rather than writing a partial edit');
  }

  // the new section goes at the end of the leading prose block
  blocks[0].text += `\n${NEW_SECTION}`;

  const version = '2.1.0';
  const before = JSON.stringify(page.content).length;
  const after = JSON.stringify(blocks).length;
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  ${before} -> ${after} B  (${replacements.length} replacements)`);

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'The operative governance repository moved to github.com/RadixDAO/governance-framework on 29 Aug 2026 (RAC announcement t.me/RadixAccountabilityCouncil/920) and GP-PRE-1 was rewritten with it: all 21 manifest hashes now recorded, a signing certificate identified in a new section 2A, and the voting system renamed Consultation V3. Adds a dated section on the signed manifest, the 23 signed PDFs in pending/signed, the promotion lifecycle, and radixdao.org opening as the Official Venue with its first two notices.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
