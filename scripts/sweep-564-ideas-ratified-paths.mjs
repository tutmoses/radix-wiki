// Sweep 564 (ideas rotation): GP-PRE-1 passed and RadixDAO/governance-framework promoted the
// ratified documents out of pending/ on 7 Oct 2026 (commits a4f74dc, 613b35a, 55c81d6), so 28 link
// occurrences on 7 ideas cards 404. Moved documents (byte-identical, renamed with no edits) are
// repointed to their new paths; deleted files (the GP-PRE-1 proposal, pending/README.md) are pinned
// to 470a047, the commit the ballot text matched. pending/legal/operating-agreement.md and
// pending/signed/ (formation instruments) are still live and stay. Prose that still called the
// Charter or the Proposal & Voting Framework un-ratified is brought up to the 2 Oct result.
import { isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ideas';
const GF = 'https://github.com/RadixDAO/governance-framework';
const A = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const README = A(`${GF}/blob/main/README.md`, 'repository README');

const URLS = [
  [`${GF}/blob/main/pending/constitutional/charter.md`, `${GF}/blob/main/constitutional/charter.md`],
  [`${GF}/blob/main/pending/parameters/dao-parameters-registry.md`, `${GF}/blob/main/parameters/dao-parameters-registry.md`],
  [`${GF}/blob/main/pending/governance/proposal-and-voting-framework.md`, `${GF}/blob/main/governance/proposal-and-voting-framework.md`],
  [`${GF}/blob/main/pending/governance/delegate-mandate.md`, `${GF}/blob/main/governance/delegate-mandate.md`],
  [`${GF}/blob/main/pending/GP-PRE-1-Framework-Ratification.md`, `${GF}/blob/470a047/pending/GP-PRE-1-Framework-Ratification.md`],
  [`${GF}/blob/main/pending/README.md`, `${GF}/blob/470a047/pending/README.md`],
];

// [find, replace] pairs, each required to match exactly once on its page.
const PROSE = {
  'radix-network-dao-charter': [
    // The 20 Sep hash check read the 21 PDFs that then sat in pending/signed/; pin it to that state.
    [`${GF}/tree/main/pending/signed`, `${GF}/tree/470a047/pending/signed`],
    [`<code>pending/constitutional/charter.md</code></a> in the DAO&rsquo;s operative governance repository, which moved to the <a href="https://github.com/RadixDAO" target="_blank" rel="noopener">RadixDAO</a> organisation on 29 August 2026. It is not in force. It becomes the DAO&rsquo;s constitution when the ratification vote described below passes.`,
     `<code>constitutional/charter.md</code></a> in the DAO&rsquo;s operative governance repository, which moved to the <a href="https://github.com/RadixDAO" target="_blank" rel="noopener">RadixDAO</a> organisation on 29 August 2026. The ratification vote described below passed on 2 October 2026; the ${README} still lists no document as operative until the Activation Vote.`],
    [`<code>pending/constitutional/charter.md</code></td>`, `<code>constitutional/charter.md</code></td>`],
    [`has no entry after 29 August. The next ballot`,
     `has no entry after 29 August. The repository caught up on 7 October: three commits between 20:34 and 20:43&nbsp;UTC, ${A(`${GF}/commit/a4f74dc`, '<code>a4f74dc</code>')} to ${A(`${GF}/commit/55c81d6`, '<code>55c81d6</code>')}, moved the Charter and the 20 policies out of <code>pending/</code> into their category folders without changing a byte, moved the 21 signed PDFs to ${A(`${GF}/tree/main/signed`, '<code>signed/</code>')}, deleted the GP-PRE-1 proposal file and marked GP-PRE-1 Passed in ${A(`${GF}/blob/main/PROPOSALS.md`, '<code>PROPOSALS.md</code>')}. The notice feed was still empty after 29 August when read on 10 October. The next ballot`],
  ],
  'dao-parameters-registry': [
    ['DAO Parameters Registry (operative repo, pending/parameters/)', 'DAO Parameters Registry (operative repo, parameters/)'],
    ['pending/README.md – the ratified set and document precedence', 'pending/README.md at commit 470a047 – the ratified set and document precedence'],
  ],
  'dao-proposal-voting-framework': [
    ['Settled by the framework now under ratification</h2>', 'Settled by the ratified framework</h2>'],
    ['the answer is a document the community is currently being asked to adopt.', 'the answer is a document the community ratified on 2 October 2026.'],
    ['and has been in its Discussion phase since 30 August 2026.', 'and entered its Discussion phase on 30 August 2026.'],
    ['and the discussion now runs for as long as it is needed. It is not in force.',
     `and the discussion ran on until the Temperature Check opened on 20 September. Ratification fixed the text; the ${README} lists no document as operative until the Activation Vote.`],
  ],
};

const PAGES = {
  'radix-network-dao-charter': ['minor', 'Sweep 564: GP-PRE-1 documents promoted out of pending/ on 7 Oct (RadixDAO/governance-framework a4f74dc, 613b35a, 55c81d6). Charter links repointed to constitutional/charter.md (byte-identical); the deleted GP-PRE-1 proposal file and the 20 Sep pending/signed/ hash check pinned to 470a047. Intro no longer says the Charter awaits its vote; the 2 Oct section records the 7 Oct promotion and that the notice feed still has nothing after 29 Aug (read 10 Oct).'],
  'dao-proposal-voting-framework': ['minor', 'Sweep 564: Proposal & Voting Framework link repointed to governance/ after the 7 Oct promotion (byte-identical file). Section re-tensed: ratified 2 Oct inside GP-PRE-1; the discussion ran until the 20 Sep Temperature Check; README lists no document operative before the Activation Vote.'],
  'dao-parameters-registry': ['patch', 'Sweep 564: registry link repointed to parameters/ after the 7 Oct promotion (byte-identical file); deleted GP-PRE-1 proposal and pending/README.md links pinned to 470a047.'],
  'dao-vote-delegation-jazzer-bot': ['patch', 'Sweep 564: Delegate Mandate links repointed to governance/ after the 7 Oct promotion (byte-identical file).'],
  'dao-foundation-ip-asset-transfer': ['patch', 'Sweep 564: deleted GP-PRE-1 proposal and pending/README.md links (formation table, activation sequence) pinned to 470a047 after the 7 Oct promotion; Operating Agreement and pending/signed/ links still live and unchanged.'],
  'dao-legal-wrapper-representation': ['patch', 'Sweep 564: deleted GP-PRE-1 proposal and pending/README.md links (ratification set) pinned to 470a047 after the 7 Oct promotion; Operating Agreement and pending/signed/ links still live and unchanged.'],
  'dao-adopt-phase1-governance-docs': ['patch', 'Sweep 564: deleted GP-PRE-1 proposal link pinned to 470a047 after the 7 Oct promotion.'],
};

const count = (s, f) => s.split(f).length - 1;

await withClient(async (client) => {
  for (const [slug, [change, message]] of Object.entries(PAGES)) {
    if (isLockedPage(TAG_PATH, slug)) throw new Error(`${slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, slug]);
    if (!rows.length) throw new Error(`${slug} not found`);
    const page = rows[0];
    // Text edits run on the parsed blocks so quotes and entities match the stored HTML.
    const blocks = JSON.parse(JSON.stringify(page.content));
    const edits = [...(PROSE[slug] || []), ...URLS];
    const walk = (bs, fn) => bs.forEach((b) => {
      if (typeof b.text === 'string') b.text = fn(b.text);
      if (b.blocks) walk(b.blocks, fn);
      if (b.columns) b.columns.forEach((c) => walk(c.blocks || [], fn));
    });
    let present = 0;
    walk(blocks, (t) => { present += edits.filter(([from]) => t.includes(from)).length; return t; });
    if (!present) { console.log(`  ${slug}: already applied — no write`); continue; }
    const hits = [];
    for (const [from, to] of edits) {
      let n = 0;
      walk(blocks, (t) => { n += count(t, from); return t.split(from).join(to); });
      const required = (PROSE[slug] || []).some(([f]) => f === from);
      if (required && n !== 1) throw new Error(`${slug}: expected 1 match, got ${n} for ${from.slice(0, 80)}`);
      if (n) hits.push(`${n}× ${from.replace(GF, '').slice(0, 70)}`);
    }
    const json = JSON.stringify(blocks);
    const left = count(json, `${GF}/blob/main/pending/`) - count(json, `${GF}/blob/main/pending/legal/`);
    if (left) throw new Error(`${slug}: ${left} non-legal pending/ link(s) left`);
    const version = await writeRevision(client, page, blocks, { change, message, dry: DRY });
    console.log(`  ${DRY ? '[dry] ' : ''}${slug}  v${page.version} -> v${version}`);
    hits.forEach((h) => console.log(`      ${h}`));
  }
});
