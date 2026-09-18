// sweep 454 – developers rotation.
//
// /developers/ai-agents/ai-agents-and-x402 records the two upstream pull requests
// that followed Temperature Check 6 and says neither had a review by 10 August.
// Re-read on 18 September through the GitHub API: both are still open with no
// review. x402-foundation/x402#3112 has one verified commit and GitHub reports it
// as blocked; the repository merged 151 other pull requests after it was filed,
// Cardano exact-scheme documentation (#3429) among them on 9 September. No Radix
// SDK pull request exists upstream. ChainAgnostic/namespaces#198 is one of 51 open
// pull requests, 19 of them older; the registry merged six new namespaces on
// 18 August (opened April to July) and Tron on 3 September.
//
//   node scripts/sweep-454-x402-caip-upstream-status.mjs --dry-run

import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, withClient } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'developers/ai-agents';
const SLUG = 'ai-agents-and-x402';
const SENTINEL = 'Both were still open on 18 September 2026';
const ANCHOR = 'so the CAIP half is unlikely to move quickly.</p>';

const PARAGRAPH = '<p>Both were still open on 18 September 2026, and neither had a review from the project that owns it. The x402 pull request carries one verified commit, and GitHub reports it as blocked by the repository&rsquo;s merge rules until a maintainer approves it. In the five weeks after it was filed the repository merged <a href="https://github.com/x402-foundation/x402/pulls?q=is%3Apr+is%3Amerged+merged%3A%3E2026-08-10" target="_blank" rel="noopener">151 other pull requests</a>, among them <a href="https://github.com/x402-foundation/x402/pull/3429" target="_blank" rel="noopener">documentation for Cardano&rsquo;s exact scheme</a> on 9 September. No Radix SDK implementation has been filed upstream; the submission defers it until the spec is approved. On the CAIP side, the namespaces registry merged six new namespaces on 18 August, among them <a href="https://github.com/ChainAgnostic/namespaces/pull/191" target="_blank" rel="noopener">Neo</a> and <a href="https://github.com/ChainAgnostic/namespaces/pull/185" target="_blank" rel="noopener">Klever</a>, from pull requests opened between April and July, and <a href="https://github.com/ChainAgnostic/namespaces/pull/170" target="_blank" rel="noopener">Tron</a> on 3 September. Radix&rsquo;s is one of 51 open pull requests there, and 19 of them are older.</p>';

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

  const i = blocks.findIndex((b) => b.text?.includes(ANCHOR));
  if (i < 0) throw new Error('anchor paragraph not found – inspect the stored HTML');
  const text = blocks[i].text.replace(ANCHOR, `${ANCHOR}\n${PARAGRAPH}`);
  blocks[i] = { ...blocks[i], text };

  const version = '2.4.0';
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
    [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
     'Upstream status of the Radix x402 and CAIP pull requests, read through the GitHub API on 18 September 2026: x402-foundation/x402#3112 and ChainAgnostic/namespaces#198 are both open with no maintainer review; #3112 is blocked pending approval while x402 merged 151 other pull requests; no Radix SDK pull request exists upstream; namespaces merged six namespaces on 18 August and Tron on 3 September, with 19 older pull requests still open.',
     now]);
  await client.query('COMMIT');
});
