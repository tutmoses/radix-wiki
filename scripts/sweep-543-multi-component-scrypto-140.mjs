/**
 * sweep 543 - developers rotation: 07-multi-component-architecture compiled
 * and run under Scrypto 1.4.0.
 *
 * Run 6 October 2026. Recipe from run 507: scrypto new-package, scrypto = "=1.4.0",
 * dev-dependency, Cargo.lock and tests/ dropped, cargo check, then scrypto build
 * and resim publish / instantiate / call.
 *
 * 1. Inter-component calls. The snippet passed "XRD/USD" (a &str) to a method
 *    declared pair: String: E0308, mismatched types. Global<Treasury> also needs
 *    the blueprint in scope (use super::treasury::Treasury), which cargo reports
 *    as an unused import although removing it gives E0412. Replaced with the
 *    version that ran: three components, 10 XRD paid, Treasury.balance() = 10,
 *    20 tokens returned at a feed price of 2.
 * 2. extern_blueprint!. Written at the crate root, as the page showed it, the
 *    compiler answers "cannot find macro `extern_blueprint`": the #[blueprint]
 *    attribute macro finds and rewrites it (scrypto-derive/src/blueprint.rs,
 *    v1.4.0), so it only exists inside a blueprint module. A second package
 *    importing PriceFeed by its resim package address compiled, instantiated it
 *    through Blueprint::<PriceFeed>::instantiate() and read 2 from get_price.
 * 3. External Links listed reusable-blueprints-pattern twice under two names.
 *
 * Idempotent: skipped if the sentinel is already stored.
 */
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, assertLinkShapes, withClient } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'developers/scrypto';
const SLUG = '07-multi-component-architecture';
const SENTINEL = 'Blueprint::&lt;PriceFeed&gt;::instantiate()';
const VERSION = '1.4.0';
const DERIVE_RS = 'https://github.com/radixdlt/radixdlt-scrypto/blob/v1.4.0/scrypto-derive/src/blueprint.rs';
const ext = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const code = (s) => '<pre><code>' + s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</code></pre>';

const OLD_CALLS =
  '<pre><code>struct MyDapp {\n    treasury: Global&lt;Treasury&gt;,\n    price_feed: Global&lt;PriceFeed&gt;,\n}\n\nimpl MyDapp {\n' +
  '    pub fn buy(&amp;mut self, payment: Bucket) -&gt; Bucket {\n        let price = self.price_feed.get_price("XRD/USD");\n' +
  '        // ... calculate tokens owed ...\n        self.treasury.deposit(payment);\n        // ... return tokens ...\n    }\n}</code></pre>';

const NEW_CALLS =
  code(`#[blueprint]
mod my_dapp {
    // Treasury and PriceFeed are blueprints in the same package.
    use super::price_feed::PriceFeed;
    use super::treasury::Treasury;

    struct MyDapp {
        treasury: Global<Treasury>,
        price_feed: Global<PriceFeed>,
        tokens: FungibleVault,
    }

    impl MyDapp {
        pub fn buy(&mut self, payment: Bucket) -> Bucket {
            let price = self.price_feed.get_price("XRD/USD".to_string());
            let owed = payment.amount() * price;
            self.treasury.deposit(payment);
            self.tokens.take(owed).into()
        }
    }
}`) +
  '\n<p>Compiled and run under Scrypto 1.4.0 on 6 October 2026, with a <code>Treasury</code> holding an XRD vault and a ' +
  '<code>PriceFeed</code> returning 2: a call to <code>buy</code> with 10 XRD left 10 XRD in the treasury and 20 tokens in the ' +
  'caller\'s account. Two details the compiler enforces. <code>get_price</code> takes a <code>String</code>, so a bare ' +
  '<code>"XRD/USD"</code> is a type error (E0308) and needs <code>.to_string()</code>. And the <code>use</code> lines are ' +
  'required: cargo flags them as unused imports, but without them <code>Global&lt;Treasury&gt;</code> does not resolve (E0412).</p>';

const OLD_EXTERN_P =
  '<p>To use a blueprint from another package, import it by its package address and instantiate or call it. The ' +
  '<a href="/developers/scrypto/01-fundamentals">Scrypto</a> <code>extern_blueprint!</code> macro generates type-safe bindings:</p>';
const NEW_EXTERN_P =
  '<p>To use a blueprint from another package, import it by its package address and instantiate or call it. The ' +
  '<a href="/developers/scrypto/01-fundamentals">Scrypto</a> <code>extern_blueprint!</code> macro generates type-safe bindings. ' +
  `It goes inside the <code>#[blueprint]</code> module, because the attribute macro is what finds and expands it ` +
  `(${ext(DERIVE_RS, 'source')}); written at the crate root, it fails with <em>cannot find macro</em>:</p>`;

const OLD_EXTERN_CODE =
  '<pre><code>extern_blueprint! {\n    "package_rdx...",       // on-ledger package address\n    PriceFeed {             // blueprint name\n' +
  '        fn get_price(&amp;self, pair: String) -&gt; Decimal;\n    }\n}</code></pre>';
const NEW_EXTERN_CODE = code(`#[blueprint]
mod pricing_user {
    extern_blueprint! {
        "package_rdx1...",   // the package's address on the network you deploy to
        PriceFeed {
            fn instantiate() -> Global<PriceFeed>;
            fn get_price(&self, pair: String) -> Decimal;
        }
    }

    struct PricingUser {
        price_feed: Global<PriceFeed>,
    }

    impl PricingUser {
        pub fn instantiate() -> Global<PricingUser> {
            let price_feed = Blueprint::<PriceFeed>::instantiate();
            Self { price_feed }.instantiate().prepare_to_globalize(OwnerRole::None).globalize()
        }

        pub fn quote(&self) -> Decimal {
            self.price_feed.get_price("XRD/USD".to_string())
        }
    }
}`);

const OLD_TYPED =
  '<p>This generates a type you can use in your component\'s state and method signatures, with full compile-time type checking.</p>';
const NEW_TYPED =
  '<p>This generates a type you can use in your component\'s state and method signatures, with full compile-time type checking. ' +
  'Functions listed in the block are called through <code>Blueprint::&lt;PriceFeed&gt;</code>, methods on a ' +
  '<code>Global&lt;PriceFeed&gt;</code>. Tested on 6 October 2026 by publishing the <code>PriceFeed</code> package to resim and ' +
  'importing it from a second package by that address: <code>quote</code> returned 2.</p>';

const OLD_LINKS_DUP =
  '\n<li><a href="https://docs.radixdlt.com/docs/reusable-blueprints-pattern" target="_blank" rel="noopener">Reusable Blueprints Pattern – Official Docs</a></li>';

const OLD_INFOBOX_ROW = '<tr><td>Catalog</td>';
const NEW_INFOBOX_ROWS =
  '<tr><td>Series</td><td><a href="/developers/scrypto">Scrypto track</a>, part 7</td></tr>\n' +
  '<tr><td>Tested with</td><td>Scrypto 1.4.0, 6 October 2026</td></tr>\n<tr><td>Catalog</td>';

const MESSAGE =
  'Compiled and ran every snippet under Scrypto 1.4.0 on 6 October 2026. The inter-component example passed a &str where ' +
  'get_price takes a String (E0308) and lacked the use lines Global<Treasury> needs (E0412 without them); replaced with the ' +
  'version that ran in resim (10 XRD in, 10 in the treasury, 20 tokens out at price 2). extern_blueprint! only expands ' +
  'inside a #[blueprint] module (scrypto-derive/src/blueprint.rs); example rewritten in place, with instantiate called ' +
  'through Blueprint::<PriceFeed>, and tested across two packages. Duplicate External Link removed; infobox gains series ' +
  'and tested-with rows. wiki-sweep run 543.';

const replaceOnce = (haystack, needle, replacement) => {
  const i = haystack.indexOf(needle);
  if (i < 0) throw new Error(`string not found: ${JSON.stringify(needle.slice(0, 70))}`);
  if (haystack.indexOf(needle, i + 1) >= 0) throw new Error(`string is not unique: ${JSON.stringify(needle.slice(0, 70))}`);
  return haystack.slice(0, i) + replacement + haystack.slice(i + needle.length);
};

await withClient(async (client) => {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query('SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  if (JSON.stringify(page.content).includes(SENTINEL)) {
    console.log(`  ${page.title}: already applied - no write`);
    return;
  }
  const blocks = JSON.parse(JSON.stringify(page.content));
  const edits = [
    [OLD_CALLS, NEW_CALLS],
    [OLD_EXTERN_P, NEW_EXTERN_P],
    [OLD_EXTERN_CODE, NEW_EXTERN_CODE],
    [OLD_TYPED, NEW_TYPED],
    [OLD_LINKS_DUP, ''],
  ];
  for (const [from, to] of edits) {
    const hits = blocks.filter((b) => (b.text || '').includes(from));
    if (hits.length !== 1) throw new Error(`${hits.length} blocks hold ${JSON.stringify(from.slice(0, 60))}`);
    hits[0].text = replaceOnce(hits[0].text, from, to);
  }
  const box = blocks[0]?.type === 'infobox' ? blocks[0].blocks?.[0] : undefined;
  if (!box) throw new Error('infobox not found');
  box.text = replaceOnce(box.text, OLD_INFOBOX_ROW, NEW_INFOBOX_ROWS);

  const json = JSON.stringify(blocks);
  if (json.includes('—')) throw new Error('em dash in the new content');
  if (json.includes(' ')) throw new Error('U+00A0 in the new content');
  if (blocks.some((b) => (b.text || '').match(/<pre[\s\S]*?<\/pre>/g)?.some((pre) => /<a\b/.test(pre)))) throw new Error('link left inside <pre>');
  assertLinkShapes(blocks, page.title);
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${VERSION}  (${edits.length} edits + infobox)`);
  if (DRY) {
    const before = new Set(page.content.map((b) => b.text));
    for (const b of blocks) if (b.text && !before.has(b.text)) console.log('\n----\n' + b.text);
    console.log('\n---- infobox\n' + box.text);
    return;
  }
  const now = new Date().toISOString();
  await client.query('BEGIN');
  await client.query('UPDATE pages SET content = $1, version = $2, updated_at = $3, last_verified_at = $3 WHERE id = $4', [json, VERSION, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, VERSION, 'minor', AUTHOR_ID, MESSAGE, now],
  );
  await client.query('COMMIT');
  console.log('  written');
});
