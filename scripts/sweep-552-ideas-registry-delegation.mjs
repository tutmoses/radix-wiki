// Sweep 552 (ideas rotation): the two stalest cards (updated 1 Sep) still cited Shadaffy/radix-dao-governance, last pushed
// 6 Sep. GP-PRE-1 §2B names RadixDAO/governance-framework; GP-PRE-1 ratified 2 Oct. Compared 7 Oct 2026:
//  - pending/parameters/dao-parameters-registry.md differs in one row: the short Temperature Check floor rose from >=1 day
//    to >=2 days and now also governs tie runoffs (commit 9b490d1, 18 Sep, before the TC opened 20 Sep). Document 2 in
//    GP-PRE-1 §2.
//  - pending/governance/delegate-mandate.md differs only in its header date (25 -> 27 Aug).
// Ledger, read through the Gateway at epoch 347,475 (19:1x UTC 7 Oct): Radix DAO Consultations still runs Governance 1.0.0;
// the five parameter sets are unchanged since the 12 Aug writes; temperature_check_count 1, proposal_count 1,
// majority_judgment_election_count 0. TC #0 and proposal #0 are both GP-PRE-1 under dao-constitutional v1 (155 and 198
// votes; TC 20-25 Sep, binding vote 25 Sep - 2 Oct). The RadixDAO README still reads "No documents are yet operative."
import { isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');
const A = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const SH = 'https://github.com/Shadaffy/radix-dao-governance';
const GF = 'https://github.com/RadixDAO/governance-framework';
const GP = `${GF}/blob/main/pending/GP-PRE-1-Framework-Ratification.md`;
const DASH = 'https://dashboard.radixdlt.com/component/component_rdx1cp90ys553uwxuckev249x5wezucqru0u4qr7qdxdc9tlpmnh93242k';
const PRE1 = '<a href="/ideas/dao-adopt-phase1-governance-docs" rel="noopener">GP-PRE-1</a>';
const SENTINEL = 'epoch 347,475';

const URLS = [
  [`${SH}/blob/master/pending/parameters/dao-parameters-registry.md`, `${GF}/blob/main/pending/parameters/dao-parameters-registry.md`],
  [`${SH}/blob/master/pending/README.md`, `${GF}/blob/main/pending/README.md`],
  [`${SH}/blob/master/pending/governance/delegate-mandate.md`, `${GF}/blob/main/pending/governance/delegate-mandate.md`],
  [`href="${SH}"`, `href="${GF}"`],
];

const EDITS = [
  {
    slug: 'dao-parameters-registry',
    subs: [
      [/<td>23 Aug 2026 &ndash; the five parameter sets are live[^<]*<\/td>/,
        '<td>7 Oct 2026 &ndash; ratified in GP-PRE-1 on 2 Oct; the five parameter sets are unchanged on-ledger, quorums are still fixed XRD struck against total supply, and &sect;3.3A is still not encoded</td>'],
      [/a single document of roughly 59,000 characters in the <a href="([^"]+)" target="_blank" rel="noopener">operative governance repository<\/a>, and one of the twenty-one documents <a href="\/ideas\/dao-adopt-phase1-governance-docs" rel="noopener">GP-PRE-1 ratifies<\/a>\./,
        `a single document of roughly 75,000 characters in the <a href="$1" target="_blank" rel="noopener">governance repository</a> that ${A(GP, 'GP-PRE-1 §2B')} names, and document 2 of the twenty-one ${PRE1} ratified on 2&nbsp;October 2026. What was ratified is the signed PDF whose SHA-256 the proposal records; where the Markdown and that PDF differ, the PDF governs.`],
      [/a 5–7 day Temperature Check, a 5–7 day binding vote,/,
        `a 5–7 day Temperature Check (≥2 days for an election or a multi-option poll, and for a tie runoff; ${A(`${GF}/commit/9b490d1`, 'raised from one day on 18 September')}, two days before the ratification vote opened), a 5–7 day binding vote,`],
      [/(The <code>dao-election<\/code> set is the one entry with a different shape, and its terms are read out on <a href="\/ideas\/dao-elect-permanent-rac" rel="noopener">the permanent RAC card<\/a>\.<\/p>)/,
        `$1\n<h3>First use: GP-PRE-1</h3>\n<p>Read again through the Gateway at epoch 347,475 on 7&nbsp;October 2026, all five sets are as they were written on 12 August: none has been updated or retired. ${PRE1} was the first vote to run on any of them. Its temperature check (20 to 25 September, 155 votes) and its binding proposal (25 September to 2 October, 198 votes) both ran under <code>dao-constitutional</code> version 1, the five-day and seven-day windows and the 1,350,832,592 XRD binding quorum above. The <code>dao-election</code> set has not been used: the ${A(DASH, 'component')}'s election counter still reads zero.</p>`],
    ],
    message: 'Sweep 552: registry and README links repointed to RadixDAO/governance-framework, the repository GP-PRE-1 §2B names; ratified 2 Oct as document 2. Added the short Temperature Check floor (>=2 days, raised 18 Sep, commit 9b490d1). Parameter sets re-read at epoch 347,475: unchanged since 12 Aug; GP-PRE-1 (TC 155 votes, proposal 198) was the first vote on them, under dao-constitutional v1.',
  },
  {
    slug: 'dao-vote-delegation-jazzer-bot',
    subs: [
      [/read at epoch 338,958 on 28 August 2026<\/td>/, 'read at epoch 347,475 on 7 October 2026</td>'],
      [/Read at epoch 338,958 on 28 August 2026, all three of its counters still read zero\./,
        `Read at epoch 338,958 on 28 August 2026, all three of its counters read zero. Read again at epoch 347,475 on 7&nbsp;October, the component still runs <code>Governance</code> 1.0.0 and counts one temperature check and one proposal, both ${PRE1}, and no election. The 198 accounts that voted on the binding proposal each voted their own weight, because nothing on the component lets one account vote for another.`],
      [/None of this is law yet\. The policy sits in the reference library, and the DAO's <a href="[^"]+" target="_blank" rel="noopener">operative repository<\/a> is the one that carries force: "if it's there, it's law"\. Read on 28 August 2026 [\s\S]*?the delegation policy is not among them\./,
        `None of this is law yet. The policy sits in the reference library. The DAO's governance repository, ${A(GF, '<code>RadixDAO/governance-framework</code>')}, holds the twenty-one documents ${PRE1} ratified on 2&nbsp;October 2026, and the delegation policy is not among them. Even those are not yet operative: read on 7&nbsp;October, the repository's ${A(`${GF}/blob/main/README.md`, 'README')} says no document is, because under the Operating Agreement governance stays advisory until the Activation Vote.`],
      [/>Operative governance repository<\/a>/, '>Governance repository</a>'],
      [/Radix DAO Delegate Mandate<\/a> v1.0.0, 25 August 2026/, 'Radix DAO Delegate Mandate</a> v1.0.0, last updated 27 August 2026'],
    ],
    message: 'Sweep 552: component re-read at epoch 347,475 (Governance 1.0.0, still no delegation; counters 1 TC, 1 proposal, both GP-PRE-1, 0 elections). Operative-repository paragraph rewritten for GP-PRE-1 ratified 2 Oct, links repointed to RadixDAO/governance-framework (README: no document operative until the Activation Vote). Delegate Mandate date corrected to 27 Aug.',
  },
];

await withClient(async (client) => {
  for (const e of EDITS) {
    if (isLockedPage('ideas', e.slug)) throw new Error(`${e.slug} is LOCKED`);
    const { rows } = await client.query('SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', ['ideas', e.slug]);
    if (!rows.length) throw new Error(`${e.slug} not found`);
    const page = rows[0];
    const blocks = JSON.parse(JSON.stringify(page.content));
    if (JSON.stringify(blocks).includes(SENTINEL)) { console.log(`  ${e.slug}: already applied – no write`); continue; }
    const leaves = blocks.flatMap((b) => (b.type === 'infobox' ? b.blocks : [b]));
    for (const [from, to] of e.subs) {
      const block = leaves.find((b) => from.test(b.text ?? ''));
      if (!block) throw new Error(`${e.slug}: anchor not found ${from}`);
      block.text = block.text.replace(from, to);
    }
    for (const b of leaves) for (const [from, to] of URLS) if (b.text) b.text = b.text.split(from).join(to);
    if (JSON.stringify(blocks).includes('Shadaffy/radix-dao-governance')) throw new Error(`${e.slug}: old repository link survived`);
    const version = await writeRevision(client, page, blocks, { change: 'minor', message: e.message, verified: true, dry: DRY });
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  }
});
