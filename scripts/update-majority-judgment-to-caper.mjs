// update-majority-judgment-to-caper - Majority Judgment is a general voting method and now lives in the
// DAO governance reference on caper.network, which carries the Radix variant as its worked case. This
// repoints the three pages here that name the method, then deletes contents/tech/core-concepts/majority-judgment.
//
// The Radix Accountability Council page also said the winner is "the one with the best median grade".
// The Radix framework settles a grade at three-fifths of the voting power cast, not at the median
// (RadixDAO/governance-framework, Proposal & Voting Framework §6.2.4), so that clause is corrected.
//
// The page's two revisions cascade with it; a copy of the row and both revisions was taken before the run.
//
//   node scripts/update-majority-judgment-to-caper.mjs --dry-run

import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, withClient } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const EMDASH = String.fromCharCode(0x2014);
const NBSP = String.fromCharCode(0xa0);
const CAPER_MJ = 'https://caper.network/wiki/dao-governance/concepts/voting/majority-judgment';
const OLD_PATH = ['contents/tech/core-concepts', 'majority-judgment'];
const OLD_HREF = `/${OLD_PATH.join('/')}`;
const WIKIPEDIA = 'https://en.wikipedia.org/wiki/Majority_judgment';
const link = `<a href="${CAPER_MJ}" target="_blank" rel="noopener">Majority Judgment</a>`;

const EDITS = [
  {
    tag: 'contents/tech/core-concepts', slug: 'radix-governance', version: '1.11.1',
    swaps: [[`<a href="${OLD_HREF}" class="link">Majority Judgment</a>`, link]],
    message: 'Majority Judgment now links to its article on caper.network, where the page moved on 19 September 2026.',
  },
  {
    tag: 'ecosystem', slug: 'radix-accountability-council', version: '2.8.1',
    swaps: [
      [`<a href="${WIKIPEDIA}" target="_blank" rel="noopener">Majority Judgment</a>`, link],
      ['and the winner is the one with the best median grade, rather than the one named on the most ballots',
        'and seats go to the candidates with the best grade that three-fifths of the voting power cast gives them, rather than to those named on the most ballots'],
    ],
    message: 'Majority Judgment was described as electing "the one with the best median grade". The Radix framework settles a grade at three-fifths of the voting power cast, not at the median (Proposal & Voting Framework §6.2.4); corrected, and the link moved from Wikipedia to the Majority Judgment article on caper.network, which covers the Radix variant.',
  },
  {
    tag: 'ideas', slug: 'dao-elect-permanent-rac', version: '1.4.4',
    swaps: [[`<a href="${WIKIPEDIA}" target="_blank" rel="noopener">Majority Judgment</a>`, link]],
    message: 'Majority Judgment links to its article on caper.network, which covers the Radix variant, instead of Wikipedia.',
  },
];

await withClient(async (client) => {
  for (const e of EDITS) {
    if (isLockedPage(e.tag, e.slug)) throw new Error(`${e.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [e.tag, e.slug]);
    if (!rows.length) throw new Error(`${e.slug} not found`);
    const page = rows[0];
    const before = JSON.stringify(page.content);
    if (before.includes(CAPER_MJ)) {
      console.log(`  ${e.slug}: already applied - no write`);
      continue;
    }
    let blocks = page.content;
    for (const [from, to] of e.swaps) {
      if (to.includes(NBSP) || to.includes(EMDASH)) throw new Error(`${e.slug}: U+00A0 or an em dash in new text`);
      const hits = JSON.stringify(blocks).split(JSON.stringify(from).slice(1, -1)).length - 1;
      if (hits !== 1) throw new Error(`${e.slug}: expected 1 match, got ${hits}: ${from.slice(0, 70)}`);
      blocks = JSON.parse(JSON.stringify(blocks).replace(JSON.stringify(from).slice(1, -1), JSON.stringify(to).slice(1, -1)));
    }
    const json = JSON.stringify(blocks);
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${e.version}`);
    if (DRY) continue;

    const now = new Date().toISOString();
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4',
      [json, e.version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, e.version, 'patch', AUTHOR_ID, e.message, now]);
    await client.query('COMMIT');
  }

  const { rows: linkers } = await client.query(
    `SELECT tag_path, slug FROM pages WHERE NOT (tag_path = $1 AND slug = $2) AND strpos(content::text, $3) > 0`,
    [...OLD_PATH, `"${OLD_HREF}`]);
  if (linkers.length) {
    const names = linkers.map((p) => `${p.tag_path}/${p.slug}`).join(', ');
    if (!DRY) throw new Error(`still linked from ${names}`);
    console.log(`  [dry] linked from ${names} until the edits above apply`);
  }
  if (isLockedPage(...OLD_PATH)) throw new Error(`${OLD_HREF} is LOCKED`);
  const { rows } = await client.query(
    `SELECT id, title, (SELECT count(*) FROM revisions r WHERE r.page_id = p.id) AS revisions
       FROM pages p WHERE tag_path = $1 AND slug = $2`, OLD_PATH);
  if (!rows.length) {
    console.log(`  ${OLD_HREF}: already deleted`);
    return;
  }
  console.log(`  ${DRY ? '[dry] ' : ''}delete ${OLD_HREF} (${rows[0].revisions} revisions)`);
  if (!DRY) await client.query('DELETE FROM pages WHERE id = $1', [rows[0].id]);
});
