// Run 572 (ecosystem rotation): NFTS ON RADIX. "Where NFT Data Lives" says the ledger stores the
// pointer, not the image; Ciggie Puffs (new page this run) is the first collection to seal its
// drawing code on-ledger, so the section names it and links the new page inbound.
import { isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'contents/tech/core-protocols';
const SLUG = 'nfts-on-radix';
const SENTINEL = '/ecosystem/ciggie-puffs';
const ANCHOR = 'can store a verifiable hash of the image on-ledger or use content-addressed storage.</p>';
const ADD = '<p>A collection can also keep its art on the ledger itself. <a href="/ecosystem/ciggie-puffs" rel="noopener">Ciggie Puffs</a>, minted in October 2026, stores the code that draws all 10,000 of its NFTs in a sealed key-value store inside its component, and its site draws each one in the browser. Its <code>key_image_url</code> still points at a web host, so that wallets can show a picture.</p>';

await withClient(async (client) => {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied – no write');
    return;
  }
  const b = blocks.find((x) => x.text?.includes('Where NFT Data Lives'));
  if (!b?.text.includes(ANCHOR)) throw new Error('anchor not found');
  b.text = b.text.replace(ANCHOR, ANCHOR + ADD);

  const version = await writeRevision(client, page, blocks, {
    change: 'patch',
    message: 'Where NFT Data Lives: added Ciggie Puffs (Oct 2026) as a collection whose drawing code is sealed on-ledger, with its off-ledger key_image_url noted. Read from the CiggiePuffs component on the Gateway, 11 Oct 2026.',
    dry: DRY,
  });
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
});
