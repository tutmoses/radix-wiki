// Run 576 (ideas rotation): 21 /ideas cards close their "Dependencies & cross-references" list with
// the same line, written before the framework moved off a personal account, saying each card is
// "Governed by Daffy's Radix DAO framework (repo Shadaffy/radix-dao)". GP-PRE-1 ratified the framework
// on 2 October 2026 and the ratified text lives in RadixDAO/governance-framework, so the line now
// names that repository and keeps Shadaffy/radix-dao as the reference library of earlier drafts.
// dao-proposal-voting-framework already carried the corrected line; it loses a doubled "see".
// The three cards read in full this run (the stalest, last touched 1 Sep) are stamped verified.
import { isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');
const RFC = '<a href="https://radixtalk.com/t/rfc-dao-governance-framework-reference-repo/2268" target="_blank" rel="noopener">Governance Framework Reference Repo</a>';
const R1 = '<a href="https://radixtalk.com/t/rfc-dao-documents-round1-the-charter/2269" target="_blank" rel="noopener">Charter (Round 1)</a>';
const OLD = `<li>Governed by <a href="https://github.com/Shadaffy/radix-dao" target="_blank" rel="noopener">Daffy's Radix DAO framework</a> (repo <code>Shadaffy/radix-dao</code>); see the ${RFC} and ${R1}.</li>`;
const NEW = `<li>Governed by the framework the DAO <a href="/ideas/dao-adopt-phase1-governance-docs#ratified-2-october-2026" rel="noopener">ratified on 2 October 2026</a>, held in <a href="https://github.com/RadixDAO/governance-framework" target="_blank" rel="noopener"><code>RadixDAO/governance-framework</code></a>; Daffy's <a href="https://github.com/Shadaffy/radix-dao" target="_blank" rel="noopener"><code>Shadaffy/radix-dao</code></a> is the reference library of earlier drafts. See the ${RFC} and ${R1} RFCs.</li>`;
const SENTINEL = 'the DAO <a href="/ideas/dao-adopt-phase1-governance-docs#ratified-2-october-2026" rel="noopener">ratified on 2 October 2026</a>, held in';
const VERIFIED = new Set(['dao-community-moderators', 'dao-partnerships-integrations', 'dao-product-roadmap-ownership']);

await withClient(async (client) => {
  const { rows } = await client.query(
    `SELECT id, slug, title, version, content FROM pages WHERE tag_path = 'ideas' AND content::text LIKE '%Governed by%' ORDER BY slug`);
  let n = 0;
  for (const page of rows) {
    if (isLockedPage('ideas', page.slug)) throw new Error(`${page.slug} is LOCKED`);
    const blocks = JSON.parse(JSON.stringify(page.content));
    const walk = (bs) => bs.flatMap((b) => [b, ...(b.blocks ? walk(b.blocks) : [])]);
    let message;
    if (page.slug === 'dao-proposal-voting-framework') {
      const hits = walk(blocks).filter((b) => b.text?.includes(`See see the ${RFC}`));
      if (!hits.length) { console.log(`  ${page.slug}: already applied`); continue; }
      hits[0].text = hits[0].text.replace(`See see the ${RFC}`, `See the ${RFC}`);
      message = 'Dependencies: doubled "see" removed.';
    } else {
      if (JSON.stringify(blocks).includes(SENTINEL)) { console.log(`  ${page.slug}: already applied`); continue; }
      const hits = walk(blocks).filter((b) => b.text?.includes(OLD));
      if (hits.length !== 1) throw new Error(`${page.slug}: line found ${hits.length} times`);
      hits[0].text = hits[0].text.replace(OLD, NEW);
      message = 'Dependencies: the governing framework is the one ratified 2 Oct 2026 in RadixDAO/governance-framework, not Shadaffy/radix-dao, which stays linked as the reference library of earlier drafts.';
    }
    const verified = VERIFIED.has(page.slug);
    const version = await writeRevision(client, page, blocks, { change: 'patch', message, verified, dry: DRY });
    console.log(`  ${DRY ? '[dry] ' : ''}${page.slug}  v${page.version} -> v${version}${verified ? ' (verified)' : ''}`);
    n++;
  }
  console.log(`  ${n} pages`);
});
