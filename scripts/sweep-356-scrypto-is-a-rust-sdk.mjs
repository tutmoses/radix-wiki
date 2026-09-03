import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'contents/tech/core-protocols';
const SLUG = 'scrypto-programming-language';
const SENTINEL = 'language-or-sdk';
const TITLE = 'Scrypto';

const INFOBOX = `<table><tr><td><strong>Type</strong></td><td>Rust SDK and build toolchain</td></tr><tr><td><strong>Written In</strong></td><td>Rust</td></tr><tr><td><strong>Distributed As</strong></td><td>the <a href="https://crates.io/crates/scrypto" target="_blank" rel="noopener">scrypto</a> crate</td></tr><tr><td><strong>Compiles To</strong></td><td><a href="https://webassembly.org" target="_blank" rel="noopener" title="WebAssembly">WASM</a>, by <code>cargo build --target wasm32-unknown-unknown</code></td></tr><tr><td><strong>Runs On</strong></td><td><a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix Engine</a></td></tr><tr><td><strong>Latest</strong></td><td>Scrypto 1.3.1 (Rust 1.92.0+ support)</td></tr></table>`;

const OVERVIEW = `<h2>Overview</h2>
<p><strong>Scrypto</strong> is the Rust toolkit for writing Radix smart contracts. A blueprint is an ordinary Rust crate that depends on the <a href="https://crates.io/crates/scrypto" target="_blank" rel="noopener">scrypto</a> crate, published on crates.io as <q>The Scrypto standard library</q>. The <code>scrypto build</code> command hands that crate to <code>cargo build --target wasm32-unknown-unknown</code>, and the <a href="https://webassembly.org" target="_blank" rel="noopener" title="WebAssembly">WebAssembly</a> module which comes out is what gets deployed to the ledger as a package. Radix's own documentation describes the central <code>#[blueprint]</code> macro as a way to define a blueprint <a href="https://docs.radixdlt.com/docs/scrypto" target="_blank" rel="noopener"><q>using items defined in Rust grammar</q></a>. The grammar is Rust's, and so is the compiler.</p>
<p>What the toolkit adds is a vocabulary for assets. Tokens and <a href="https://en.wikipedia.org/wiki/Non-fungible_token" target="_blank" rel="noopener" title="Non-Fungible Tokens">NFTs</a> are resources the developer moves between <a href="/contents/tech/core-concepts/buckets-proofs-and-vaults" rel="noopener">buckets and vaults</a> rather than balances written into a mapping, the approach this wiki covers under <a href="/contents/tech/core-concepts/asset-oriented-programming" rel="noopener">asset-oriented programming</a>.</p>
<h3>Key Differences from <a href="https://soliditylang.org" target="_blank" rel="noopener" title="Solidity Programming Language">Solidity</a></h3>
<ul>
  <li><strong>No reentrancy</strong> – Scrypto's execution model makes reentrancy structurally impossible. Assets are in call-frame-local <a href="/contents/tech/core-concepts/buckets-proofs-and-vaults">buckets</a> that can't be accessed from nested calls.</li>
  <li><strong>No approval pattern</strong> – Assets move directly via <a href="https://docs.radixdlt.com/docs/resources" target="_blank" rel="noopener" title="Resources, Vaults &amp; Buckets">buckets</a>. No <code>approve()</code> + <code>transferFrom()</code>.</li>
  <li><strong>Authorization via <a href="https://docs.radixdlt.com/docs/auth" target="_blank" rel="noopener" title="Badge-based Authorization">badges</a></strong> – Instead of <code>msg.sender</code> checks, Scrypto uses <a href="/contents/tech/core-concepts/access-rules-and-auth-zones">badge-based authorization</a>. Present a proof of holding a badge to access protected methods.</li>
  <li><strong><a href="https://docs.radixdlt.com/docs/blueprints-and-components" target="_blank" rel="noopener" title="Blueprints &amp; Components">Blueprints</a> → Components</strong> – Scrypto code is organized into <a href="/contents/tech/core-concepts/blueprints-and-packages">blueprints</a> (like classes) that are instantiated into components (like objects) on-ledger.</li>
</ul>
<h3>Modern Rust Support</h3>
<p>Scrypto 1.3.1 unlocked modern Rust (1.92.0+) support with a new <a href="https://webassembly.org" target="_blank" rel="noopener" title="WebAssembly">WASM</a> build pipeline, ending the previous Rust 1.81.0 lockdown.</p>`;

const LANGUAGE = `<h2 id="${SENTINEL}">Language or SDK</h2>
<p>Radix's materials call Scrypto a language. The <a href="https://github.com/radixdlt/radixdlt-scrypto" target="_blank" rel="noopener">radixdlt-scrypto</a> README opens on <q>the Scrypto language</q>, <q>the language for building DeFi apps on Radix</q>; the address of this page says the same; and most of the ecosystem writes it that way.</p>
<p>The mechanism is narrower. Rust's compiler compiles the code, Cargo builds it, and the ledger stores a WebAssembly module. Scrypto is the crate, the procedural macros and the CLI that make such a module easy to produce from Rust. Asked on 2 September 2026 whether the authoring layer for the <a href="/contents/tech/research/hyperscale-rs" rel="noopener">hyperscale-rs</a> virtual machine amounts to a new language, its lead developer declined the word for both projects at once: <a href="https://t.me/hyperscale_rs/11575" target="_blank" rel="noopener"><q>let's not call it a language. it's a rust sdk. Scrypto is also not a language</q></a>.</p>
<p>Other toolchains can reach the same interface. 0xOmarA, the leading contributor to the <a href="https://github.com/radixdlt/radix-engine-toolkit" target="_blank" rel="noopener">Radix Engine Toolkit</a> and one of the main authors of radixdlt-scrypto, replied in the same thread that <a href="https://t.me/hyperscale_rs/11584" target="_blank" rel="noopener"><q>you can write it in C or AssemblyScript today</q></a>, with the caveat that working in any language without an SDK is always going to be hard. What the SDK carries is the macro layer, which generates the metadata and the interface the <a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix Engine</a> expects, and writing that by hand is the work nobody wants.</p>
<p>The distinction changes how a portability claim should be read. A contract written in Scrypto is tied to a Rust library and a WASM target rather than to a syntax, so moving it to another authoring layer is an SDK migration. That is the shape the <a href="#scrypto-and-xian">Xi'an transition</a> is taking.</p>`;

const XIAN = `<h2 id="scrypto-and-xian">Scrypto and Xi'an</h2>
<p>Scrypto compiles to WebAssembly and runs on the <a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix Engine</a>, which is the execution environment of <a href="/contents/tech/releases/radix-mainnet-babylon" rel="noopener">Babylon</a> mainnet. The sharded successor network, <a href="/contents/tech/releases/radix-mainnet-xian" rel="noopener">Xi'an</a>, is not expected to use the Radix Engine: on 1 August 2026 the lead developer of the <a href="/contents/tech/research/hyperscale-rs" rel="noopener">production candidate</a> confirmed a purpose-built VM is <a href="https://t.me/hyperscale_rs/10334" target="_blank" rel="noopener">underway</a>, and that the options which would have left existing dApps untouched <a href="https://t.me/hyperscale_rs/10340" target="_blank" rel="noopener"><q>have dissolved</q></a>.</p>
<p>The replacement authoring layer became legible in the first days of September 2026, and it belongs to the same family: <a href="https://t.me/hyperscale_rs/11430" target="_blank" rel="noopener"><q>They're both just rust sdks, with vaults, resources, proofs, etc.</q></a> The <a href="https://github.com/hyperscalers/hyperscale-vm/blob/main/guests/amm/src/lib.rs" target="_blank" rel="noopener">constant-product pool</a> in the hyperscale-vm repository is a <code>#[blueprint]</code> macro over a Rust module holding vaults, buckets and a minted share resource, which a Scrypto developer can read on sight. The visible difference is that a component's data splits in two, mutable state on one side and a creation-fixed <code>#[config]</code> on the other, so the transaction graph can be computed from cached values at admission across shards. The VM itself is bound to no language at all: it takes <a href="https://t.me/hyperscale_rs/11579" target="_blank" rel="noopener">WASM Component Model guests</a>, with the Rust SDK as the intended path.</p>
<p>Three migration costs are on the record. Compiled packages do not carry over, so every contract needs rebuilding from source. Two capabilities go with sharding: locking a fee from a component during execution, and branching cross-component calls on mutable state. For the rest, the developer expects a transition to be <a href="https://t.me/hyperscale_rs/11573" target="_blank" rel="noopener">trivial for 99% of builders</a> even if the process cannot be entirely shimmed or run through a transpiler, and says the authoring ergonomics are still in flux, with an <q>everything you need to know</q> guide a month or two out. That is a forecast about work not yet done. None of it affects Scrypto on Babylon, which is unchanged.</p>`;

const REVISION_MESSAGE = [
  'Reframe Scrypto as a Rust SDK rather than a language, and retitle the page accordingly.',
  'A blueprint is a Rust crate depending on the scrypto crate; scrypto build shells out to cargo build --target wasm32-unknown-unknown (scrypto-compiler), and the Radix docs describe #[blueprint] as defining a blueprint "using items defined in Rust grammar".',
  'The new Language or SDK section sets the vendor framing (radixdlt-scrypto README) against flightofthefox on 2 September 2026 (t.me/hyperscale_rs/11575, "Scrypto is also not a language. it\'s a rust sdk") and 0xOmarA on C and AssemblyScript (11584).',
  'The successor-network section is rewritten: the old "drew no direct reply" note is superseded by the hyperscale-vm Rust SDK (11430, 11573, 11579) and its published AMM example, with the three migration costs now on the record.',
].join(' ');

for (const [name, s] of Object.entries({ INFOBOX, OVERVIEW, LANGUAGE, XIAN, REVISION_MESSAGE })) {
  if (/[\u00A0\u2014]/.test(s)) throw new Error(`${name} contains a non-breaking space or em dash`);
}

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (blocks.some((b) => b.text?.includes(SENTINEL))) {
    console.log('  already applied - no write');
    process.exit(0);
  }

  const infobox = blocks.find((b) => b.type === 'infobox');
  if (!infobox?.blocks?.length) throw new Error('infobox block not found');
  infobox.blocks[0].text = INFOBOX;

  const overview = blocks.findIndex((b) => b.text?.includes('<h2>Overview</h2>'));
  if (overview < 0) throw new Error('Overview block not found');
  blocks[overview].text = OVERVIEW;

  const xian = blocks.findIndex((b) => /<h2>Scrypto and Xi(&#39;|')an<\/h2>/.test(b.text || ''));
  if (xian < 0) throw new Error('successor-network block not found');
  blocks[xian].text = XIAN;

  const links = blocks.findIndex((b) => b.text?.includes('<h2>External Links</h2>'));
  if (links < 0) throw new Error('External Links block not found');
  const githubRow = '<li><a href="https://github.com/radixdlt/radixdlt-scrypto" target="_blank" rel="noopener">GitHub Repository</a></li>';
  if (!blocks[links].text.includes(githubRow)) throw new Error('External Links: GitHub row not matched');
  blocks[links].text = blocks[links].text.replace(githubRow,
    `${githubRow}\n  <li><a href="https://crates.io/crates/scrypto" target="_blank" rel="noopener">The scrypto crate on crates.io</a></li>`);

  blocks.splice(overview + 1, 0, { id: uid(), type: 'content', text: LANGUAGE });

  const version = '2.0.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title} -> ${TITLE}  v${page.version} -> v${version}  blocks ${page.content.length} -> ${blocks.length}`);
  if (DRY) {
    for (const b of blocks) {
      const t = b.type === 'infobox' ? b.blocks[0].text : b.text;
      console.log('   ', b.type.padEnd(8), t.slice(0, 110).replace(/\n/g, ' '));
    }
  } else {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET title=$1, content=$2, version=$3, updated_at=$4, last_verified_at=$4 WHERE id=$5',
      [TITLE, json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, TITLE, version, 'major', AUTHOR_ID, REVISION_MESSAGE, now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
