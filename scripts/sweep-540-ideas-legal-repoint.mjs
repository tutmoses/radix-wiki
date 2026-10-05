// Sweep 540: /ideas/dao-foundation-ip-asset-transfer and /ideas/dao-legal-wrapper-representation
// cited the Operating Agreement and the pending/ README from Shadaffy/radix-dao-governance (last
// pushed 6 Sep). GP-PRE-1 §2B (commit 470a047, 20 Sep) names RadixDAO/governance-framework as the
// governance repository. Compared 5 Oct 2026: pending/legal/operating-agreement.md is byte-identical
// in both repos, so every clause number on the two cards holds. The RadixDAO README differs in one
// way that matters here: its formation table lists the BOIR (OA §10.5) and the Continuity Statement
// (OA §9.14) as held confidentially rather than published. Links repointed, that fact recorded,
// and the wrapper card's GP-PRE-1 sentence moved to the past tense (ratified 2 Oct).
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'ideas';
const SENTINEL = 'compared 5&nbsp;October 2026';
const DRY = process.argv.includes('--dry-run');
const A = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const GF = 'https://github.com/RadixDAO/governance-framework';
const SH = 'https://github.com/Shadaffy/radix-dao-governance';

const URLS = [
  [`${SH}/blob/master/pending/legal/operating-agreement.md`, `${GF}/blob/main/pending/legal/operating-agreement.md`],
  [`${SH}/blob/master/pending/README.md`, `${GF}/blob/main/pending/README.md`],
];
const REPO_OLD = `<li>Operative repository: ${A(SH, '<code>Shadaffy/radix-dao-governance</code>')}. The ${A('https://github.com/Shadaffy/radix-dao', 'reference library')} holds working drafts and activation history.</li>`;
const REPO_NEW = `<li>Operative repository: ${A(GF, '<code>RadixDAO/governance-framework</code>')}, which ${A(`${GF}/blob/main/pending/GP-PRE-1-Framework-Ratification.md`, 'GP-PRE-1 §2B')} names as the governance repository, with a ${A(`${GF}/tree/main/pending/signed`, 'signed PDF')} of each instrument. Its Operating Agreement is identical to the earlier copy in ${A(SH, '<code>Shadaffy/radix-dao-governance</code>')} (compared 5&nbsp;October 2026), so the clause numbers on this card hold in both.</li>`;

const EDITS = {
  'dao-foundation-ip-asset-transfer': {
    version: '2.1.0',
    replace: [
      ['<td>16 Aug 2026 – the handover is written into the Activation Conditions, with a named safe harbour for Foundation-attributable delay</td>',
        '<td>5 Oct 2026 – the Continuity Statement is listed as held confidentially; the handover remains Activation Conditions 8 and 9</td>'],
      ['which cuts directly against the published-balance deliverable below.</p>',
        `which cuts directly against the published-balance deliverable below.</p>\n<p>The Continuity Statement itself will not be published either. The ${A(`${GF}/blob/main/pending/README.md`, 'formation table')} in the governance repository lists it as "Held confidentially – OA §9.14": it is executed in the form the Foundation requires (§9.3), and Activation Condition&nbsp;8 is met by making the executed instrument available to the Transition RAC, not to the community. What the community can read is the rule in Article&nbsp;IX, not the statement signed under it.</p>`],
    ],
    message: 'Sweep 540: Operating Agreement and pending/ README links repointed from Shadaffy/radix-dao-governance to RadixDAO/governance-framework, the repository GP-PRE-1 §2B names (OA identical in both, compared 5 Oct 2026). Added that the Continuity Statement is held confidentially (README formation table, OA §9.3, §9.14, Sch. 5 condition 8). Infobox Latest re-dated.',
  },
  'dao-legal-wrapper-representation': {
    version: '2.1.0',
    replace: [
      ['<td>16 Aug 2026 – no standalone wrapper document; the function moved into the Operating Agreement, which is executed at formation rather than ratified</td>',
        '<td>2 Oct 2026 – GP-PRE-1 ratified without a standalone wrapper document; the function sits in the Operating Agreement, executed at formation rather than ratified</td>'],
      ['GP-PRE-1</a> puts to the community, and a legal wrapper policy is not among them.',
        'GP-PRE-1</a> put to the community and ratified on 2&nbsp;October 2026, and a legal wrapper policy is not among them.'],
      ['the Certificate of Formation and the BOIR template are, in the framework',
        'the Certificate of Formation and the beneficial-owner report (BOIR, held confidentially under §10.5) are, in the framework'],
    ],
    message: 'Sweep 540: Operating Agreement and pending/ README links repointed from Shadaffy/radix-dao-governance to RadixDAO/governance-framework, the repository GP-PRE-1 §2B names (OA identical in both, compared 5 Oct 2026). GP-PRE-1 sentence moved to the past tense (ratified 2 Oct); BOIR template replaced with the confidential BOIR the README now lists (OA §10.5). Infobox Latest re-dated.',
  },
};

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();
try {
  for (const [slug, edit] of Object.entries(EDITS)) {
    if (isLockedPage(TAG_PATH, slug)) throw new Error(`${slug} is LOCKED`);
    const { rows } = await client.query('SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, slug]);
    if (!rows.length) throw new Error(`${slug} not found`);
    const page = rows[0];
    let json = JSON.stringify(page.content);
    if (json.includes(SENTINEL)) { console.log(`  ${slug}: already applied – no write`); continue; }

    const blocks = JSON.parse(json);
    const walk = (bs) => bs.flatMap((b) => (b.blocks ? walk(b.blocks) : [b]));
    const leaves = walk(blocks);
    const sub = (from, to, { all = false } = {}) => {
      const hits = leaves.filter((b) => b.text?.includes(from));
      if (!hits.length) throw new Error(`${slug}: anchor not found: ${from.slice(0, 80)}`);
      for (const b of hits) b.text = all ? b.text.split(from).join(to) : b.text.replace(from, to);
    };
    sub(REPO_OLD, REPO_NEW);
    for (const [from, to] of URLS) sub(from, to, { all: true });
    for (const [from, to] of edit.replace) sub(from, to);
    json = JSON.stringify(blocks);
    if (json.includes('Shadaffy/radix-dao-governance/blob')) throw new Error(`${slug}: old blob link survived`);

    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${edit.version}`);
    if (!DRY) {
      const now = new Date().toISOString();
      await client.query('BEGIN');
      await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, edit.version, now, page.id]);
      await client.query(
        `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [cuid(), page.id, json, page.title, edit.version, 'minor', AUTHOR_ID, edit.message, now]);
      await client.query('COMMIT');
    }
  }
} finally {
  client.release();
  await pool.end();
}
