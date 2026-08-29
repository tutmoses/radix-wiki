/**
 * Run 329 (community rotation).
 *
 * Two things happened to this page's subject on 29 August 2026. The governance
 * repository it cites as operative moved off his personal GitHub account into
 * the RadixDAO organisation, and the Stokenet reset he announced actually ran.
 * The reset's aftermath is the more interesting half: the new genesis was built
 * at Babylon, so every protocol update since has to be re-enacted by validator
 * readiness signalling, and he holds every Stokenet validator badge.
 *
 * Sources: t.me/RadixAccountabilityCouncil/920; t.me/RadixDevelopers/66078-66105
 * with senders resolved through the tgme embed; the Anemone readiness
 * transaction and ledger state read first-hand at the Stokenet Gateway.
 */
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'community';
const SLUG = 'daffy';
const SENTINEL = 'reset-day-29-august-2026';
const DRY = process.argv.includes('--dry-run');

const NEW_SECTION = {
  type: 'content',
  text: `<h2 id="${SENTINEL}">Reset day, and the badges that came with it</h2>
<p>The reset ran on schedule. A member of the Radix Developer Discussion group reported the network up at 12:02&nbsp;UTC on 29 August 2026, and Daffy <a target="_blank" rel="noopener" href="https://t.me/RadixDevelopers/66079">declared it back online at 12:52</a>, having waited for Timan's validator to join before saying so. Deploying to it worked immediately &ndash; and then it did not. A developer publishing a package found that <a target="_blank" rel="noopener" href="https://t.me/RadixDevelopers/66088">any reference to an AccountLocker was rejected</a> with <code>ReferencedNodeDoesNotExist</code>.</p>
<p>The diagnosis was that the reset network is not the network that was reset. Its genesis was built at the <a href="/contents/tech/releases/radix-mainnet-babylon" rel="noopener">Babylon</a> protocol version, so <a target="_blank" rel="noopener" href="https://t.me/RadixDevelopers/66094">every protocol update since has to be enacted again</a>, in order &ndash; Anemone, then Bottlenose, then Cuttlefish &ndash; by the same <a target="_blank" rel="noopener" href="https://docs.radixdlt.com/docs/node-protocol-updates">validator readiness signalling</a> mainnet uses, at later epochs. AccountLocker arrived with Bottlenose, which is why a blueprint that exists on mainnet did not exist on a network that had been live for four hours. Daffy's first response was that he did not know what Bottlenose was and would <a target="_blank" rel="noopener" href="https://t.me/RadixDevelopers/66091">need to investigate</a>; <a target="_blank" rel="noopener" href="https://t.me/RadixDevelopers/66095">flightofthefox</a> pointed at building genesis with the upgrades baked in instead, and noted that Cuttlefish part 2 is unshipped.</p>
<p>He took the slower route. Rather than regenerate genesis he chose to <a target="_blank" rel="noopener" href="https://t.me/RadixDevelopers/66098">signal each upgrade and wait out the epochs</a> &ndash; sixteen transactions to reach Cuttlefish, on his own estimate. The Anemone readiness transaction committed at 17:46:25&nbsp;UTC in epoch 95, for a fee of 0.431 XRD; <a target="_blank" rel="noopener" href="https://t.me/RadixDevelopers/66103">Anemone was active by 18:30</a>, with Bottlenose next. Read at the Gateway at 19:08&nbsp;UTC the network was on node release v1.10.6 at epoch 117, state version 335,613.</p>
<p>What makes the sequence worth recording is the arithmetic underneath it. Enacting a protocol update requires validators holding 80% of stake to signal readiness, and when Timan asked whether his validators had to vote for the new versions, Daffy's answer was that <a target="_blank" rel="noopener" href="https://t.me/RadixDevelopers/66105">the last badge was never sent</a>: he holds 100% of the Stokenet validator badges against an 80% requirement, and is "pushing it through, with or without your approval". He drew one line himself, stopping at Cuttlefish part 1, on the ground that part 2 needs more information and "is not really me to decide". The <a href="/contents/tech/releases/stokenet" rel="noopener">Stokenet</a> page carries the reset itself; this is the part that describes who can move the network.</p>`,
};

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

const replacements = [
  // infobox
  [`<tr><td>Repositories</td><td><a target="_blank" rel="noopener" href="https://github.com/Shadaffy/radix-dao-governance">radix-dao-governance</a> (operative), <a target="_blank" rel="noopener" href="https://github.com/Shadaffy/radix-dao">radix-dao</a> (reference library)</td></tr>`,
   `<tr><td>Repositories</td><td><a target="_blank" rel="noopener" href="https://github.com/RadixDAO/governance-framework">RadixDAO/governance-framework</a> (operative, moved from his account 29 Aug 2026), <a target="_blank" rel="noopener" href="https://github.com/Shadaffy/radix-dao">radix-dao</a> (reference library)</td></tr>`],

  // the two-repository paragraph
  [`<p>The framework Daffy authored is published in two repositories. <a target="_blank" rel="noopener" href="https://github.com/Shadaffy/radix-dao-governance">radix-dao-governance</a> holds the operative documents of Radix DAO LLC – the Operating Agreement, the Charter, the operational policy library, and the DAO Parameters Registry – while the older <a target="_blank" rel="noopener" href="https://github.com/Shadaffy/radix-dao">radix-dao</a> repository keeps the drafts, templates, analysis material, and the activation roadmap behind them.`,
   `<p>The framework Daffy authored is published in two repositories, and on 29 August 2026 one of them stopped being his. The Transition RAC <a target="_blank" rel="noopener" href="https://t.me/RadixAccountabilityCouncil/920">announced</a> that the operative repository had been moved from his personal account into the DAO's own GitHub organisation as <a target="_blank" rel="noopener" href="https://github.com/RadixDAO/governance-framework">RadixDAO/governance-framework</a>, asking the community to re-point its links; it holds the operative documents of Radix DAO LLC – the Operating Agreement, the Charter, the operational policy library, and the DAO Parameters Registry – while the older <a target="_blank" rel="noopener" href="https://github.com/Shadaffy/radix-dao">radix-dao</a> repository keeps the drafts, templates, analysis material, and the activation roadmap behind them.`],

  // proposal-history link
  [`<a target="_blank" rel="noopener" href="https://github.com/Shadaffy/radix-dao-governance/blob/master/PROPOSALS.md">four-step founding sequence</a>`,
   `<a target="_blank" rel="noopener" href="https://github.com/RadixDAO/governance-framework/blob/main/PROPOSALS.md">four-step founding sequence</a>`],

  // external links
  [`<li><a target="_blank" rel="noopener" href="https://github.com/Shadaffy/radix-dao-governance">radix-dao-governance – operative governance documents</a></li>`,
   `<li><a target="_blank" rel="noopener" href="https://github.com/RadixDAO/governance-framework">RadixDAO/governance-framework – operative governance documents</a></li>`],
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

  // the new section goes before "External links" (the last block)
  const idx = blocks.findIndex((b) => typeof b.text === 'string' && b.text.includes('<h2>External links</h2>'));
  if (idx < 0) throw new Error('could not locate the External links block');
  blocks.splice(idx, 0, { id: uid(), ...NEW_SECTION });

  const version = '2.4.0';
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
       'Repoints the operative governance repository to RadixDAO/governance-framework, moved off his personal account on 29 Aug 2026 (t.me/RadixAccountabilityCouncil/920). Adds a section on reset day: the network returned at 12:52 UTC, AccountLocker references were rejected because the new genesis is at Babylon and every protocol update must be re-enacted by readiness signalling, Anemone committed at 17:46:25 UTC in epoch 95, and he holds 100% of the Stokenet validator badges against an 80% threshold.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
