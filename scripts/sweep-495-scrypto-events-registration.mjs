/**
 * sweep 495 - Scrypto track pages 03 and 04, compiled and run under Scrypto 1.4.0.
 *
 * Run 27 September 2026: every Rust snippet on both pages pasted into one
 * blueprint in a fresh `scrypto new-package`, scrypto = "=1.4.0", `cargo check`,
 * then `scrypto build` + resim publish/instantiate/call.
 *
 * 1. 04-events-metadata-royalties: the Events snippet derives ScryptoEvent and
 *    calls Runtime::emit_event but never registers the event on the blueprint.
 *    It compiles. The call that emits then fails in resim with
 *    SystemError(TypeCheckError(BlueprintPayloadDoesNotExist(..., Event("SwapEvent")))).
 *    With #[events(SwapEvent)] under #[blueprint] the same call commits and
 *    the receipt carries the event. The snippet also used an undefined
 *    `self_address`; Runtime::global_address() is what builds.
 * 2. enable_package_royalties! (04) and enable_method_auth! (03) must name
 *    every function/method of the blueprint: leaving one out is E0063,
 *    "missing field". Both snippets are fine as excerpts; the rule is stated.
 * 3. Links inside <pre><code> on both pages unwrapped (ResourceBuilder on 04,
 *    the manifest comment on 03).
 * 4. 03: sargon #452 and babylon-wallet-android #1446 re-read via the GitHub
 *    API: both still open, last updated 27 and 26 July 2026.
 *
 * Idempotent per page: skipped if its sentinel is already stored.
 */
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, assertLinkShapes, withClient } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const EVENTS_DOCS = 'https://docs.radixdlt.com/docs/scrypto-events/';

const unlinkCode = (html) =>
  html.replace(/<pre[\s\S]*?<\/pre>/g, (pre) => pre.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/g, '$1'));

const PAGES = [
  {
    tagPath: 'developers/scrypto',
    slug: '04-events-metadata-royalties',
    sentinel: '#[events(SwapEvent)]',
    version: '1.3.0',
    edits: [
      [
        '    pub pool_address: ComponentAddress,\n}\n\n// Inside a method:',
        '    pub pool_address: ComponentAddress,\n}\n\n#[blueprint]\n#[events(SwapEvent)]\nmod my_dex {\n    // ...\n}\n\n// Inside a method:',
      ],
      ['    pool_address: self_address,\n});', '    pool_address: Runtime::global_address(),\n});'],
      [
        '<p>Events appear in <a href="/developers/infrastructure/02-radix-apis"',
        '<p>The <code>#[events(SwapEvent)]</code> line is the one that is easy to leave out, and leaving it out does not stop the build. ' +
          `The <a href="${EVENTS_DOCS}" target="_blank" rel="noopener">blueprint macro</a> publishes each registered event's schema with the package, ` +
          'and the engine checks every emitted event against it. Without the registration, the method that emits fails when it runs: ' +
          'compiled and called under Scrypto 1.4.0 on 27 September 2026, it returned ' +
          '<code>SystemError(TypeCheckError(BlueprintPayloadDoesNotExist(..., Event("SwapEvent"))))</code>. ' +
          'With the line in place, the same call commits and the receipt carries the event. Several events go in one list: ' +
          '<code>#[events(SwapEvent, DepositEvent)]</code>.</p>' +
          '<p>Events appear in <a href="/developers/infrastructure/02-radix-apis"',
      ],
      [
        '<h3>Component Royalties</h3>',
        '<p>The macro has to name every function and method in the blueprint, <code>Free</code> where there is no charge. ' +
          'Leaving one out is a compile error, E0063, missing field.</p><h3>Component Royalties</h3>',
      ],
    ],
    message:
      'Compiled and ran every snippet under Scrypto 1.4.0 on 27 September 2026. The Events snippet never registered SwapEvent on ' +
      'the blueprint: it builds, but the emitting call fails in resim with TypeCheckError(BlueprintPayloadDoesNotExist(Event("SwapEvent"))). ' +
      'Added #[blueprint] #[events(SwapEvent)] to the snippet and a paragraph on the failure, replaced the undefined self_address with ' +
      'Runtime::global_address(), noted that enable_package_royalties! must list every function and method (E0063 otherwise), and ' +
      'removed the link inside the metadata code block. wiki-sweep run 495.',
  },
  {
    tagPath: 'developers/scrypto',
    slug: '03-authorization-and-badges',
    sentinel: 'every method in the blueprint has to appear',
    version: '3.1.0',
    edits: [
      [
        '        buy =&gt; PUBLIC;\n    }\n}</code></pre>',
        '        buy =&gt; PUBLIC;\n    }\n}</code></pre>\n<p>Under <code>methods</code>, every method in the blueprint has to appear, with <code>PUBLIC</code> for the open ones. ' +
          'A method left out is a compile error under Scrypto 1.4.0, E0063, missing field, rather than a method that defaults to open or closed.</p>',
      ],
      [
        'Both were still open as of 29 July 2026.</p>',
        'Read again on 27 September 2026, both are still open and neither has been updated since late July.</p>',
      ],
    ],
    message:
      'Compiled the enable_method_auth! snippet under Scrypto 1.4.0 on 27 September 2026: it builds, and a method missing from the ' +
      'methods list is E0063, now stated. sargon #452 and babylon-wallet-android #1446 re-read: both still open, last updated 27 and ' +
      '26 July. Removed the link inside the manifest code block. wiki-sweep run 495.',
  },
];

const replaceOnce = (haystack, needle, replacement) => {
  const i = haystack.indexOf(needle);
  if (i < 0) throw new Error(`string not found: ${JSON.stringify(needle.slice(0, 70))}`);
  if (haystack.indexOf(needle, i + 1) >= 0) throw new Error(`string is not unique: ${JSON.stringify(needle.slice(0, 70))}`);
  return haystack.slice(0, i) + replacement + haystack.slice(i + needle.length);
};

await withClient(async (client) => {
  for (const p of PAGES) {
    if (isLockedPage(p.tagPath, p.slug)) throw new Error(`${p.tagPath}/${p.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
      [p.tagPath, p.slug],
    );
    if (!rows.length) throw new Error(`${p.slug}: page not found`);
    const page = rows[0];
    if (JSON.stringify(page.content).includes(JSON.stringify(p.sentinel).slice(1, -1))) {
      console.log(`  ${page.title}: already applied - no write`);
      continue;
    }
    const blocks = JSON.parse(JSON.stringify(page.content));
    let unlinked = 0;
    for (const b of blocks) {
      if (!b.text) continue;
      const next = unlinkCode(b.text);
      if (next !== b.text) unlinked++;
      b.text = next;
    }
    for (const [from, to] of p.edits) {
      const hits = blocks.filter((b) => (b.text || '').includes(from));
      if (hits.length !== 1) throw new Error(`${p.slug}: ${hits.length} blocks hold ${JSON.stringify(from.slice(0, 60))}`);
      hits[0].text = replaceOnce(hits[0].text, from, to);
    }
    if (blocks.some((b) => (b.text || '').match(/<pre[\s\S]*?<\/pre>/g)?.some((pre) => /<a\b/.test(pre)))) throw new Error('link left inside <pre>');
    assertLinkShapes(blocks, page.title);
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${p.version}  (${p.edits.length} edits, ${unlinked} blocks unlinked)`);
    if (DRY) continue;
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query(
      'UPDATE pages SET content = $1, version = $2, updated_at = $3, last_verified_at = $3 WHERE id = $4',
      [json, p.version, now, page.id],
    );
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, p.version, 'minor', AUTHOR_ID, p.message, now],
    );
    await client.query('COMMIT');
  }
});
