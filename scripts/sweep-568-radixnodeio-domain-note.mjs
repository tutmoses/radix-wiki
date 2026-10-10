// Run 568 (ecosystem rotation): the link-rot note named the unrelated sites the lapsed domain
// redirects to (VOICE.md: never spell out a hostile domain) and carried a second, superseded note.
import { isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ecosystem';
const SLUG = 'radixnodeio';
const SENTINEL = 'id="domain-lapsed"';
const NOTE = '<p id="domain-lapsed"><em>The <code>radixnode.io</code> domain no longer belongs to the project and redirects to sites unrelated to Radix. Links on this page point to archived snapshots; do not follow the live domain.</em></p>';

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

  const block = blocks.find((b) => b.text?.includes('<p><em>Link-rot note (2026-07-30)'));
  if (!block) throw new Error('note block not found');
  const start = block.text.indexOf('<p><em>Link-rot note (2026-07-30)');
  const endMarker = 'archived snapshots</a>.</em></p>';
  const end = block.text.indexOf(endMarker, start);
  if (end < 0) throw new Error('second note end not found');
  block.text = block.text.slice(0, start) + NOTE + block.text.slice(end + endMarker.length);
  if (/ninjafloki|luongson/.test(JSON.stringify(blocks))) throw new Error('domain name still present');

  const version = await writeRevision(client, page, blocks, {
    change: 'patch',
    message: 'Link-rot note: replaced the two notes naming the unrelated sites the lapsed radixnode.io domain redirects to with one undated line; links stay on archived snapshots. Status re-checked, Closed.',
    verified: true,
    dry: DRY,
  });
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
});
