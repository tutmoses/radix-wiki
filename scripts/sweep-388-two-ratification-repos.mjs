// Run 388 (ideas rotation).
//
// The Transition RAC told readers on 7 September that the amendments raised against the
// ratifiable framework had been "incorporated where possible, please check it out". They
// have been. They are just not in the repository the DAO moved the framework into, that
// GP-PRE-1's manifest hashes, that the Charter card cites, and that the ratification vote
// will be taken on. Read on 8 September 2026 the two copies have diverged in both
// directions, and neither is a superset of the other.
//
// Two pages:
//   ideas/dao-adopt-phase1-governance-docs  - the rotation edit: a "Where it stands
//                                             (8 September 2026)" section replacing a
//                                             19 August position, plus the repo finding
//   ideas/dao-incorporate-duna-llc          - correction: the filing date arrived on
//                                             7 September without the filing
//
// Sources read this run (all pinned, all 8 September 2026):
//   api.github.com/repos/RadixDAO/governance-framework            main = 14a0510a, 27 Aug 13:25:05Z
//     .../branches                                                main + ratification-preparation, same sha
//     .../pulls?state=all                                         empty: no PR has ever been opened
//     .../git/trees/14a0510a?recursive=1                          31 markdown blobs
//   api.github.com/repos/Shadaffy/radix-dao-governance            master = b1ab01ab, 6 Sep 21:30:49Z
//     .../pulls/1                                                 opened 20:57:53Z, merged 21:25:50Z, 6 Sep
//     .../commits/b1ab01ab                                        eight amended documents
//     .../git/trees/b1ab01ab?recursive=1                          34 markdown blobs; 26 of 30 shared differ
//   contents API pinned at both commits                           Exec 5.3, Roles Registry, Source Code 5
//   radixtalk.com/t/2330.json                                     Daffy posts 18 and 19, 6 Sep 21:04 / 21:19 UTC
//   t.me/RadixAccountabilityCouncil/1000?embed=1                  projectShift, channel post, 7 Sep 20:45:41 UTC
//   radixdao.org/notices.json                                     still the two items of 29 August
//   mainnet.radixdlt.com/status/gateway-status                    11:03:42 UTC, state version 557,840,622

import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');

const GF = 'https://github.com/RadixDAO/governance-framework';
const SD = 'https://github.com/Shadaffy/radix-dao-governance';

const PHASE1_SECTION = `<h2 id="where-it-stands-8-september-2026">Where it stands (8 September 2026)</h2>
<p>The section above is the position on 19 August and is kept as the record of it. Three things have moved since. GP-PRE-1 opened its Discussion phase on 30 August 2026 and <a href="/ideas/radix-network-dao-charter" rel="noopener">lost its closing date on 2 September</a>. The operative repository moved off a personal account on 29 August. And on <strong>6 September 2026</strong> the ratifiable text was amended for the first time since it was signed. The amendments are real, dated and public. They are not in the repository the DAO moved the framework into.</p>
<h3 id="the-amendments-of-6-september">The amendments of 6 September</h3>
<p>Two posts in the <a href="https://radixtalk.com/t/charter-policies-ratification-discussion/2330" target="_blank" rel="noopener">ratification discussion</a> set out what changed. At <strong>21:04&nbsp;UTC</strong> Daffy <a href="https://radixtalk.com/t/2330/18" target="_blank" rel="noopener">reported a treasury change</a> across five documents: the Single Transaction Limit of $12,000 USDC stands and splitting an obligation to fit under it stays forbidden, so a payment that genuinely is one payment now needs a <strong>Large Milestone Authorization</strong> instead, carried at &ge;66% YES, executed at the 4-of-5 high-risk threshold after a 72-hour delay and only once delivery is verified. His summary of it is that the bar goes up, not the limit. Fifteen minutes later he <a href="https://radixtalk.com/t/2330/19" target="_blank" rel="noopener">answered a contributor review</a>: seven of thirteen points incorporated, four declined as already covered by the text, and one, the Roles Registry giving the RAC a power the Proposal &amp; Voting Framework gives the electorate, called the best catch in the batch.</p>
<p>That second post is also the one that says where the fixes are, and it is precise. Two were <q>in an open PR</q>. Three were <q>on a follow-up branch</q>. Both statements were true of <a href="${SD}" target="_blank" rel="noopener"><code>Shadaffy/radix-dao-governance</code></a>, the personal repository, at the minute he wrote them: <a href="${SD}/pull/1" target="_blank" rel="noopener">its pull request #1</a> was opened at 20:57:53&nbsp;UTC and merged at 21:25:50, six minutes after the post, and the three follow-up commits landed four seconds after that. The repository was pushed at <strong>21:30:49&nbsp;UTC</strong>, and the commit at the head of <code>master</code> trues up the dates on <strong>eight amended documents</strong>: the Parameters Registry, Treasury Signers Rules, Execution &amp; Treasury Actions, Contributor Compensation, On-Chain Identifiers, Governance Continuity, Working Group Framework and Source Code Stewardship.</p>
<h3 id="the-daos-own-copy-is-not-the-amended-one">The DAO's own copy is not the amended one</h3>
<p>The repository under the DAO's own organisation, <a href="${GF}" target="_blank" rel="noopener"><code>RadixDAO/governance-framework</code></a>, has received none of it. Read on 8 September 2026 its <code>main</code> is at commit <code>14a0510a</code> of <strong>27 August 2026, 13:25:05&nbsp;UTC</strong>, whose message is that it records the SHA-256 hashes of the signed PDFs in the GP-PRE-1 manifest. It holds five commits in total. It has two branches, <code>main</code> and <code>ratification-preparation</code>, and they point at the same commit. Its pull-request list is empty for every state: <strong>no pull request has ever been opened there</strong>, so the one Daffy pointed readers to is not a pull request in the repository they would have gone to.</p>
<p>Compared file by file at the two head commits, <strong>26 of the 30 documents present in both differ</strong>. Four are byte-identical: the Charter Reading Guide, the Policy Library Reading Guide, the Election Methods Guide and the Operating Agreement. The personal repository also carries <code>GP-ELECT-1</code> and <code>GP-ACTIVATE-1</code>, the second and third of the three binding votes described above, which the organisation's copy does not contain at all.</p>
<p>Three of the differences are worth reading, because each is a rule rather than a wording preference.</p>
<ul>
<li><strong>Who can be overridden.</strong> Execution &amp; Treasury Actions &sect;5.3 in the organisation's copy reads that where the RAC <q>determines that a refusal is invalid</q> it <q>may instruct remaining signers to proceed with execution directly</q>, and stops there. The personal copy narrows the first half to a refusal grounded in Treasury Signers Rules &sect;9, adds that <q>a mandatory refusal under Treasury Signers Rules &sect;8.2 is not subject to this paragraph</q>, and defines the second half: the instruction <q>bypasses the refusing or unresponsive signer, not the signing threshold</q>. On the organisation's text, the council's override still reaches a refusal a signer is obliged to make.</li>
<li><strong>Who picks the election method.</strong> The Roles Registry in the organisation's copy still reads that the election mechanism <q>is selected by the RAC when it creates the election</q>. That is the contradiction with Proposal &amp; Voting Framework &sect;4.5 that Daffy reported fixed.</li>
<li><strong>When the patch clock starts.</strong> Source Code Stewardship in the organisation's copy says only that the RAC <q>acknowledges receipt within 48 hours and assesses severity within 7 days</q>. The personal copy adds a 48-hour assessment where a report indicates Critical severity on its face, and states that the patch timelines run <q>from receipt of the report</q>. The Critical patch window is 72 hours, and on the organisation's text nothing says when it begins. That is not an abstract question for a network that <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">has committed no round since 31 August</a>.</li>
</ul>
<p>The divergence does not run one way, which is why neither copy can simply be adopted over the other. The Charter and the Proposal &amp; Voting Framework are dated 27 August in the organisation's copy and 25 August in the personal one, and it is the organisation's copy that carries the manifest recording the hashes of the signed PDFs. The two also disagree about their own format: one stamps a version and date in an italic line, the other in a table row.</p>
<h3 id="what-that-means-for-the-vote">What that means for the vote</h3>
<p>GP-PRE-1 ratifies a set of documents by manifest, and the manifest lives in the organisation's repository against hashes of PDFs signed to the 27 August text. Daffy's own note on the treasury change says the <q>signed PDFs will be updated and resigned before Temperature Check</q>, so the divergence is understood on his side and has a stated remedy. It is not yet public, and until it is, a reader following the Transition RAC's instruction on 7 September to <q>check it out</q> arrives at the unamended set.</p>
<p>The Official Venue has not closed the gap either. Read at <strong>11:13&nbsp;UTC on 8 September 2026</strong>, <a href="https://radixdao.org/notices.json" target="_blank" rel="noopener">the notices feed</a> holds the same two items it has held since 29 August, and its Process notices category is still empty. Nine days after the Discussion phase opened, the venue the framework designates for official acts has recorded neither its opening, nor its extension, nor the first amendments to the text it is about.</p>`;

const PHASE1_INFOBOX_OLD = '<tr><th>Latest</th><td>19 Aug 2026 – GP-PRE-1 drafted, not yet submitted; first of three binding votes</td></tr>';
const PHASE1_INFOBOX_NEW = '<tr><th>Latest</th><td>8 Sep 2026 – Discussion phase open-ended; the 6 Sep amendments are in the personal repo, not the DAO\'s</td></tr>';

const DUNA_INTRO_OLD = 'the agreement with the registered agent is signed and paid, and the registry filing begins on 7 September 2026.</p>';
const DUNA_INTRO_NEW = 'the agreement with the registered agent is signed and paid, and on 7 September 2026, the day the filing was to begin, the council said the submission to the registry had still to be made.</p>';

const DUNA_SECTION = `<h3 id="7-september-the-date-arrives-without-the-filing">7 September 2026: the date arrives without the filing</h3>
<p>Monday came and the registry clock did not start. At <strong>20:45:41&nbsp;UTC on 7 September 2026</strong> the Transition RAC posted <a href="https://t.me/RadixAccountabilityCouncil/1000" target="_blank" rel="noopener">a status update</a> to its own channel, signed as the earlier ones were by projectShift and verified as a channel post rather than a forward. Its legal section reads that <q>the actual sign-up for MIDAO's service as been concluded and the Transition RAC is now doing the necessary steps to complete the process up to the point where it's up to MIDAO to submit the request to MI</q>. It adds that this is <q>still a bit more of administrative work on our part</q>.</p>
<p>Read against <a href="#signed-paid-filed-from-monday">the 5 September update above</a>, that is a smaller claim than the one the date was given for. Signing and paying MIDAO completed the engagement; it did not lodge anything with the Marshall Islands. The submission is MIDAO's to make, the transition council's own administrative steps come first, and on the evening of the day the process was scheduled to begin they were not finished. No new date was given.</p>
<p>The consequence runs through the rest of this card. The four to six weeks the council put on the registry runs from the filing, so the mid-October to mid-November window for the Certificate of Formation moves with it, and every deliverable below dated <q>from 7 September</q> is waiting on a submission that has not been made. This is still the one leg of the transition that runs through a registry in Majuro rather than through <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">the halted network</a>, which is why it is worth dating precisely.</p>`;

const targets = [
  {
    tagPath: 'ideas',
    slug: 'dao-adopt-phase1-governance-docs',
    version: '2.1.0',
    changeType: 'minor',
    sentinel: 'where-it-stands-8-september-2026',
    message:
      'Run 388: a 19 August position replaced by an 8 September one. The 6 September amendments to the ratifiable framework (Large Milestone Authorization across five documents; seven of thirteen review points) are in Shadaffy/radix-dao-governance at b1ab01ab, not in RadixDAO/governance-framework, whose main is at 14a0510a of 27 August, has never had a pull request, and differs from the personal copy in 26 of the 30 shared documents. Worked examples pinned at both commits: Exec 5.3, the Roles Registry election mechanism, the Critical patch clock. Notices feed still the two items of 29 August.',
    mutate(blocks) {
      const ib = blocks.find((b) => b.type === 'infobox');
      const row = ib?.blocks?.[0];
      if (!row || !row.text.includes(PHASE1_INFOBOX_OLD)) throw new Error('phase1 infobox Latest row not found');
      row.text = row.text.replace(PHASE1_INFOBOX_OLD, PHASE1_INFOBOX_NEW);
      blocks.push({ id: uid(), type: 'content', text: PHASE1_SECTION });
      return 'infobox Latest re-stamped, new 8 September section appended';
    },
  },
  {
    tagPath: 'ideas',
    slug: 'dao-incorporate-duna-llc',
    version: '1.4.0',
    changeType: 'minor',
    sentinel: '7-september-the-date-arrives-without-the-filing',
    message:
      "Run 388: the filing date arrived without the filing. RAC status update t.me/RadixAccountabilityCouncil/1000, 7 September 20:45:41 UTC, projectShift, embed-verified: the MIDAO sign-up is concluded and the council is working the steps up to the point where MIDAO submits the request to the Marshall Islands, with administrative work still on its side. The intro's flat claim that the filing begins on 7 September is corrected against it, and the certificate window moves with the submission.",
    mutate(blocks) {
      const body = blocks.find((b) => b.type === 'content' && b.text.includes(DUNA_INTRO_OLD));
      if (!body) throw new Error('duna intro sentence not found');
      body.text = body.text.replace(DUNA_INTRO_OLD, DUNA_INTRO_NEW);
      const at = body.text.indexOf('<h2>Deliverables</h2>');
      if (at < 0) throw new Error('duna Deliverables heading not found');
      body.text = body.text.slice(0, at) + DUNA_SECTION + '\n' + body.text.slice(at);
      return 'intro corrected, 7 September section inserted before Deliverables';
    },
  },
];

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  for (const s of [PHASE1_SECTION, PHASE1_INFOBOX_NEW, DUNA_INTRO_NEW, DUNA_SECTION]) {
    if (/[ —]/.test(s)) throw new Error('new prose contains U+00A0 or an em dash');
  }

  for (const t of targets) {
    if (isLockedPage(t.tagPath, t.slug)) throw new Error(`${t.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
      [t.tagPath, t.slug],
    );
    if (!rows.length) throw new Error(`${t.tagPath}/${t.slug} not found`);
    const page = rows[0];

    if (JSON.stringify(page.content).includes(t.sentinel)) {
      console.log(`  ${t.slug}: already applied - no write`);
      continue;
    }

    const blocks = JSON.parse(JSON.stringify(page.content));
    const note = t.mutate(blocks);
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${t.version}  (${note})`);

    if (!DRY) {
      const now = new Date().toISOString();
      const json = JSON.stringify(blocks);
      await client.query('BEGIN');
      await client.query(
        'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
        [json, t.version, now, page.id],
      );
      await client.query(
        `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [cuid(), page.id, json, page.title, t.version, t.changeType, AUTHOR_ID, t.message, now],
      );
      await client.query('COMMIT');
    }
  }
} finally {
  client.release();
  await pool.end();
}
