// Sweep 590, ecosystem rotation: AlphaDEX was the staleness head (updated 1 Sep).
// Re-read 14 Oct 2026: alphadex.net 200 (footer still "© 2023"), alphadex-sdk-js latest 0.12.16
// published 24 Nov 2024, Medium newest post 27 Jun 2023, announcement channel newest post 16 Mar 2024.
// The lead still said the exchange was "being built"; it gains a dated Status section, loses a
// duplicated video caption, and a misspelling of the founder's name is corrected.
import { isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ecosystem';
const SLUG = 'alphadex';
const SENTINEL = '<h2>Status</h2>';

const STATUS = `<h2>Status</h2><p>As of 14 October 2026 the project shows no public development. The <a href="https://www.npmjs.com/package/alphadex-sdk-js" target="_blank" rel="noopener">alphadex-sdk-js</a> package last published a release, 0.12.16, on 24 November 2024. The <a href="https://medium.com/alphadex-xrd" target="_blank" rel="noopener">AlphaDEX blog</a> last posted on 27 June 2023, and the <a href="https://t.me/s/alphadex_xrd_announce" target="_blank" rel="noopener">announcement channel</a> on 16 March 2024. <a href="https://alphadex.net" target="_blank" rel="noopener">alphadex.net</a> still loads, with its SDK, API and tutorial links, and the matching engine stays on-ledger for any front-end that calls it.</p>`;

const swaps = [
  ['is a decentralized order book exchange being built on Radix.', 'is a decentralized order book exchange on Radix.'],
  ['In March 2023, Liebenburg participated', 'In March 2023, Liebenberg took part'],
  ['<p>Towards the Storm, Episode 9: AlphaDEX featuring Fred Liebenberg.</p>', ''],
  ['<h2>Founders</h2>', `${STATUS}<h2>Founders</h2>`],
];

await withClient(async (client) => {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (blocks.some((b) => b.text?.includes(SENTINEL))) {
    console.log('  already applied — no write');
    return;
  }
  const block = blocks.find((b) => b.id === 'block-alphadex-1');
  for (const [from, to] of swaps) {
    if (!block.text.includes(from)) throw new Error(`missing: ${from.slice(0, 60)}`);
    block.text = block.text.replace(from, to);
  }

  const version = await writeRevision(client, page, blocks, {
    change: 'minor',
    message: 'Sweep 590: lead no longer says AlphaDEX is "being built"; new dated Status section (SDK last release 24 Nov 2024 per npm, blog last post 27 Jun 2023, announcement channel 16 Mar 2024, alphadex.net up); duplicated video caption removed; "Liebenburg" corrected.',
    verified: true,
    dry: DRY,
  });
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
});
