import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

// Run 325, developers rotation.
//
// The page's TypeScript example ended `console.log(manifest.toString())`, and the
// paragraph under it said the result "is the same manifest text described in
// Transaction Manifest Language". Read from inside the published tarball of
// @radixdlt/radix-engine-toolkit 1.0.6, both are wrong:
//
//   dist/builder/manifest.d.ts   ManifestBuilder.build(): TransactionManifest
//   dist/models/transaction/manifest.d.ts
//     export interface TransactionManifest { instructions: Instructions; blobs: Uint8Array[] }
//   dist/radix-engine-toolkit.mjs  build() { return { instructions: { kind: "Parsed",
//     value: this.instructions }, blobs: this.blobs } }
//
// TransactionManifest is a plain interface with no toString(), so the sample's last
// line prints "[object Object]". The builder produces a PARSED instruction tree;
// manifest text is a separate async WASM call,
//   RadixEngineToolkit.Instructions.convert(instructions, networkId, "String")
//   -> Promise<Instructions>  (dist/wasm/default.d.ts:98)
// which needs a network id because manifest text carries Bech32m addresses.
//
// Everything else on the page verified clean against the same tarball: the three
// entry-point classes exist (RadixEngineToolkit, LTSRadixEngineToolkit in
// dist/lts/toolkit.d.ts, RawRadixEngineToolkit in dist/wasm/raw.d.ts), address /
// bucket / decimal are exported value constructors, takeAllFromWorktop takes the
// (builder, bucketId) callback shown, and TransactionBuilder walks
// header -> manifest -> sign -> notarize as described.

const TAG_PATH = 'developers/transactions';
const SLUG = '04-radix-engine-toolkit';
const SENTINEL = 'Instructions.convert';
const DRY = process.argv.includes('--dry-run');

const INFOBOX_FIND = `<tr><td>Scope</td><td>Off-ledger only – no ledger state</td></tr>`;
const INFOBOX_REPLACE = `<tr><td>Scope</td><td>Off-ledger only – no ledger state</td></tr>
<tr><td>TypeScript wrapper</td><td>1.0.6, published 3 December 2025</td></tr>
<tr><td>Licence</td><td>Apache-2.0</td></tr>`;

const CODE_FIND = `<pre><code>import {
  ManifestBuilder,
  address,
  bucket,
  decimal,
} from "@radixdlt/radix-engine-toolkit";

const manifest = new ManifestBuilder()
  .callMethod(senderAccount, "lock_fee", [decimal(5)])
  .callMethod(senderAccount, "withdraw", [address(xrd), decimal(10)])
  .takeAllFromWorktop(xrd, (builder, bucketId) =&gt;
    builder.callMethod(recipientAccount, "try_deposit_or_abort", [bucket(bucketId)])
  )
  .build();

console.log(manifest.toString());</code></pre>
<p>The result is the same manifest text described in <a href="/developers/transactions/01-manifest-language" rel="noopener">Transaction Manifest Language</a> – the builder is a typed way to produce it, not a different format. From there <code>TransactionBuilder</code> carries you through header, signatures, and notarisation to a compiled transaction ready for the Gateway, which is the flow described in <a href="/developers/transactions/02-transaction-lifecycle" rel="noopener">Transaction Lifecycle</a>.</p>`;

const CODE_REPLACE = `<pre><code>import {
  ManifestBuilder,
  RadixEngineToolkit,
  NetworkId,
  address,
  bucket,
  decimal,
} from "@radixdlt/radix-engine-toolkit";

const manifest = new ManifestBuilder()
  .callMethod(senderAccount, "lock_fee", [decimal(5)])
  .callMethod(senderAccount, "withdraw", [address(xrd), decimal(10)])
  .takeAllFromWorktop(xrd, (builder, bucketId) =&gt;
    builder.callMethod(recipientAccount, "try_deposit_or_abort", [bucket(bucketId)])
  )
  .build();

// build() returns { instructions: { kind: "Parsed", value: [...] }, blobs: [] }.
// Manifest text is a separate, asynchronous conversion:
const text = await RadixEngineToolkit.Instructions.convert(
  manifest.instructions,
  NetworkId.Mainnet,
  "String"
);
console.log(text.value);</code></pre>
<p><strong>What <code>build()</code> returns is not manifest text.</strong> It is a <code>TransactionManifest</code>, declared as <code>{ instructions: Instructions; blobs: Uint8Array[] }</code>, and <code>Instructions</code> is a two-variant union: <code>{ kind: "Parsed", value: Instruction[] }</code> or <code>{ kind: "String", value: string }</code>. The builder always emits the <code>Parsed</code> variant, and the interface carries no <code>toString()</code> – calling one gets the default <code>[object Object]</code>. Going from the parsed tree to the text described in <a href="/developers/transactions/01-manifest-language" rel="noopener">Transaction Manifest Language</a> is a round trip through the WASM core via <code>RadixEngineToolkit.Instructions.convert()</code>, which returns a <code>Promise</code> and takes a network id, because manifest text carries <a href="/developers/transactions/05-addresses-and-entity-types" rel="noopener">Bech32m addresses</a> whose human-readable part is network-specific. The same module converts the other way, and also exposes <code>compile()</code>, <code>decompile()</code>, <code>extractAddresses()</code> and <code>staticallyValidate()</code> over the same instructions.</p>
<p>The <code>Parsed</code> form is the one to keep hold of: <code>TransactionBuilder</code> takes the <code>TransactionManifest</code> itself, not text. <code>TransactionBuilder.new()</code> is asynchronous – it has to instantiate the WASM host first – and returns a builder whose steps are separate types, so the order is enforced by the compiler: <code>header()</code> yields the manifest step, <code>manifest()</code> the signature step, and <code>sign()</code>/<code>signAsync()</code> accumulate before <code>notarize()</code> resolves to a <code>NotarizedTransaction</code> ready for the Gateway. That is the flow described in <a href="/developers/transactions/02-transaction-lifecycle" rel="noopener">Transaction Lifecycle</a>.</p>`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
    [TAG_PATH, SLUG],
  );
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  const flat = JSON.stringify(blocks);
  if (flat.includes(SENTINEL)) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  const infobox = blocks.find((b) => b.type === 'infobox');
  const infoNested = infobox?.blocks?.find((n) => n.text?.includes(INFOBOX_FIND));
  if (!infoNested) throw new Error('infobox Scope row not found');
  infoNested.text = infoNested.text.replace(INFOBOX_FIND, INFOBOX_REPLACE);

  const codeBlock = blocks.find((b) => b.text?.includes('Building a Manifest in TypeScript'));
  if (!codeBlock) throw new Error('manifest-building block not found');
  if (!codeBlock.text.includes(CODE_FIND)) throw new Error('code sample find-string did not match');
  codeBlock.text = codeBlock.text.replace(CODE_FIND, CODE_REPLACE);

  const version = '1.3.0';
  const before = JSON.stringify(page.content).length;
  const json = JSON.stringify(blocks);
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  ${before} -> ${json.length} B`);

  if (!DRY) {
    const now = new Date().toISOString();
    await client.query('BEGIN');
    await client.query(
      'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, version, now, page.id],
    );
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
        'Corrected the TypeScript example: ManifestBuilder.build() returns a TransactionManifest whose instructions are the Parsed variant, so manifest.toString() prints [object Object]. Manifest text comes from RadixEngineToolkit.Instructions.convert(instructions, networkId, "String"), an async WASM call. Verified against the published @radixdlt/radix-engine-toolkit 1.0.6 tarball (dist/builder/manifest.d.ts, dist/models/transaction/manifest.d.ts, dist/wasm/default.d.ts, dist/radix-engine-toolkit.mjs). Added the wrapper version and licence to the infobox.',
        now,
      ],
    );
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
