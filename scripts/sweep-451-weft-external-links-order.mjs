// sweep 451 – /ecosystem/weft-finance. External Links closed the lead block (block-weft-finance-1), and the
// three sections added since August live in later blocks, so the page rendered External Links above
// "The 30 August 2026 exploit", "Validator offline since the restart" and "LSULP exposure and the
// CaviarNine wind-down". Moves the list, unchanged, into its own content block after the last of them and
// before the trailing video infobox.
//
//   node scripts/sweep-451-weft-external-links-order.mjs --dry-run

import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage, assertLinkShapes, withClient } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const TAG = 'ecosystem';
const SLUG = 'weft-finance';
const VERSION = '4.12.1';
const HEADING = '<h2>External Links</h2>';
const LAST_SECTION = '21589006-74cf-473f-83f8-746c33eae404';
const MESSAGE = 'Moved External Links to the end of the page. It closed the lead block, so it rendered above the exploit, '
  + 'validator and LSULP sections that later blocks hold. The list is unchanged and now has its own block after them.';

await withClient(async (client) => {
  if (isLockedPage(TAG, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  const lastIdx = blocks.findIndex((b) => b.id === LAST_SECTION);
  if (lastIdx < 0) throw new Error('LSULP section block missing');
  if (blocks[lastIdx + 1]?.type === 'content' && blocks[lastIdx + 1].text?.startsWith(HEADING)) {
    console.log('  already applied - no write');
    return;
  }

  const lead = blocks.find((b) => b.id === 'block-weft-finance-1');
  if (!lead) throw new Error('lead block missing');
  const hits = lead.text.split(HEADING).length - 1;
  if (hits !== 1) throw new Error(`expected one External Links heading in the lead block, got ${hits}`);
  const at = lead.text.indexOf(HEADING);
  const links = lead.text.slice(at).trimEnd();
  if (!/^<h2>External Links<\/h2><ul>(<li>.*?<\/li>)+<\/ul>$/.test(links)) throw new Error('External Links is not the last thing in the lead block');
  if (blocks.slice(lastIdx + 1).some((b) => b.type !== 'infobox')) throw new Error('unexpected content block after the LSULP section');

  lead.text = lead.text.slice(0, at).trimEnd();
  blocks.splice(lastIdx + 1, 0, { id: uid(), type: 'content', text: links });
  assertLinkShapes(blocks, SLUG);

  const before = JSON.stringify(page.content);
  const json = JSON.stringify(blocks);
  if (json.length - before.length > 80 || json.split(HEADING).length !== 2) throw new Error('move changed more than the block wrapper');

  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${VERSION}`);
  console.log(`  order: ${blocks.map((b) => (b.text?.match(/<h2>(.*?)<\/h2>/g)?.map((h) => h.replace(/<[^>]+>/g, '')).join(' / ')) || b.type).join('  |  ')}`);
  if (DRY) return;

  const now = new Date().toISOString();
  await client.query('BEGIN');
  await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, VERSION, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, VERSION, 'patch', AUTHOR_ID, MESSAGE, now]);
  await client.query('COMMIT');
  console.log('  written');
});
