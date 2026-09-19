// update-dao-caper-seam - link the Radix DAO transition cards to the DAO governance reference on
// caper.network, which covers the same decisions for other DAOs and had no link from here.
//
// Each card's "Dependencies & cross-references" list gains one line pointing at the caper page that
// treats its question in general: working groups, the proposal lifecycle and thresholds, treasury
// custody, legal wrappers and MIDAO, ballot methods, and bootstrap budgets. Majority Judgment gains
// the ballot-methods page under See also. Every linked page was opened on 19 September 2026. Links
// go to caper's general reference only, never to its product pages (VOICE.md §4 Caper overlay).
//
// dao-incorporate-duna-llc also gains the council's 17 September update (t.me/RadixAccountabilityCouncil/1037):
// the last submissions to MIDAO's onboarding portal were expected by Monday 21 September, so the
// registry filing had still not been made.
//
//   node scripts/update-dao-caper-seam.mjs --dry-run

import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, withClient } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const EMDASH = String.fromCharCode(0x2014);
const NBSP = String.fromCharCode(0xa0);
const CAPER = 'https://caper.network/wiki/dao-governance';
const ext = (path, text) => `<a href="${CAPER}/${path}" target="_blank" rel="noopener">${text}</a>`;
const REF = 'in the DAO governance reference on caper.network';
const SENTINEL = `${CAPER}/`;
const DEPS = '<h2>Dependencies &amp; cross-references</h2>';

const RMI_UPDATE = `<h3 id="17-september-the-last-documents">17 September 2026: the last documents</h3>`
  + `<p>Ten days later the council had still not finished its own steps. Its <a href="https://t.me/RadixAccountabilityCouncil/1037" target="_blank" rel="noopener">status update of 17 September</a> says it is finalising the last submissions to MIDAO on the company's onboarding portal, among them documents and KYC information, and expects to complete them by Monday 21 September. The submission to the Marshall Islands is MIDAO's to make after that. No filing date has been given, so the four to six weeks the council put on the registry have not started.</p>`;

const EDITS = [
  {
    tag: 'ideas', slug: 'dao-working-group-framework', version: '2.0.3', change: 'patch',
    li: `How other DAOs divide work into working groups, subDAOs and pods, including ENS, which ran three working groups of three elected stewards each and cut them to one in 2026: ${ext('concepts/membership/subdaos-and-working-groups', 'SubDAOs, working groups &amp; pods')} ${REF}.`,
    message: 'Cross-reference to the general treatment of working groups, subDAOs and pods on caper.network, opened 19 September 2026.',
  },
  {
    tag: 'ideas', slug: 'dao-proposal-voting-framework', version: '2.2.1', change: 'patch',
    li: `The same stages in other DAOs, from forum discussion and temperature check through the vote to a timelock before execution: ${ext('concepts/voting/proposal-lifecycle', 'The DAO proposal lifecycle')}; and the trade-offs in setting the quorum and approval thresholds this framework fixes for Radix: ${ext('concepts/voting/quorum-and-threshold-design', 'Quorum and threshold design')}. Both are ${REF}.`,
    message: 'Cross-references to the proposal lifecycle and quorum and threshold design pages on caper.network, opened 19 September 2026.',
  },
  {
    tag: 'ideas', slug: 'dao-xrd-custody', version: '1.1.2', change: 'patch',
    li: `How other DAO treasuries weigh custody, runway and concentration in their own token, the question this card leaves open: ${ext('concepts/treasury/dao-treasury-management', 'DAO treasury management')} ${REF}.`,
    message: 'Cross-reference to DAO treasury management on caper.network, opened 19 September 2026.',
  },
  {
    tag: 'ideas', slug: 'dao-incorporate-duna-llc', version: '1.5.0',
    li: `How the Marshall Islands DAO LLC compares with the other wrappers DAOs use, among them the Wyoming DAO LLC, the Wyoming DUNA and the Cayman foundation company: ${ext('concepts/membership/dao-legal-structures', 'DAO legal structures')}; and the registered agent itself: ${ext('tooling/analytics/midao', 'MIDAO')}. Both are ${REF}.`,
    insert: { before: '<h2>Deliverables</h2>', html: RMI_UPDATE },
    message: 'The Transition RAC\'s update of 17 September 2026 (t.me/RadixAccountabilityCouncil/1037): the council is finalising its last submissions to MIDAO, documents and KYC information, and expects to finish by Monday 21 September, after which MIDAO files with the Marshall Islands registry. No filing date given. New dated section, plus cross-references to DAO legal structures and MIDAO on caper.network.',
  },
  {
    tag: 'ideas', slug: 'dao-elect-permanent-rac', version: '1.4.3', change: 'patch',
    li: `How the ballot compares with the ranked, approval and multi-winner methods other DAOs use: ${ext('concepts/voting/ranked-and-alternative-ballot-methods', 'Ranked and alternative ballot methods')} ${REF}.`,
    message: 'Cross-reference to ranked and alternative ballot methods on caper.network, opened 19 September 2026.',
  },
  {
    tag: 'ideas', slug: 'dao-adopt-phase1-governance-docs', version: '2.1.1', change: 'patch',
    li: `How Arbitrum and Uniswap handled their first budgets and the votes that approved them, with the Radix Foundation's grant and conditional treasury transfer as a third case: ${ext('concepts/treasury/bootstrap-budgets-and-ratification-votes', 'Bootstrap budgets and ratification votes')} ${REF}.`,
    message: 'Cross-reference to bootstrap budgets and ratification votes on caper.network, which treats the Radix Foundation grant as a worked case; opened 19 September 2026.',
  },
  {
    tag: 'contents/tech/core-concepts', slug: 'majority-judgment', version: '1.0.1', change: 'patch',
    seeAlso: `${ext('concepts/voting/ranked-and-alternative-ballot-methods', 'Ranked and alternative ballot methods')}, on caper.network, which compares the counting rules DAO platforms use`,
    message: 'See also: ranked and alternative ballot methods on caper.network, opened 19 September 2026.',
  },
];

// Insert `html` immediately before the one occurrence of `anchor` (or, with `closeAfter`, before the
// first `</ul>` following it) across every text block; exactly one block may match.
function insertAt(blocks, anchor, html, { closeAfter = false } = {}) {
  let hits = 0;
  const out = blocks.map((b) => {
    if (typeof b.text !== 'string' || !b.text.includes(anchor)) return b;
    hits += b.text.split(anchor).length - 1;
    const at = closeAfter ? b.text.indexOf('</ul>', b.text.indexOf(anchor)) : b.text.indexOf(anchor);
    if (at < 0) throw new Error(`no </ul> after ${anchor}`);
    return { ...b, text: b.text.slice(0, at) + html + b.text.slice(at) };
  });
  if (hits !== 1) throw new Error(`expected 1 match, got ${hits}: ${anchor.slice(0, 70)}`);
  return out;
}

await withClient(async (client) => {
  for (const e of EDITS) {
    if (isLockedPage(e.tag, e.slug)) throw new Error(`${e.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [e.tag, e.slug]);
    if (!rows.length) throw new Error(`${e.slug} not found`);
    const page = rows[0];
    const before = JSON.stringify(page.content);
    if (before.includes(`${SENTINEL}concepts/`) || before.includes(`${SENTINEL}tooling/`)) {
      console.log(`  ${e.slug}: already applied - no write`);
      continue;
    }
    let blocks = JSON.parse(before);
    if (e.li) blocks = insertAt(blocks, DEPS, `<li>${e.li}</li>`, { closeAfter: true });
    if (e.seeAlso) blocks = insertAt(blocks, '<h2 id="see-also">See also</h2>', `<li>${e.seeAlso}</li>`, { closeAfter: true });
    if (e.insert) blocks = insertAt(blocks, e.insert.before, e.insert.html);
    const added = [e.li, e.seeAlso, e.insert?.html].filter(Boolean).join('');
    if (added.includes(NBSP) || added.includes(EMDASH)) throw new Error(`${e.slug}: U+00A0 or an em dash in new text`);
    const json = JSON.stringify(blocks);
    if (!json.includes(SENTINEL)) throw new Error(`${e.slug}: sentinel missing after edits`);
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${e.version}  (+${json.length - before.length} chars)`);
    if (DRY) continue;

    const now = new Date().toISOString();
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4',
      [json, e.version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, e.version, e.change ?? 'minor', AUTHOR_ID, e.message, now]);
    await client.query('COMMIT');
    console.log('    written');
  }
});
