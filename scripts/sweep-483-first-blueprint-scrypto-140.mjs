/**
 * sweep 483 - developers rotation. Your First Blueprint, rebuilt and re-run
 * under Scrypto 1.4.0, and two commands on it that no longer work.
 *
 * Run 25 September 2026 with the page's own src/lib.rs in a fresh
 * `scrypto new-package`, Rust 1.92.0 (the channel both v1.3.1 and v1.4.0 pin):
 *
 * 1. `scrypto build` fails, error[E0282] "type annotations needed" at
 *    `let gumballs = ResourceBuilder::new_fungible(...)...mint_initial_supply(100).into();`.
 *    It fails the same way with `scrypto = "=1.3.1"` pinned, because scrypto
 *    1.3.1 declares its own radix-common, sbor, scrypto-derive etc. with caret
 *    requirements ("1.3.1"), which now resolve to 1.4.0 (Cargo.lock checked).
 *    The walkthrough captured on 18 August built cleanly because 1.4.0 was not
 *    yet published (studio/transcripts/first-blueprint.json). With
 *    `let gumballs: Bucket = ...` the package builds.
 * 2. `resim call-method <component> buy_gumball "10,resource_sim1tkn..."` fails
 *    with TransactionConstructionError(...FailedToParse(...)). resim's fungible
 *    specifier is `<resource_address>:<amount>` in both v1.3.1 and v1.4.0
 *    (radix-clis/src/utils/resource_specifier.rs). With
 *    "resource_sim1tkn...:10" the call commits and the account shows
 *    9,995 XRD and 1 GUM, as the page says.
 *
 * Idempotent: skipped if the sentinel is already stored.
 */
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, assertLinkShapes, withClient } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'developers/getting-started';
const SLUG = '02-first-blueprint';
const SENTINEL = 'let gumballs: Bucket = ResourceBuilder';
const VERSION = '1.4.0';
const XRD_SIM = 'resource_sim1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxakj8n3';

const EDITS = [
  ['let gumballs = ResourceBuilder::new_fungible(OwnerRole::None)', `${SENTINEL}::new_fungible(OwnerRole::None)`],
  [`buy_gumball "10,${XRD_SIM}"`, `buy_gumball "${XRD_SIM}:10"`],
  [
    '<p>On macOS this stops in <code>blst</code> without the two compiler variables',
    '<p>The <code>: Bucket</code> annotation on <code>gumballs</code> is required from ' +
      '<a href="https://github.com/radixdlt/radixdlt-scrypto/releases/tag/v1.4.0" target="_blank" rel="noopener">Scrypto v1.4.0</a> ' +
      'of 7 September 2026. Without it the build stops with error E0282, type annotations needed, because the compiler can no ' +
      'longer tell what <code>.into()</code> should convert the minted bucket into. Pinning <code>scrypto = "1.3.1"</code> ' +
      'does not avoid it: <a href="https://docs.rs/crate/scrypto/1.3.1/source/Cargo.toml" target="_blank" rel="noopener">scrypto 1.3.1 ' +
      'declares its own Radix dependencies</a> as <code>1.3.1</code> or later, so a fresh build pulls their 1.4.0 releases.</p>' +
      '<p>On macOS this stops in <code>blst</code> without the two compiler variables',
  ],
  [
    '<p>You should see GUM tokens in your account and 5 XRD change returned.</p>',
    '<p>You should see GUM tokens in your account and 5 XRD change returned. resim writes a fungible amount as ' +
      '<code>&lt;resource_address&gt;:&lt;amount&gt;</code>, address first, ' +
      '<a href="https://github.com/radixdlt/radixdlt-scrypto/blob/v1.4.0/radix-clis/src/utils/resource_specifier.rs" target="_blank" rel="noopener">as radix-clis parses it</a>.</p>',
  ],
];

const MESSAGE =
  'Rebuilt and re-ran the tutorial under Scrypto 1.4.0 on 25 September 2026. The blueprint failed to compile (E0282 at ' +
  'let gumballs = ...mint_initial_supply(100).into()), also with scrypto pinned to =1.3.1, whose caret dependencies now ' +
  'resolve to 1.4.0; annotated as let gumballs: Bucket, which builds. The resim buy_gumball call passed "10,<xrd>", which ' +
  'resim rejects (FailedToParse); its fungible specifier is <resource_address>:<amount> in v1.3.1 and v1.4.0 ' +
  '(radix-clis resource_specifier.rs). Corrected, and the full reset/new-account/publish/instantiate/buy/show sequence ' +
  'now commits and leaves 9,995 XRD and 1 GUM. Two sentences explain both. wiki-sweep run 483.';

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
  for (const [from, to] of EDITS) {
    const hits = blocks.filter((b) => (b.text || '').includes(from));
    if (hits.length !== 1) throw new Error(`${hits.length} blocks hold ${JSON.stringify(from.slice(0, 60))}`);
    hits[0].text = replaceOnce(hits[0].text, from, to);
  }
  assertLinkShapes(blocks, page.title);
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${VERSION}  (${EDITS.length} edits)`);
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
