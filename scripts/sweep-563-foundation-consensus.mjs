// Sweep 563: /ecosystem/radix-foundation said the Radix Public Network "is built on a novel consensus
// algorithm called Cerberus" with no source. Babylon mainnet runs Cerberus only in its unsharded form, a
// single shard group, which the babylon-node README describes as a variant of the original HotStuff BFT
// (arXiv:1803.05069); sharded Cerberus has never shipped. Same wording as the homepage and
// /contents/tech/releases/radix-mainnet-babylon. No Xi'an or 2027 wording on this page (checked against
// the run-559/560 correction).
import { isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ecosystem';
const SLUG = 'radix-foundation';
const SENTINEL = 'babylon-node#readme';

const FROM = `It is built on a novel consensus algorithm called Cerberus and utilizes a unique asset-oriented architecture.</p>`;
const TO = `Its <a href="/contents/tech/releases/radix-mainnet-babylon">Babylon mainnet</a> runs the <a href="/contents/tech/core-protocols/cerberus-consensus-protocol">Cerberus</a> consensus protocol in its unsharded form, a single shard group that the <a href="https://github.com/radixdlt/babylon-node#readme" target="_blank" rel="noopener">node's README</a> describes as a variant of the original <a href="https://arxiv.org/abs/1803.05069" target="_blank" rel="noopener">HotStuff</a> BFT consensus, and it uses an asset-oriented execution model, the <a href="/contents/tech/core-protocols/radix-engine">Radix Engine</a>.</p>`;

const swap = (b) => {
  let n = 0;
  if (b.text?.includes(FROM)) { b.text = b.text.replace(FROM, TO); n++; }
  for (const c of b.blocks ?? []) n += swap(c);
  return n;
};

await withClient(async (client) => {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) { console.log('  already applied – no write'); return; }
  const n = blocks.reduce((s, b) => s + swap(b), 0);
  if (n !== 1) throw new Error(`edit matched ${n} times`);
  const version = await writeRevision(client, page, blocks, {
    change: 'patch',
    message: 'Consensus line made precise and sourced: Babylon mainnet runs unsharded Cerberus, a variant of the original HotStuff BFT per the babylon-node README (arXiv:1803.05069), not the sharded design; links to the Babylon, Cerberus and Radix Engine pages.',
    verified: true, dry: DRY,
  });
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
});
