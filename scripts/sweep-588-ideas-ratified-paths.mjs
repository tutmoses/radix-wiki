// Run 588 (ideas rotation): finishes the repoint run 576 started. Five cards still cited the DAO
// rulebook at Shadaffy/radix-dao-governance pending/, a personal repository last pushed 6 September.
// GP-PRE-1 was ratified on 2 October 2026 (t.me/RadixAccountabilityCouncil/1126) and the DAO's own
// repository promoted the ratified text out of pending/ on 7 October (RadixDAO/governance-framework
// 55c81d6). Read 14 October at that head: Parameters Registry §3A.5, §6A and §7 and Proposal & Voting
// Framework §6.2.4 still carry every figure these cards quote, so only the citations move. Links inside
// a dated section ("Where it stands (19 August 2026)", "(8 September 2026)", the 26 August GP-ELECT-1
// scaffold) describe the personal repository as it was on that date and stay. Two facts move with the
// citations: the Working Group card's Latest row (ratified 2 Oct), and the election card's 90-day
// window, which now has a closing date, 31 December 2026 (registry §3A.5, from ratification).
import { isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ideas';
const GF = 'https://github.com/RadixDAO/governance-framework';
const SH = 'https://github.com/Shadaffy/radix-dao-governance';
const REG = [`${SH}/blob/master/pending/parameters/dao-parameters-registry.md`, `${GF}/blob/main/parameters/dao-parameters-registry.md`];

const EDITS = [
  {
    slug: 'dao-working-group-framework',
    change: 'patch',
    urls: [
      REG,
      [`${SH}/blob/master/pending/governance/working-group-framework.md`, `${GF}/blob/main/governance/working-group-framework.md`],
    ],
    swaps: [
      [`The <a href="${SH}" target="_blank" rel="noopener">operative governance repository</a> does not work that way.`,
        `The <a href="${GF}" target="_blank" rel="noopener">ratified framework</a> does not work that way.`],
      ['<td>16 Aug 2026 – in the GP-PRE-1 ratified set; §7 parameters settled</td>',
        '<td>2 Oct 2026 – <a href="https://t.me/RadixAccountabilityCouncil/1126" target="_blank" rel="noopener">ratified</a> inside GP-PRE-1; §7 parameters unchanged</td>'],
      [`<li><a href="${SH}/blob/master/pending/README.md" target="_blank" rel="noopener">Operative repo – pending/README.md (the ratified set)</a></li>`,
        `<li><a href="${GF}/blob/main/README.md" target="_blank" rel="noopener">RadixDAO/governance-framework – README.md (GP-PRE-1 passed; the ratified set)</a></li>`],
    ],
    message: 'Citations repoint from Shadaffy/radix-dao-governance pending/ to the ratified RadixDAO/governance-framework (55c81d6, 7 Oct): Working Group Framework, Parameters Registry §7 (figures re-read, unchanged), README. Latest row: ratified 2 Oct 2026 inside GP-PRE-1.',
  },
  {
    slug: 'dao-elect-permanent-rac',
    change: 'patch',
    urls: [
      REG,
      [`${SH}/blob/master/pending/governance/proposal-and-voting-framework.md`, `${GF}/blob/main/governance/proposal-and-voting-framework.md`],
    ],
    swaps: [
      ['The clock starts when the framework is ratified, not when the council is ready.',
        'The clock starts when the framework is ratified, not when the council is ready. The framework was <a href="https://t.me/RadixAccountabilityCouncil/1126" target="_blank" rel="noopener">ratified on 2 October 2026</a>, so the election has to open by 31 December 2026.'],
    ],
    keep: 1, // the 26 August GP-ELECT-1 scaffold link is a dated record of the personal repo
    message: 'Citations repoint from Shadaffy/radix-dao-governance pending/ to the ratified RadixDAO/governance-framework: Proposal & Voting Framework §6.2.4 and Parameters Registry §3A.5 (both re-read 14 Oct, unchanged). The 90-day election window now carries its closing date, 31 Dec 2026 (ratified 2 Oct). The dated 26 Aug GP-ELECT-1 scaffold link stays.',
  },
  {
    slug: 'dao-treasury-multisig-signers',
    change: 'patch',
    urls: [REG],
    swaps: [],
    message: 'Parameters Registry §6A citation repoints from Shadaffy/radix-dao-governance pending/ to the ratified RadixDAO/governance-framework (re-read 14 Oct: 2-of-3 for the Transition Period, unchanged).',
  },
  {
    slug: 'dao-xrd-custody',
    change: 'patch',
    urls: [REG],
    swaps: [],
    message: 'Parameters Registry §6A citation repoints from Shadaffy/radix-dao-governance pending/ to the ratified RadixDAO/governance-framework (re-read 14 Oct: 2-of-3 for the Transition Period, unchanged).',
  },
  {
    slug: 'dao-adopt-phase1-governance-docs',
    change: 'patch',
    urls: [],
    swaps: [
      [`<li><a href="${SH}/blob/master/pending/README.md" target="_blank" rel="noopener">Operative repo – pending/README.md (the ratified set and the activation sequence)</a></li>`,
        `<li><a href="${GF}/blob/main/README.md" target="_blank" rel="noopener">RadixDAO/governance-framework – README.md (the ratified set and the activation sequence)</a></li>`],
      [`<li><a href="${SH}/blob/master/PROPOSALS.md" target="_blank" rel="noopener">Operative repo – PROPOSALS.md (GP-PRE-1 / GP-ELECT-1 / GP-ACTIVATE-1)</a></li>`,
        `<li><a href="${GF}/blob/main/PROPOSALS.md" target="_blank" rel="noopener">RadixDAO/governance-framework – PROPOSALS.md (GP-PRE-1 / GP-ELECT-1 / GP-ACTIVATE-1)</a></li>`],
      [`<li><a href="${REG[0]}" target="_blank" rel="noopener">DAO Parameters Registry §3, §3A, §8A</a></li>`,
        `<li><a href="${REG[1]}" target="_blank" rel="noopener">DAO Parameters Registry §3, §3A, §8A</a> (ratified text)</li>`],
    ],
    keep: 11, // 10 links and one <code> name inside the dated 19 Aug / 8 Sep sections and the GP-PRE-1 'drafted' deliverable
    message: 'Sources list repoints README, PROPOSALS.md and the Parameters Registry from Shadaffy/radix-dao-governance to the ratified RadixDAO/governance-framework (55c81d6). Links inside the dated 19 Aug and 8 Sep sections stay as the record of the personal repo on those dates.',
  },
];

await withClient(async (client) => {
  for (const e of EDITS) {
    if (isLockedPage(TAG_PATH, e.slug)) throw new Error(`${e.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, e.slug]);
    if (!rows.length) throw new Error(`${e.slug} not found`);
    const page = rows[0];
    const blocks = JSON.parse(JSON.stringify(page.content));
    const walk = (bs) => bs.flatMap((b) => [b, ...(b.blocks ? walk(b.blocks) : [])]);
    const sentinel = e.urls.length ? e.urls.at(-1)[1] : e.swaps[0][1];
    if (JSON.stringify(blocks).includes(sentinel.replace(/"/g, '\\"'))) {
      console.log(`  ${e.slug}: already applied – no write`);
      continue;
    }
    for (const [from, to] of e.urls) {
      const n = walk(blocks).reduce((s, b) => s + (b.text ? b.text.split(from).length - 1 : 0), 0);
      if (!n) throw new Error(`${e.slug}: url not found: ${from}`);
      for (const b of walk(blocks)) if (b.text) b.text = b.text.replaceAll(from, to);
      console.log(`  ${e.slug}: ${n}x ${from.split('/').pop()}`);
    }
    for (const [find, replace] of e.swaps) {
      const hits = walk(blocks).filter((b) => b.text?.includes(find));
      if (hits.length !== 1) throw new Error(`${e.slug}: anchor found ${hits.length} times: ${find.slice(0, 80)}`);
      hits[0].text = hits[0].text.replace(find, replace);
    }
    const left = (JSON.stringify(blocks).match(/Shadaffy\/radix-dao-governance/g) || []).length;
    if (left !== (e.keep ?? 0)) throw new Error(`${e.slug}: ${left} Shadaffy/radix-dao-governance links left, expected ${e.keep ?? 0}`);
    const version = await writeRevision(client, page, blocks, { change: e.change, verified: true, dry: DRY, message: e.message });
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  }
});
