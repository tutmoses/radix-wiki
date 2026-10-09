import { isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'contents/resources';
const SLUG = 'mcp-server';
const SENTINEL = 'Sizes below are as served on 10 October 2026.';

// Measured 23:10 UTC 9 Oct 2026 (curl size_download): llms.txt 16,152 B, llms-index.txt 96,176 B,
// llms-full.txt 3,680,243 B, AGENTS.md 8,841 B, openapi.json 10,698 B; get_categories totalPages 374.
const EDITS = [
  ['Sizes below are as served on 20 September 2026.', SENTINEL],
  ['/llms-index.txt</a></td><td>93 KB</td>', '/llms-index.txt</a></td><td>94 KB</td>'],
  ['/llms-full.txt</a></td><td>3.4 MB</td>', '/llms-full.txt</a></td><td>3.5 MB</td>'],
  ['371 pages on 20 September 2026.', '374 pages on 10 October 2026.'],
];

await withClient(async (client) => {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  let json = JSON.stringify(page.content);
  if (json.includes(SENTINEL)) { console.log('  already applied — no write'); return; }
  for (const [from, to] of EDITS) {
    const f = JSON.stringify(from).slice(1, -1);
    if (!json.includes(f)) throw new Error(`missing: ${from}`);
    json = json.replace(f, JSON.stringify(to).slice(1, -1));
  }
  const version = await writeRevision(client, page, JSON.parse(json), {
    change: 'patch',
    verified: true,
    message: 'Re-measured on 10 October 2026: llms-index.txt 93 KB to 94 KB (96,176 B), llms-full.txt 3.4 MB to 3.5 MB (3,680,243 B), get_categories 371 to 374 pages. Re-read and unchanged: serverInfo 3.1.0, protocol 2025-03-26, the same 11 tools and 2 resources, llms.txt 16 KB, AGENTS.md and openapi.json.',
    dry: DRY,
  });
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
});
