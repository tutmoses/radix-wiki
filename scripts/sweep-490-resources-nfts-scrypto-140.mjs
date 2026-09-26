/**
 * sweep 490 - Resources, Vaults, and NFTs, compiled under Scrypto 1.4.0.
 *
 * Run 26 September 2026: every snippet on the page pasted into one blueprint
 * in a fresh `scrypto new-package`, scrypto = "=1.4.0", `cargo check`:
 *
 * 1. error[E0282] "type annotations needed" at
 *    `let my_token = ResourceBuilder::new_fungible(...)...mint_initial_supply(1_000_000).into();`
 *    as soon as the variable is used - the same failure run 483 fixed on
 *    02-first-blueprint. The NFT snippet has the identical `.into()` shape.
 *    Both annotated `: Bucket`, which builds.
 * 2. error[E0599] "no method named `create_proof_of_all` found for struct
 *    `Vault`". Vault has never had it: absent from scrypto/src/resource/vault.rs
 *    at v1.0.0, v1.3.1 and v1.4.0 (it exists on buckets and on LocalAuthZone).
 *    A fungible vault makes a proof with create_proof_of_amount. The comment
 *    beside it was also wrong: a proof made in a blueprint is returned to the
 *    caller, not placed in the Auth Zone; LocalAuthZone::push puts it there.
 *    With `.as_fungible().create_proof_of_amount(1)` + `LocalAuthZone::push`
 *    the blueprint builds (two deprecation warnings on ResourceManager::mint and
 *    update_non_fungible_data remain, not errors; left as they are).
 * 3. The code blocks carried <a> tags inside <pre><code>, which render as links
 *    inside code and break copy-paste of the snippet's text. Unwrapped.
 *
 * Idempotent: skipped if the sentinel is already stored.
 */
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, assertLinkShapes, withClient } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'developers/scrypto';
const SLUG = '02-resources-and-nfts';
const SENTINEL = 'let my_token: Bucket = ResourceBuilder';
const VERSION = '1.4.0';
const REL = 'https://github.com/radixdlt/radixdlt-scrypto/releases/tag/v1.4.0';
const VAULT_RS = 'https://github.com/radixdlt/radixdlt-scrypto/blob/v1.4.0/scrypto/src/resource/vault.rs';
const AUTHZONE_RS = 'https://github.com/radixdlt/radixdlt-scrypto/blob/v1.4.0/scrypto/src/runtime/local_auth_zone.rs';

// Unwrap every <a> inside a <pre>...</pre>, keeping its text.
const unlinkCode = (html) =>
  html.replace(/<pre[\s\S]*?<\/pre>/g, (pre) => pre.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/g, '$1'));

const EDITS = [
  ['let my_token = ResourceBuilder::new_fungible', `${SENTINEL}::new_fungible`],
  ['let tickets = ResourceBuilder::new_integer_non_fungible', 'let tickets: Bucket = ResourceBuilder::new_integer_non_fungible'],
  [
    '<p>This creates 1 million tokens with locked name and symbol.',
    '<p>This creates 1 million tokens with locked name and symbol. The <code>: Bucket</code> annotation is required from ' +
      `<a href="${REL}" target="_blank" rel="noopener">Scrypto v1.4.0</a>: without it <code>.into()</code> has no target ` +
      'type, and the build stops with error E0282, type annotations needed, as soon as the variable is used.',
  ],
  [
    '// Create a proof from a vault\nlet proof = self.admin_badge.create_proof_of_all();\n\n' +
      '// The proof is automatically placed in the Auth Zone\n' +
      '// where the Radix Engine checks it against access rules',
    '// Create a proof of one admin badge held in a vault\n' +
      'let proof = self.admin_badge.as_fungible().create_proof_of_amount(1);\n\n' +
      '// A proof made in a blueprint comes back to you. Push it onto the\n' +
      '// Auth Zone, where the Radix Engine checks it against access rules\n' +
      'LocalAuthZone::push(proof);',
  ],
  [
    '<p>Proofs are central to Radix\'s',
    `<p>A <code>Vault</code> has no <code>create_proof_of_all</code>: <a href="${VAULT_RS}" target="_blank" rel="noopener">` +
      'fungible vaults</a> prove an amount and non-fungible vaults prove specific IDs, and ' +
      `<a href="${AUTHZONE_RS}" target="_blank" rel="noopener"><code>LocalAuthZone</code></a> is where a proof goes to count ` +
      'towards a call. <code>authorize_with_amount(1, || ...)</code> does both in one step and drops the proof when the closure ' +
      'returns.</p><p>Proofs are central to Radix\'s',
  ],
];

const MESSAGE =
  'Compiled every snippet under Scrypto 1.4.0 on 26 September 2026. let my_token = ...mint_initial_supply(1_000_000).into() ' +
  'failed E0282 once used (the run-483 failure on 02-first-blueprint); both it and the NFT snippet are annotated : Bucket. ' +
  'self.admin_badge.create_proof_of_all() failed E0599: Vault has no such method at v1.0.0, v1.3.1 or v1.4.0; replaced with ' +
  '.as_fungible().create_proof_of_amount(1) and LocalAuthZone::push, and the comment that said the proof lands in the Auth Zone ' +
  'by itself is corrected. The blueprint now builds. Links removed from inside code blocks. wiki-sweep run 490.';

const replaceOnce = (haystack, needle, replacement) => {
  const i = haystack.indexOf(needle);
  if (i < 0) throw new Error(`string not found: ${JSON.stringify(needle.slice(0, 70))}`);
  if (haystack.indexOf(needle, i + 1) >= 0) throw new Error(`string is not unique: ${JSON.stringify(needle.slice(0, 70))}`);
  return haystack.slice(0, i) + replacement + haystack.slice(i + needle.length);
};

await withClient(async (client) => {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${TAG_PATH}/${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
    [TAG_PATH, SLUG],
  );
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  if (JSON.stringify(page.content).includes(SENTINEL)) {
    console.log('  already applied - no write');
    return;
  }
  const blocks = JSON.parse(JSON.stringify(page.content));
  let unlinked = 0;
  for (const b of blocks) {
    if (!b.text) continue;
    const next = unlinkCode(b.text);
    if (next !== b.text) unlinked++;
    b.text = next;
  }
  for (const [from, to] of EDITS) {
    const hits = blocks.filter((b) => (b.text || '').includes(from));
    if (hits.length !== 1) throw new Error(`${hits.length} blocks hold ${JSON.stringify(from.slice(0, 60))}`);
    hits[0].text = replaceOnce(hits[0].text, from, to);
  }
  if (blocks.some((b) => /<pre[\s\S]*?<a\b[\s\S]*?<\/pre>/.test(b.text || ''))) throw new Error('link left inside <pre>');
  assertLinkShapes(blocks, page.title);
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${VERSION}  (${EDITS.length} edits, ${unlinked} blocks unlinked)`);
  if (DRY) return;
  const now = new Date().toISOString();
  const json = JSON.stringify(blocks);
  await client.query('BEGIN');
  await client.query(
    'UPDATE pages SET content = $1, version = $2, updated_at = $3, last_verified_at = $3 WHERE id = $4',
    [json, VERSION, now, page.id],
  );
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, VERSION, 'minor', AUTHOR_ID, MESSAGE, now],
  );
  await client.query('COMMIT');
});
