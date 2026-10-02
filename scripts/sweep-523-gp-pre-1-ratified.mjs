// Sweep 523: GP-PRE-1 closed at 15:18 UTC on 2 Oct 2026 and ratified the Charter and its 20
// policies. Final tally read 23:1x UTC 2 Oct from vote.radixdao.org/proposal/0 and its
// /vote-results endpoint: 1,857,159,221 XRD Approve, nothing on Reject or Abstain;
// /account-votes lists 193 accounts. Transition RAC announcement: t.me/RadixAccountabilityCouncil/1126
// (21:49 UTC). RadixDAO/governance-framework last commit 470a047 (20 Sep), everything still under
// pending/; radixdao.org/notices.json newest item 29 Aug. Three cards updated.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, uid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const SENTINEL = 'RadixAccountabilityCouncil/1126';
const a = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const BALLOT = 'https://vote.radixdao.org/proposal/0';
const RAC = 'https://t.me/RadixAccountabilityCouncil/1126';
const GP = 'https://github.com/RadixDAO/governance-framework/blob/main/pending/GP-PRE-1-Framework-Ratification.md';

const replaceOnce = (text, oldS, newS, label) => {
  const n = text.split(oldS).length - 1;
  if (n !== 1) throw new Error(`${label}: expected 1 match, found ${n}`);
  return text.replace(oldS, newS);
};

const EDITS = [
  {
    tagPath: 'ideas', slug: 'radix-network-dao-charter', version: '2.11.0',
    message: 'Sweep 523: GP-PRE-1 ratified. The ballot closed 15:18 UTC 2 Oct 2026 with 1,857m XRD for from 193 accounts and none against or abstaining (vote.radixdao.org/proposal/0); the Transition RAC announced ratification (t.me/RadixAccountabilityCouncil/1126). Infobox Type and Vote status updated; new section records the result and that neither the repository nor the Official Venue records it yet.',
    apply(blocks) {
      const box = blocks.find((b) => b.type === 'infobox');
      const inner = box.blocks[0];
      inner.text = replaceOnce(inner.text, 'Governance constitution (ratification pending)', 'Governance constitution (ratified 2 October 2026)', 'type row');
      const vs = inner.text.match(/<tr><td><strong>Vote status<\/strong><\/td><td>[\s\S]*?<\/td><\/tr>/);
      if (!vs) throw new Error('vote status row not found');
      inner.text = inner.text.replace(vs[0], `<tr><td><strong>Vote status</strong></td><td>Ratified. ${a(BALLOT, 'Governance Proposal 0')} closed 15:18 UTC 2 Oct 2026 with 1,857m XRD for, none against, from 193 accounts. Temperature Check ${a('https://vote.radixdao.org/tc/0', 'tc/0')} passed 25 Sep with 99.4%</td></tr>`);
      const i = blocks.findIndex((b) => b.id === '4c32b6f2-f57c-4595-b7d1-3e1d3de1f553');
      if (i < 0) throw new Error('quorum-reached block not found');
      blocks.splice(i + 1, 0, { id: uid(), type: 'content', text:
        `<h2 id="ratified-2-october-2026">Ratified (2 October 2026)</h2>` +
        `<p>GP-PRE-1 passed when its ballot closed at 15:18 UTC on 2 October. The ${a(BALLOT, 'ballot page')} gives the final tally as 1,857m XRD of voting power for, from 193 accounts, with none against or abstaining: 137% of the 1,351m quorum and 100% approval against the 66% a Constitutional proposal needs. The Transition RAC ${a(RAC, 'announced the result')} that evening, with the Charter and the 20 policies ratified and in effect.</p>` +
        `<p>Ratification satisfies Activation Condition 6 and nothing further: the company has still to be formed and the DAO activated, through the steps under <a href="#ratification-is-not-activation" rel="noopener">Ratification is not activation</a>. Read late on 2 October, neither published record has caught up with the vote: the ${a('https://github.com/RadixDAO/governance-framework', 'governance repository')} still holds every ratified document under <code>pending/</code>, its last commit dated 20 September, and the ${a('https://radixdao.org/notices.json', 'Official Venue notice feed')} has no entry after 29 August. The next ballot in the sequence is <a href="/ideas/dao-elect-permanent-rac" rel="noopener">GP-ELECT-1, the Permanent RAC election</a>.</p>` });
    },
  },
  {
    tagPath: 'ideas', slug: 'dao-adopt-phase1-governance-docs', version: '2.3.0',
    message: 'Sweep 523: GP-PRE-1 ratified 2 Oct 2026 (1,857m XRD for, none against, 193 accounts; vote.radixdao.org/proposal/0, t.me/RadixAccountabilityCouncil/1126). Infobox Latest row and the submit-the-vote deliverable updated; new section notes the three 6 Sep review fixes missing from the ratified text now go through the Governance Maintenance & Upgrade Framework, per GP-PRE-1 section 5.',
    apply(blocks) {
      const box = blocks.find((b) => b.type === 'infobox');
      box.blocks[0].text = replaceOnce(box.blocks[0].text, '28 Sep 2026 – GP-PRE-1 on ballot until 2 Oct, quorum passed 27 Sep, no vote against', '2 Oct 2026 – GP-PRE-1 ratified, no vote against', 'latest row');
      blocks[1].text = replaceOnce(blocks[1].text, '<li>Submit GP-PRE-1 and open the vote. Done – on ballot from 25 September to 2 October 2026.</li>', '<li><s>Submit GP-PRE-1 and open the vote.</s> Ratified 2 October 2026.</li>', 'deliverable');
      const i = blocks.findIndex((b) => b.id === 'a76a4383-f550-448e-a4f5-6b080ca37a74');
      if (i < 0) throw new Error('on-the-ballot block not found');
      blocks.splice(i + 1, 0, { id: uid(), type: 'content', text:
        `<h2 id="ratified-2-october-2026">Ratified (2 October 2026)</h2>` +
        `<p>The ballot closed at 15:18 UTC on 2 October with 1,857m XRD for, from 193 accounts, and none against or abstaining, and the Transition RAC ${a(RAC, 'announced the framework ratified')}. <a href="/ideas/radix-network-dao-charter#ratified-2-october-2026" rel="noopener">The Charter card</a> has the thresholds it cleared.</p>` +
        `<p>The three review fixes named above are not in the ratified text, so they can no longer be made before the vote. ${a(GP, 'GP-PRE-1')} sends any change after ratification through the Governance Maintenance &amp; Upgrade Framework, which is one of the 21 documents it ratified, so each fix now needs a proposal of its own.</p>` });
    },
  },
  {
    tagPath: 'ideas', slug: 'dao-governance-app-consultation-v2', version: '1.7.0',
    message: 'Sweep 523: proposal 0 (GP-PRE-1) closed 15:18 UTC 2 Oct 2026; final published tally 1,857m XRD on Approve from 193 accounts, nothing on Reject or Abstain (vote.radixdao.org/vote-results and account-votes, entityId=0). Tense corrected and the final figure added beside the 1 Oct reading.',
    apply(blocks) {
      const b = blocks.find((x) => x.text?.includes('By the reading it held 190 ballots'));
      if (!b) throw new Error('consultation passage not found');
      b.text = replaceOnce(b.text, 'and closes at 15:18&nbsp;UTC on 2 October. By the reading it held', 'and closed at 15:18&nbsp;UTC on 2 October. At the 1 October reading it held', 'closes');
      b.text = replaceOnce(b.text, 'with nothing on Reject or Abstain. The Majority Judgment', `with nothing on Reject or Abstain. The final tally was 1,857m on Approve from 193 accounts, still with nothing against, and the framework is ${a(RAC, 'ratified')}. The Majority Judgment`, 'final');
    },
  },
];

const DRY = process.argv.includes('--dry-run');
for (const e of EDITS) if (/\u2014|\u00a0/.test(e.message)) throw new Error('em dash or nbsp in message');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();
try {
  for (const e of EDITS) {
    if (isLockedPage(e.tagPath, e.slug)) throw new Error(`${e.slug} is LOCKED`);
    const { rows } = await client.query('SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [e.tagPath, e.slug]);
    if (!rows.length) throw new Error(`${e.slug} not found`);
    const page = rows[0];
    if (JSON.stringify(page.content).includes(SENTINEL)) { console.log(`  ${e.slug}: already applied, no write`); continue; }
    const before = JSON.stringify(page.content);
    const blocks = JSON.parse(before);
    e.apply(blocks);
    const json = JSON.stringify(blocks);
    const added = (json.match(/\u2014|\u00a0/g) || []).length - (before.match(/\u2014|\u00a0/g) || []).length;
    if (added > 0) throw new Error(`${e.slug}: edit adds an em dash or nbsp`);
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${e.version}  (+${json.length - before.length} chars)`);
    if (!DRY) {
      const now = new Date().toISOString();
      await client.query('BEGIN');
      await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, e.version, now, page.id]);
      await client.query(
        `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [cuid(), page.id, json, page.title, e.version, 'minor', AUTHOR_ID, e.message, now]);
      await client.query('COMMIT');
    }
  }
} finally {
  client.release();
  await pool.end();
}
