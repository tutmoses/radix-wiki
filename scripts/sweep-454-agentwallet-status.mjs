// sweep 454 – developers rotation.
//
// /developers/ai-agents/agent-wallet-ai dated its Project Status to August 2026.
// Re-read 18 September: npm latest is still 2.0.3 (8 June), the last commit on
// any branch is still 16 June (GitHub API, default branch v2.0, branches
// unchanged), and npm downloads fell to 65 in the 30 days to 16 September from
// about 119 in the month to 9 August. The site still answers 200.
//
//   node scripts/sweep-454-agentwallet-status.mjs --dry-run

import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, withClient } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'developers/ai-agents';
const SLUG = 'agent-wallet-ai';
const SENTINEL = '65 npm downloads in the 30 days to 16 September 2026';

const EDITS = [
  ['<h2>Project Status (checked August 2026)</h2>', '<h2>Project Status (checked September 2026)</h2>'],
  ['and the last commit of any kind is dated 16 June 2026. Uptake is early-stage to match: about 119 npm downloads in the month to 9 August 2026, and two GitHub stars.',
   'and the last commit of any kind is dated 16 June 2026, so by 18 September the project had been idle for three months. Uptake is small: 65 npm downloads in the 30 days to 16 September 2026, down from about 119 in the month to 9 August, and two GitHub stars.'],
];

await withClient(async (client) => {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (blocks.some((b) => b.text?.includes(SENTINEL))) {
    console.log('  already applied – no write');
    return;
  }

  const i = blocks.findIndex((b) => b.text?.includes(EDITS[0][0]));
  if (i < 0) throw new Error('status block not found – inspect the stored HTML');
  let text = blocks[i].text;
  for (const [was, now] of EDITS) {
    if (!text.includes(was)) throw new Error(`replacement target not found: ${was.slice(0, 60)}…`);
    text = text.replace(was, now);
  }
  blocks[i] = { ...blocks[i], text };

  const version = '2.1.2';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  block ${i}  +${text.length - page.content[i].text.length} chars`);
  if (DRY) return;

  const now = new Date().toISOString();
  const json = JSON.stringify(blocks);
  await client.query('BEGIN');
  await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
    [json, version, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, version, 'patch', AUTHOR_ID,
     'Project Status re-checked 18 September 2026: npm latest still 2.0.3 (8 June), last commit still 16 June (GitHub API), so three months idle; npm downloads 65 in the 30 days to 16 September (api.npmjs.org), down from about 119 in the month to 9 August.',
     now]);
  await client.query('COMMIT');
});
