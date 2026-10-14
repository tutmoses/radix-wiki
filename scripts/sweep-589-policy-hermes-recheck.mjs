// Sweep 589 (policy rotation): /policy/no-original-research and /policy/neutral-point-of-view
// both cite Hermes Protocol's four dormancy checks. Re-run 14 Oct 2026: app.hermesprotocol.io
// still has no A/AAAA/CNAME, t.me/s/Hermes_Protocol newest post 27 Jun 2023, newest push to the
// eight HermesProtocol-io repos 2024-02-23, homepage 200. Record the third reading on the page.
import { isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ecosystem';
const SLUG = 'hermes-protocol';
const FIND = 'made on 13 August 2026 and repeated on 2 October 2026 with the same result';
const REPLACE = 'made on 13 August 2026 and repeated on 2 October and 14 October 2026 with the same result';

await withClient(async (client) => {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));
  if (blocks.some((b) => b.text?.includes(REPLACE))) {
    console.log('  already applied — no write');
    return;
  }
  const block = blocks.find((b) => b.text?.includes(FIND));
  if (!block) throw new Error('status sentence not found');
  block.text = block.text.replace(FIND, REPLACE);
  const version = await writeRevision(client, page, blocks, {
    change: 'patch',
    message: 'Status: the four dormancy checks re-run 14 Oct 2026 with the same result (app host has no DNS record, Telegram silent since 27 Jun 2023, newest push 23 Feb 2024, site up).',
    verified: true,
    dry: DRY,
  });
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
});
