/**
 * sweep 461 - contents/resources rotation, staleness head.
 *
 * /contents/resources/mcp-server last moved on 11 September 2026 and every
 * figure on it is a measurement of a live surface, so the refresh is a
 * re-measurement rather than a rewrite. Read on 20 September 2026:
 *
 *   initialize          serverInfo radix-wiki 3.1.0, protocol 2025-03-26   unchanged
 *   tools/list          11 tools, same names                               unchanged
 *   get_categories      totalPages 371                                     unchanged
 *   GET /api/mcp        405                                                unchanged
 *   OPTIONS /api/mcp    204, Access-Control-Allow-Origin: *                unchanged
 *   registry            wiki.radix/radix-wiki 3.1.0 isLatest, 15 Aug 2026  unchanged
 *   llms.txt            16,308 B   (page says 15 KB)                       CHANGED
 *   llms-index.txt      95,351 B   (page says 86 KB)                       CHANGED
 *   llms-full.txt       3,582,250 B -> 3.4 MB                              unchanged
 *   AGENTS.md           9,520 B  -> 9 KB                                   unchanged
 *   openapi.json        10,698 B -> 10 KB                                  unchanged
 *   /llms.txt ETag      W/"1d4lr9q-x", conditional GET returns 304         unchanged
 *   mcp-server.md       200, text/markdown, 8,838 B                        unchanged
 *
 * The intro's traffic sentence is the one claim that could not be re-measured
 * the way it was written: it cited the endpoint's share of pageviews over the
 * thirty days to 11 September (571 of 3,438 visitors, third on the site), and
 * /api/mcp is no longer in the site's top six pages by pageview. That could be
 * a change in what the tracker records as a pageview rather than a change in
 * use, so it is not evidence of a fall and is not published as one. What IS
 * measured now is the per-tool call log, which plausible.py filters to callers
 * outside this wiki's conformance suite and the studio's own tooling
 * (radix-studio/scripts/plausible.py, TOOL_CALLS). Over the thirty days to
 * 20 September 2026: get_categories 83, get_full_corpus 77, list_pages 75,
 * get_page 66, get_recent_changes 63, search_wiki 62, get_ideas_board 57,
 * get_challenge 35 - 518 calls. login, create_page and edit_page are absent
 * from the ten rows the digest returns, whose last row has six calls, so no
 * claim is made about writes either way.
 *
 * Run once. Idempotent: skipped if the 93 KB cell is already there.
 */
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, assertLinkShapes, withClient } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');

const EDITS = [
  [
    '<tr><td><strong>Measured</strong></td><td>11 September 2026</td></tr>',
    '<tr><td><strong>Measured</strong></td><td>20 September 2026</td></tr>',
  ],
  [
    ', and it is the busiest thing on the site after the homepage: over the thirty days to 11 September 2026 ' +
      "the endpoint drew 571 of the wiki's 3,438 visitors, third behind only the homepage and the account of the " +
      'Hyperlane asset drain, and more than triple the <a href="/ecosystem" rel="noopener">ecosystem directory</a>.',
    ', and agents use it. Over the thirty days to 20 September 2026, counting only callers outside this wiki\'s own ' +
      'conformance suite and the tooling that maintains it, the endpoint took 518 tool calls: every read tool was ' +
      'called, <code>get_categories</code> most often at 83, and <code>get_challenge</code>, the first step of the ' +
      'write handshake, 35 times.',
  ],
  [
    '<p>Eleven tools, measured from a live <code>tools/list</code> call on 11 September 2026.',
    '<p>Eleven tools, measured from a live <code>tools/list</code> call on 20 September 2026.',
  ],
  [
    '<td>The tag hierarchy with a page count per category. 371 pages at the time of writing.</td>',
    '<td>The tag hierarchy with a page count per category. 371 pages on 20 September 2026.</td>',
  ],
  ['<p>Not every agent speaks the protocol, so the same corpus is published as flat files. Sizes below are as served on 11 September 2026.</p>',
    '<p>Not every agent speaks the protocol, so the same corpus is published as flat files. Sizes below are as served on 20 September 2026.</p>'],
  ['>/llms.txt</a></td><td>15 KB</td>', '>/llms.txt</a></td><td>16 KB</td>'],
  ['>/llms-index.txt</a></td><td>86 KB</td>', '>/llms-index.txt</a></td><td>93 KB</td>'],
];

const replaceOnce = (haystack, needle, replacement, where) => {
  const i = haystack.indexOf(needle);
  if (i < 0) throw new Error(`${where}: string not found: ${JSON.stringify(needle.slice(0, 70))}`);
  if (haystack.indexOf(needle, i + 1) >= 0) throw new Error(`${where}: string is not unique`);
  return haystack.slice(0, i) + replacement + haystack.slice(i + needle.length);
};

await withClient(async (client) => {
  const tagPath = 'contents/resources';
  const slug = 'mcp-server';
  if (isLockedPage(tagPath, slug)) throw new Error(`${tagPath}/${slug} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
    [tagPath, slug],
  );
  if (!rows.length) throw new Error('mcp-server not found');
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));

  if (JSON.stringify(blocks).includes('<td>93 KB</td>')) {
    console.log('  mcp-server: already re-measured - no write');
    return;
  }

  for (const [from, to] of EDITS) {
    const target =
      blocks.find((b) => (b.text || '').includes(from)) ||
      blocks.flatMap((b) => b.blocks || []).find((b) => (b.text || '').includes(from));
    if (!target) throw new Error(`mcp-server: no block holds ${JSON.stringify(from.slice(0, 60))}`);
    target.text = replaceOnce(target.text, from, to, 'mcp-server');
  }

  const version = '1.2.0';
  console.log(
    `  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}` +
      '\n        llms.txt 15 -> 16 KB, llms-index.txt 86 -> 93 KB; measured date 11 -> 20 September' +
      '\n        intro: pageview share (unmeasurable as written) -> 518 external tool calls in 30d',
  );
  if (DRY) return;

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
    [
      cuid(),
      page.id,
      json,
      page.title,
      version,
      'minor',
      AUTHOR_ID,
      'Re-measured on 20 September 2026. The corpus has grown since 11 September: llms.txt 15 KB to 16 KB ' +
        '(16,308 B), llms-index.txt 86 KB to 93 KB (95,351 B); llms-full.txt still rounds to 3.4 MB (3,582,250 B) ' +
        'and AGENTS.md and openapi.json are unchanged. Everything else re-read and unchanged: serverInfo 3.1.0 on ' +
        'protocol 2025-03-26, eleven tools with the same names, totalPages 371, GET 405, OPTIONS 204 with ' +
        'Access-Control-Allow-Origin, a 304 on a conditional GET of llms.txt, and wiki.radix/radix-wiki 3.1.0 still ' +
        'the latest in the MCP registry. The intro cited the endpoint\'s share of the site\'s pageviews, which the ' +
        'tracker no longer reports the same way, so it now cites the per-tool call log instead: 518 calls over the ' +
        'thirty days to 20 September from callers outside this wiki\'s own conformance suite and tooling, every read ' +
        'tool used, get_categories 83 and get_challenge 35.',
      now,
    ],
  );
  await client.query('COMMIT');
});
