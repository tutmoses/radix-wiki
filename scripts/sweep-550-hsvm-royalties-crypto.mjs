// Sweep 550: hyperscale-vm gains the lead developer's 7 Oct statements on royalties and
// cryptography natives (t.me/hyperscale_rs 13298, 13299, 13304, authorship checked via
// ?embed=1&mode=tme); commit count and last commit re-read from GitHub on 7 Oct.
import { isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'contents/tech/research';
const SLUG = 'hyperscale-vm';
const SENTINEL = 't.me/hyperscale_rs/13298';

const A = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

const PARA = `<p>Two parts of the Radix Engine will not carry over. hyperscale-vm has no ` +
  `<a href="/contents/tech/core-concepts/component-royalties" rel="noopener">royalties</a>, the Radix Engine feature that lets a package or component charge a fee each time it is called. ` +
  `On 7 October the lead developer ${A('https://t.me/hyperscale_rs/13298', 'said')} that few developers use royalties for their intended purpose, that a contract can collect fees in its own logic, and that he would rather ask the handful of Scrypto developers to rewrite that logic than support the feature permanently. ` +
  `He ${A('https://t.me/hyperscale_rs/13299', 'added')} that the engine's cryptography functions have not been started and will not follow the Radix Engine's. ` +
  `The ${A('https://t.me/hyperscale_rs/13304', 'plan')} covers three areas: hashing, with SHA-256, Keccak, BLAKE3 and Poseidon among the families; verification of the signature schemes the network already accepts for authentication, Ed25519, secp256k1 and ML-DSA-65, possibly with secp256r1 to open a path to passkeys; and complete native proof verifiers comparable to Sui's ${A('https://github.com/MystenLabs/fastcrypto', 'fastcrypto')} library. ` +
  `He asked developers with a use case for any of the three to raise it in the channel.</p>`;

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

  const rel = blocks.find((b) => b.type === 'content' && b.text?.includes('Relationship to the Radix Engine and Scrypto'));
  if (!rel) throw new Error('relationship block not found');
  rel.text = rel.text + PARA;

  const info = blocks[0].blocks?.[0];
  const oldCommits = '1,253 on';
  if (!info?.text.includes(oldCommits) || !info.text.includes('read 25 September 2026')) throw new Error('infobox commit row not found');
  info.text = info.text.replace(oldCommits, '1,259 on').replace('read 25 September 2026', 'read 7 October 2026');

  const status = blocks.find((b) => b.type === 'content' && b.text?.includes('All 1,253 commits'));
  if (!status) throw new Error('status block not found');
  const before = status.text;
  status.text = status.text
    .replace('All 1,253 commits', 'All 1,259 commits')
    .replace(/to 25 September 2026 are by flightofthefox, and the last push was on 25 September/, 'to 7 October 2026 are by flightofthefox, and the latest was made on 27 September');
  if (status.text === before || !status.text.includes('27 September')) throw new Error('status replace no-op');

  const version = await writeRevision(client, page, blocks, {
    change: 'minor',
    message: 'Relationship to the Radix Engine gains the lead developer\'s 7 Oct statements: no royalties in hyperscale-vm, cryptography natives not started, planned hashing, signature and proof verifiers (t.me/hyperscale_rs/13298, 13299, 13304). Commit count (1,259) and latest commit (27 Sep) re-read from GitHub, 7 Oct.',
    verified: true,
    dry: DRY,
  });
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
});
