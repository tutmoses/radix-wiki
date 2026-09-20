/**
 * sweep 464b - the reading dates sweep 464 wrote are a day ahead of the
 * readings.
 *
 * Every figure in sweep 464 was measured between 22:55 and 23:11 UTC on
 * 20 September 2026, and the link audit that found the dead citation carries
 * generatedAt 2026-09-20T23:04:14Z. The run itself started after midnight in
 * BST, so both pages went out labelled "21 September 2026". This wiki dates a
 * reading in UTC ("read at 07:06 UTC on 10 September" is the house form), so
 * the labels are wrong and the numbers are not.
 *
 * Also drops the two relative clauses added with them. XRD Domains crosses 180
 * days at 15:56 UTC on 24 September, three days and seventeen hours after the
 * reading, which is neither "three days" nor "four"; the absolute date was
 * already in both sentences.
 *
 * Idempotent: skipped per page once no "21 September 2026" label remains.
 */
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, assertLinkShapes, withClient } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');

const FRESHNESS_EDITS = [
  ['Read on 21 September 2026, 310 of the wiki', 'Read on 20 September 2026, 310 of the wiki'],
  ['and the link audit of 21 September found it.', 'and the link audit of 20 September found it.'],
  [
    '176 days ago as of this reading, which crosses 180 days on 24 September 2026, three days after it.',
    '176 days ago as of this reading, which crosses 180 days on 24 September 2026.',
  ],
];

const NOTICES_EDITS = [
  [
    'Read again on 21 September 2026, the whole wiki carries <strong>five</strong> of them across 378 pages &ndash; the same five, on the same five pages, seventeen days later:',
    'Read again on 20 September 2026, the whole wiki carries <strong>five</strong> of them across 378 pages &ndash; the same five, on the same five pages, sixteen days later:',
  ],
  [
    'verification stamp, read on 21 September 2026, and <strong>none</strong>',
    'verification stamp, read on 20 September 2026, and <strong>none</strong>',
  ],
  [
    'on <strong>24 September 2026</strong>, three days after this reading, unless someone acts first.',
    'on <strong>24 September 2026</strong> unless someone acts first.',
  ],
  [
    '<strong>11 pages</strong> on 21 September 2026, still the largest queue and down from 13 on 4 September.',
    '<strong>11 pages</strong> on 20 September 2026, still the largest queue and down from 13 on 4 September.',
  ],
];

const replaceOnce = (haystack, needle, replacement, where) => {
  const i = haystack.indexOf(needle);
  if (i < 0) throw new Error(`${where}: string not found: ${JSON.stringify(needle.slice(0, 70))}`);
  if (haystack.indexOf(needle, i + 1) >= 0) throw new Error(`${where}: string is not unique: ${JSON.stringify(needle.slice(0, 70))}`);
  return haystack.slice(0, i) + replacement + haystack.slice(i + needle.length);
};

const applyEdits = (blocks, edits, where) => {
  for (const [from, to] of edits) {
    const target =
      blocks.find((b) => (b.text || '').includes(from)) ||
      blocks.flatMap((b) => b.blocks || []).find((b) => (b.text || '').includes(from));
    if (!target) throw new Error(`${where}: no block holds ${JSON.stringify(from.slice(0, 60))}`);
    target.text = replaceOnce(target.text, from, to, where);
  }
};

const write = async (client, page, blocks, version, changeType, message) => {
  assertLinkShapes(blocks, page.title);
  const now = new Date().toISOString();
  const json = JSON.stringify(blocks);
  await client.query('BEGIN');
  await client.query(
    'UPDATE pages SET content = $1, version = $2, updated_at = $3, last_verified_at = $3 WHERE id = $4',
    [json, version, now, page.id],
  );
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, version, changeType, AUTHOR_ID, message, now],
  );
  await client.query('COMMIT');
};

const load = async (client, tagPath, slug) => {
  if (isLockedPage(tagPath, slug)) throw new Error(`${tagPath}/${slug} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
    [tagPath, slug],
  );
  if (!rows.length) throw new Error(`${tagPath}/${slug} not found`);
  return rows[0];
};

const MESSAGE =
  'Corrects the reading date written by sweep 464. Every figure on this page was measured between 22:55 and ' +
  '23:11 UTC on 20 September 2026 and was labelled 21 September, because the run started after midnight in ' +
  'British Summer Time. The numbers are unchanged. The relative clauses on the 24 September crossing are dropped: ' +
  'XRD Domains reaches 180 days at 15:56 UTC that day, three days and seventeen hours after the reading, and the ' +
  'date itself was already in the sentence.';

await withClient(async (client) => {
  for (const [slug, edits, version] of [
    ['freshness', FRESHNESS_EDITS, '1.7.1'],
    ['editorial-notices', NOTICES_EDITS, '1.3.1'],
  ]) {
    const page = await load(client, 'policy', slug);
    if (!JSON.stringify(page.content).includes('21 September 2026')) {
      console.log(`  ${slug}: no 21 September label left - no write`);
      continue;
    }
    const blocks = JSON.parse(JSON.stringify(page.content));
    applyEdits(blocks, edits, slug);
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}   ${edits.length} labels 21 Sep -> 20 Sep UTC`);
    if (!DRY) await write(client, page, blocks, version, 'patch', MESSAGE);
  }
});
