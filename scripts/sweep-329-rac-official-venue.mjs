/**
 * Run 329 (community rotation, signal-led edit).
 *
 * The RAC page's last dated section was its 13 August status update. On
 * 29 August 2026 the council posted twice: the MIDAO service agreement was
 * amended and accepted so the incorporation submission can begin, the
 * governance repository moved into the RadixDAO GitHub organisation, and
 * radixdao.org opened as the DAO's Official Venue carrying its first two
 * signed notices.
 *
 * Sources: t.me/RadixAccountabilityCouncil/918 and /920 (29 Aug 2026);
 * radixdao.org/notices.json and the two notice pages; the GitHub API for the
 * RadixDAO organisation and its repositories.
 */
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'ecosystem';
const SLUG = 'radix-accountability-council';
const SENTINEL = 'the-official-venue-opens-29-august-2026';
const DRY = process.argv.includes('--dry-run');

const NEW_SECTION = {
  type: 'content',
  text: `<h2 id="${SENTINEL}">29 August 2026: the Official Venue opens</h2>
<p>The council posted twice in one day, and between them the three workstreams above each moved by a measurable step.</p>
<h3>Formation</h3>
<p>The <a href="https://t.me/RadixAccountabilityCouncil/918" target="_blank" rel="noopener">first update</a> reports that the council and its counsel evaluated MIDAO's Service Agreement, proposed amendments to improve the DAO's position under its terms, and that MIDAO accepted them. The council will sign the amended agreement, pay, and submit the incorporation of <strong>Radix DAO LLC</strong> through MIDAO's onboarding platform, with the next actions on the council's own side and the submission rolling out "from Monday onwards" &ndash; 31 August 2026 at the earliest. Once filed, the council puts the Marshall Islands registry at <strong>four to six weeks</strong> to grant and issue the Certificate of Formation, and says it will report on advancements rather than on each of the process's many steps.</p>
<h3>The repository leaves a personal account</h3>
<p>The <a href="https://t.me/RadixAccountabilityCouncil/920" target="_blank" rel="noopener">second update</a> completes a move the council had trailed hours earlier: the community's governance repository is now hosted under the DAO's own GitHub organisation, <a href="https://github.com/RadixDAO" target="_blank" rel="noopener">github.com/RadixDAO</a>, as <a href="https://github.com/RadixDAO/governance-framework" target="_blank" rel="noopener">RadixDAO/governance-framework</a>, having been transferred over from <a href="/community/daffy" rel="noopener">Daffy</a>'s personal account. The council asked the community to adjust all links to it and to treat those two URLs as the sources. The framework itself is now signed: every document in the ratification manifest carries a SHA-256 and the certificate that signed them is published in its own right &ndash; the detail is on the <a href="/ideas/radix-network-dao-charter" rel="noopener">Radix DAO Charter</a> page.</p>
<h3>An official venue, and what it is for</h3>
<p><a href="https://radixdao.org/" target="_blank" rel="noopener">radixdao.org</a> went live the same day as the DAO's <strong>Official Venue</strong>, the term the Operating Agreement uses for the place a ratified document must be published to. Daffy and <a href="/ecosystem/astrolescent" rel="noopener">Timan</a> built it and automated its deployment from GitHub. Its Notices &amp; Records section opened with two entries, both dated 29 August 2026 and both linking a signed PDF: the <a href="https://radixdao.org/notices/2026-08-29-transition-rac-certificate-technical-information-and-details/" target="_blank" rel="noopener">technical details of the certificate the Transition RAC signs with</a>, published at 15:07&nbsp;UTC so that any signature can be checked against it, and <a href="https://radixdao.org/notices/2026-08-29-transition-rac-s-decisions-to-enable-and-support-the-ratification-process/" target="_blank" rel="noopener">the full minute of the council's 25 August meeting</a> at 16:41&nbsp;UTC, recording the decisions that enable the ratification process. The site's footer draws the line the transition depends on: Radix DAO LLC is a separate legal entity from <a href="/ecosystem/radix-foundation" rel="noopener">Radix Publishing Ltd</a>, which operates radixdlt.com.</p>
<h3>Ratification, still undated</h3>
<p>The council says it will formally initiate ratification of the Charter and the policies "as soon as possible", with only a few details left to clear, and that this will get a post of its own. The process begins with a <strong>discussion period</strong> supported by a new topic on <a href="/ecosystem/radixtalk" rel="noopener">RadixTalk</a>. No date is attached to any of it, and the venue's own banner states the position plainly: pre-formation, ratification vote pending, community decisions advisory until activation.</p>`,
};

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

const replacements = [
  [`<tr><td>DAO Entity</td><td>Marshall Islands DAO LLC (MIDAO) – in formation</td></tr>`,
   `<tr><td>DAO Entity</td><td>Radix DAO LLC – Marshall Islands DAO LLC (MIDAO), submission from 31 Aug 2026</td></tr>`],
  [`<tr><td>Consultations</td><td><a href="/ecosystem/radixtalk">RadixTalk</a> · <a href="https://consultation.mountain-top.live/" target="_blank" rel="noopener">Radix Consultation dApp</a></td></tr>`,
   `<tr><td>Official Venue</td><td><a href="https://radixdao.org/" target="_blank" rel="noopener">radixdao.org</a> (from 29 Aug 2026)</td></tr>\n<tr><td>Consultations</td><td><a href="/ecosystem/radixtalk">RadixTalk</a> · <a href="https://consultation.mountain-top.live/" target="_blank" rel="noopener">Radix Consultation dApp</a></td></tr>`],
  [`<a href="https://github.com/Shadaffy/radix-dao-governance" target="_blank" rel="noopener">open governance repository</a>`,
   `<a href="https://github.com/RadixDAO/governance-framework" target="_blank" rel="noopener">open governance repository</a>`],
  [`<li><a href="https://github.com/Shadaffy/radix-dao-governance" target="_blank" rel="noopener">Radix DAO Governance repository (Operating Agreement &amp; Charter drafts)</a></li>`,
   `<li><a href="https://github.com/RadixDAO/governance-framework" target="_blank" rel="noopener">RadixDAO/governance-framework – the operative governance documents</a></li>\n<li><a href="https://radixdao.org/" target="_blank" rel="noopener">radixdao.org – the DAO's Official Venue</a></li>`],
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

  const hits = new Set();
  const apply = (text) => {
    let out = text;
    for (const [from, to] of replacements) {
      if (out.includes(from)) { out = out.split(from).join(to); hits.add(from.slice(0, 48)); }
    }
    return out;
  };
  for (const b of blocks) {
    if (typeof b.text === 'string') b.text = apply(b.text);
    for (const n of b.blocks || []) if (typeof n.text === 'string') n.text = apply(n.text);
  }
  const missed = replacements.filter(([from]) => !hits.has(from.slice(0, 48)));
  if (missed.length) {
    for (const [from] of missed) console.error('   MISS:', from.slice(0, 110));
    throw new Error('aborting rather than writing a partial edit');
  }

  const idx = blocks.findIndex((b) => typeof b.text === 'string' && b.text.includes('<h2>External Links</h2>'));
  if (idx < 0) throw new Error('could not locate the External Links block');
  blocks.splice(idx, 0, { id: uid(), ...NEW_SECTION });

  const version = '2.6.0';
  const before = JSON.stringify(page.content).length;
  const after = JSON.stringify(blocks).length;
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  ${before} -> ${after} B  (${replacements.length} replacements, new section at index ${idx})`);

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Brings the council record to 29 Aug 2026 from its two updates that day (t.me/RadixAccountabilityCouncil/918 and /920): the MIDAO Service Agreement amended and accepted with the incorporation submission from 31 Aug and 4-6 weeks for the Certificate of Formation; the governance repository moved off a personal account into github.com/RadixDAO; and radixdao.org opened as the Official Venue with its first two signed notices. Repoints the three repository citations.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
