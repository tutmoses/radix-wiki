// Run 576 (ideas rotation): the Conflict-of-Interest / Code of Conduct card still described both
// policies as drafts awaiting the GP-PRE-1 vote and linked every citation to
// Shadaffy/radix-dao-governance/pending/, a personal repository frozen since 6 September. GP-PRE-1 was
// ratified on 2 October 2026 (t.me/RadixAccountabilityCouncil/1126), and on 7 October the DAO's own
// repository promoted the ratified documents out of pending/ (RadixDAO/governance-framework a4f74dc,
// both files renamed byte-identical). The ratified text matches the 25 August text apart from its
// version line, which reads 27 August; the GP-PRE-1 manifest records the SHA-256 of each signed PDF,
// and the CoI hash (32e95a40...) matches signed/conflict-of-interest-policy_signed.pdf as read
// 12 October. Citations repoint to the ratified paths, prose is re-tensed, the ratification
// deliverable is struck, and status moves from Proposed to In Progress (the reporting machinery the
// card's last deliverable names does not exist yet).
import { isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ideas';
const SLUG = 'dao-coi-code-of-conduct';
const SENTINEL = 'RadixDAO/governance-framework/blob/main/governance/conflict-of-interest-policy.md';

const GF = 'https://github.com/RadixDAO/governance-framework';
const SH = 'https://github.com/Shadaffy/radix-dao-governance/blob/master/pending';
const GP = `${GF}/blob/470a047/pending/GP-PRE-1-Framework-Ratification.md`;
const RAC = 'https://t.me/RadixAccountabilityCouncil/1126';

// Every occurrence, in every block.
const URLS = [
  [`${SH}/governance/conflict-of-interest-policy.md`, `${GF}/blob/main/governance/conflict-of-interest-policy.md`],
  [`${SH}/governance/code-of-conduct.md`, `${GF}/blob/main/governance/code-of-conduct.md`],
  [`${SH}/governance/compliance-operations-policy.md`, `${GF}/blob/main/governance/compliance-operations-policy.md`],
  [`${SH}/GP-PRE-1-Framework-Ratification.md`, GP],
];

// Exactly one occurrence each, applied after the URL swaps.
const SWAPS = [
  [
    '<td>25 Aug 2026 – both versioned v1.0.0 in a pre-ratification pass; still in the GP-PRE-1 set, neither voted on separately</td>',
    `<td>2 Oct 2026 – <a href="${RAC}" target="_blank" rel="noopener">ratified</a> inside GP-PRE-1, neither voted on separately</td>`,
  ],
  [
    'The two policies this card asks for are drafted and sitting in the ratification set.',
    `The two policies this card asks for are written, and since 2 October 2026 they are ratified.`,
  ],
  [
    'gave <a href="' + GP + '" target="_blank" rel="noopener">GP-PRE-1</a> a manifest listing all 21 by file, version and SHA-256 &ndash; a column whose every cell still reads <em>to be recorded at signing</em>, so the hashes are a slot rather than a commitment.',
    'gave <a href="' + GP + '" target="_blank" rel="noopener">GP-PRE-1</a> a manifest listing all 21 by file, version and SHA-256. The hashes were filled in when the documents were signed, and each is the hash of the signed PDF: the Conflict of Interest entry, <code>32e95a40…</code>, matches <a href="' + GF + '/blob/main/signed/conflict-of-interest-policy_signed.pdf" target="_blank" rel="noopener">the signed copy</a> read on 12 October.',
  ],
  [
    'They live in <code>Shadaffy/radix-dao-governance</code>, the operative repository, not in <code>Shadaffy/radix-dao</code>, which the framework\'s own <a href="https://github.com/Shadaffy/radix-dao-governance/blob/master/pending/README.md" target="_blank" rel="noopener">index</a> describes as the reference library of working drafts and activation history.</p>',
    `The ratified text lives in the DAO's own repository, <a href="${GF}" target="_blank" rel="noopener"><code>RadixDAO/governance-framework</code></a>, which <a href="${GF}/commit/a4f74dc" target="_blank" rel="noopener">moved both files out of <code>pending/</code></a> unchanged on 7 October. It matches the 25 August text apart from the version line, which dates both documents 27 August.</p>`,
  ],
  [
    'the community ratifies the Charter, the DAO Parameters Registry and nineteen operational policies as one set – twenty-one documents, one YES.',
    `the community ratified the Charter, the DAO Parameters Registry and nineteen operational policies as one set – twenty-one documents, one YES, carried on 2 October with 1,857m XRD for and none against (<a href="/ideas/dao-adopt-phase1-governance-docs#ratified-2-october-2026" rel="noopener">the tally</a>).`,
  ],
  [
    'which means this card is not a separate ballot item but part of',
    'which meant this card was never a separate ballot item but part of',
  ],
  [
    '<li>Ratify both as part of the GP-PRE-1 document set (not as separate votes).</li>',
    `<li><s>Ratify both as part of the GP-PRE-1 document set (not as separate votes)</s> – <a href="${RAC}" target="_blank" rel="noopener">ratified 2 October 2026</a>.</li>`,
  ],
  [
    'Operative repository: <a href="https://github.com/Shadaffy/radix-dao-governance" target="_blank" rel="noopener"><code>Shadaffy/radix-dao-governance</code></a>, <code>pending/governance/</code>. The <a href="https://github.com/Shadaffy/radix-dao" target="_blank" rel="noopener">reference library</a> holds working drafts and activation history.',
    `Ratified text: <a href="${GF}" target="_blank" rel="noopener"><code>RadixDAO/governance-framework</code></a>, <code>governance/</code>, with signed PDFs in <code>signed/</code>. Daffy's <a href="https://github.com/Shadaffy/radix-dao" target="_blank" rel="noopener">reference library</a> holds working drafts and activation history.`,
  ],
  [
    '<li><a href="https://github.com/Shadaffy/radix-dao-governance/blob/master/pending/README.md" target="_blank" rel="noopener">Governance framework pending adoption – ratification set and activation sequence</a></li>',
    `<li><a href="${GP}" target="_blank" rel="noopener">GP-PRE-1 – Constitutional Ratification of the Governance Framework</a> · <a href="${RAC}" target="_blank" rel="noopener">Transition RAC – ratification announced, 2 October 2026</a></li>`,
  ],
];

await withClient(async (client) => {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content, metadata FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied – no write');
    return;
  }
  const walk = (bs) => bs.flatMap((b) => [b, ...(b.blocks ? walk(b.blocks) : [])]);
  for (const [from, to] of URLS) {
    const n = walk(blocks).reduce((s, b) => s + (b.text?.split(from).length - 1 || 0), 0);
    if (!n) throw new Error(`url not found: ${from}`);
    for (const b of walk(blocks)) if (b.text) b.text = b.text.replaceAll(from, to);
    console.log(`  ${n}x ${from.split('/').pop()}`);
  }
  for (const [find, replace] of SWAPS) {
    const hits = walk(blocks).filter((b) => b.text?.includes(find));
    if (hits.length !== 1) throw new Error(`anchor found ${hits.length} times: ${find.slice(0, 70)}`);
    hits[0].text = hits[0].text.replace(find, replace);
  }
  const left = JSON.stringify(blocks).match(/Shadaffy\/radix-dao-governance\/blob\/master\/pending/g);
  if (left) throw new Error(`${left.length} pending/ links left`);

  const version = await writeRevision(client, page, blocks, {
    change: 'minor',
    verified: true,
    dry: DRY,
    message: 'GP-PRE-1 ratified 2 Oct 2026 (t.me/RadixAccountabilityCouncil/1126): citations repoint from Shadaffy/radix-dao-governance pending/ to the ratified RadixDAO/governance-framework governance/ paths (promoted byte-identical in a4f74dc, 7 Oct); prose re-tensed; the manifest-hash clause corrected (hashes are filled and match the signed PDFs); ratification deliverable struck; status Proposed -> In Progress.',
  });
  if (!DRY) await client.query(
    `UPDATE pages SET metadata = jsonb_set(metadata, '{status}', '"🔵 In Progress"') WHERE id = $1`, [page.id]);
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
});
