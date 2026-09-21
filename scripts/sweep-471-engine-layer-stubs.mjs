import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

// Kernel Layer and Application Layer were both one-paragraph stubs carrying a
// "you can help by expanding it" banner, while the two layers between them -
// System Layer and VM Layer - are full articles. Everything below is read from
// the radixdlt-scrypto checkout at 858c70f (27 March 2026), not from either
// existing page.
//
// The System Layer edit is the same finding: that page states the kernel does
// not change between protocol updates, and Cuttlefish advanced KernelBoot from
// V1 to V2.

const DRY = process.argv.includes('--dry-run');

const SRC = 'https://github.com/radixdlt/radixdlt-scrypto/blob/main';

// ============================== KERNEL LAYER ==============================

const KERNEL_INTRO =
  '<h2>Introduction</h2>'
  + '<p>The kernel is the lowest layer of the <a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix Engine</a>. '
  + 'It owns four things: nodes and the <a href="/contents/tech/core-concepts/substate-model" rel="noopener">substates</a> they hold; '
  + 'the call frames that run against them; the rules deciding which frame may reach which node; and the charge applied to each of '
  + 'those operations. It has no notion of a <a href="/contents/tech/core-concepts/resources" rel="noopener">resource</a>, a '
  + '<a href="/contents/tech/core-concepts/blueprints-and-packages" rel="noopener">blueprint</a>, a badge or a role. Those are '
  + 'defined by the <a href="/contents/tech/core-protocols/system-layer" rel="noopener">system layer</a> above it, and the kernel '
  + 'moves the state that carries them without reading it.</p>';

const KERNEL_OWNS =
  '<h2 id="what-the-kernel-owns">What the Kernel Owns</h2>'
  + '<p>The module list in <code>radix-engine/src/kernel/mod.rs</code> maps one to one onto those responsibilities. '
  + '<code>kernel.rs</code> holds the boot sequence and the execution loop. <code>call_frame.rs</code> defines a frame and the table '
  + 'of references it may use. <code>substate_io.rs</code> and <code>substate_locks.rs</code> carry the read and write path and the '
  + 'locks that serialise it. <code>heap.rs</code> stores state created during a transaction and not yet committed. '
  + '<code>id_allocator.rs</code> hands out node identifiers. The remaining two are the interfaces to the layer above: '
  + '<code>kernel_api.rs</code> for calls downward, and <code>kernel_callback_api.rs</code> for calls back upward.</p>'
  + '<p>That second interface is how the engine charges for anything. <code>KernelCallbackObject</code>, which the source describes '
  + 'as the "upper layer callback object which a kernel interacts with during execution", declares a hook for every kernel operation '
  + 'there is: <code>on_create_node</code>, <code>on_drop_node</code>, <code>on_open_substate</code>, <code>on_read_substate</code>, '
  + '<code>on_write_substate</code>, <code>on_scan_keys</code>, <code>on_allocate_node_id</code> and a dozen more. The system layer '
  + 'implements them, and its costing module runs inside each one. The kernel therefore does not know what a fee is; it announces '
  + 'what it just did, and something above it decides the price.</p>';

const KERNEL_STATE =
  '<h2 id="nodes-substates-and-two-devices">Nodes, Substates and Two Devices</h2>'
  + '<p>A node is an addressed entity and a substate is a unit of state held under one, addressed by partition and key. Every read '
  + 'and write in the engine resolves to a substate on one of exactly two devices, and <code>SubstateDevice</code> in '
  + '<code>substate_io.rs</code> has exactly two variants to say which: <code>Heap</code> and <code>Store</code>. The heap holds '
  + 'nodes created during the transaction now running. The store holds committed ledger state. A new object begins on the heap, '
  + 'and moves to the store when it is globalized.</p>'
  + '<p>The distinction is what makes an uncommitted object cheap. A blueprint that builds a component, fills its fields and then '
  + 'fails has touched the heap only, and nothing it wrote reaches the database. It also sets the boundary the substate locks '
  + 'defend: two frames holding the same substate open at once is a conflict the kernel refuses rather than resolves.</p>';

const KERNEL_VISIBILITY =
  '<h2 id="visibility">What a Call Frame Can Reach</h2>'
  + '<p>A call frame may only touch a node it can see, and <code>Visibility</code> in <code>call_frame.rs</code> enumerates the '
  + 'three ways it can: a <strong>stable reference</strong>, either to a global address or to a directly accessed node; '
  + '<strong>frame-owned</strong>, meaning the frame holds the node outright; and <strong>borrowed</strong>, meaning the frame '
  + 'reached it through something else and the origin is recorded.</p>'
  + '<p>Each invocation opens a new frame, and the caller sends a <code>CallFrameMessage</code> saying which nodes move to the '
  + 'callee, which global references are copied and which direct-access references are copied. The source is explicit that the '
  + 'message is "just an intent, not checked/allowed by kernel yet": the kernel validates it before the callee runs, and that '
  + 'validation is where ownership transfer is enforced. A bucket passed into a component leaves the caller’s frame, so after '
  + 'the move the caller holds no reference to it and cannot spend it twice. No blueprint code performs that check, and none can '
  + 'decline it.</p>'
  + '<p>One interface manages several frame stacks rather than one. <code>KernelStackApi</code> exposes a current stack id, a '
  + 'context switch between stacks, and a way to move objects from the current frame to another stack; its only caller in the '
  + 'engine is <code>multithread_intent_processor.rs</code>, the processor for '
  + '<a href="/contents/tech/core-concepts/subintents-and-pre-authorizations" rel="noopener">subintents</a>. Each intent in a '
  + 'multi-intent transaction runs on its own stack, and yielding between intents is a kernel-level context switch.</p>';

const KERNEL_VERSIONS =
  '<h2 id="kernel-versions">Kernel Versions</h2>'
  + '<p>The kernel carries a version on the ledger, read before execution, in the same way the system layer does. '
  + '<code>KernelBoot</code> lives on the boot-loader partition of the '
  + '<a href="/contents/tech/core-concepts/transaction-tracker" rel="noopener">transaction tracker</a>, and when the substate is '
  + 'absent the engine falls back to <code>V1</code>, which is the state of a ledger that has not left Babylon. '
  + '<a href="/contents/tech/releases/protocol-updates" rel="noopener">Bottlenose</a> wrote the substate for the first time, at V1. '
  + 'Cuttlefish asserts the stored value is V1 and replaces it with V2, and panics rather than continuing if it finds anything '
  + 'else.</p>'
  + '<p>V2 carries one field, and it selects which set of always-visible global nodes each call frame starts with. Those are '
  + 'well-known addresses a blueprint may reference without having declared the dependency when its package was published: 25 of '
  + 'them under V1 and 26 under V2. The address V2 adds is the Locker package, behind the '
  + '<a href="/contents/tech/core-concepts/locker-blueprint" rel="noopener">account locker</a> that Bottlenose introduced – '
  + 'published one update earlier, reachable without a declared dependency one update later. The list is not meant to last: a '
  + 'comment above it calls it "a temporary solution", removable once Scrypto can declare dependencies and bootstrapping is split '
  + 'into state flushing and transaction execution.</p>';

const KERNEL_LINKS =
  '<h2>External Links</h2>\n<ul>\n'
  + `<li><a href="${SRC}/radix-engine/src/kernel" target="_blank" rel="noopener">radix-engine/src/kernel</a> – every module named above</li>\n`
  + `<li><a href="${SRC}/radix-engine/src/kernel/kernel_api.rs" target="_blank" rel="noopener">kernel_api.rs</a> – the node, substate, invoke and stack interfaces</li>\n`
  + `<li><a href="${SRC}/radix-engine/src/kernel/kernel_callback_api.rs" target="_blank" rel="noopener">kernel_callback_api.rs</a> – the per-operation hooks the system layer implements</li>\n`
  + `<li><a href="${SRC}/radix-engine/src/kernel/kernel.rs" target="_blank" rel="noopener">kernel.rs</a> – KernelBoot and its fallback to V1</li>\n`
  + `<li><a href="${SRC}/radix-common/src/constants/always_visible_nodes.rs" target="_blank" rel="noopener">always_visible_nodes.rs</a> – both node sets, and the comment on removing them</li>\n`
  + '<li><a href="/contents/tech/core-concepts/substate-model" rel="noopener">Substate model</a></li>\n'
  + '</ul>';

const KERNEL_EXCERPT = 'The lowest layer of the Radix Engine: nodes, substates, call frames and visibility, with no notion of a resource or a role.';

// =========================== APPLICATION LAYER ===========================

const APP_INTRO =
  '<h2>Introduction</h2>'
  + '<p>The application layer is the topmost layer of the <a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix '
  + 'Engine</a> stack, and the only one whose code is uploaded rather than shipped with the node. Everything below it – the '
  + '<a href="/contents/tech/core-protocols/kernel-layer" rel="noopener">kernel</a>, the '
  + '<a href="/contents/tech/core-protocols/system-layer" rel="noopener">system layer</a> and the two virtual machines of the '
  + '<a href="/contents/tech/core-protocols/vm-layer" rel="noopener">VM layer</a> – changes only when validator operators install '
  + 'a new version of the node software. This layer changes when somebody publishes a package, which needs no permission from '
  + 'anyone.</p>';

const APP_CONTAINS =
  '<h2 id="what-runs-here">What Runs Here</h2>'
  + '<p>Three things, in a fixed relationship. A <strong>blueprint</strong> defines state, functions and access rules. A '
  + '<strong>package</strong> is a deployed bundle of blueprints with its own ledger address. A '
  + '<a href="/contents/tech/core-concepts/components" rel="noopener"><strong>component</strong></a> is a running instance of a '
  + 'blueprint, with its own state and its own address. Developers write all three in '
  + '<a href="/contents/tech/core-protocols/scrypto-programming-language" rel="noopener">Scrypto</a>, Radix’s Rust SDK, and '
  + 'publish the compiled WebAssembly; <a href="/contents/tech/core-concepts/blueprints-and-packages" rel="noopener">Blueprints '
  + '&amp; Packages</a> covers what a package holds and what it costs to call one.</p>'
  + '<p>The layer is not exclusively developer code. The engine’s own blueprints – Account, Identity, ConsensusManager, '
  + 'AccessController, the pools, the resource package – present the same interface and are called the same way, but run as '
  + 'compiled Rust in the Native VM rather than as WebAssembly. A Scrypto component holding a vault or calling a pool does not know '
  + 'which side of that boundary it is on, and cannot find out through any interface the engine offers it.</p>';

const APP_ENTRY =
  '<h2 id="how-a-transaction-arrives">How a Transaction Arrives</h2>'
  + '<p>Application code is never the first thing to run. A transaction reaches the network as a '
  + '<a href="/contents/tech/core-protocols/transaction-manifests" rel="noopener">manifest</a>, a list of instructions, and the '
  + '<a href="/contents/tech/core-concepts/transaction-processor" rel="noopener">transaction processor</a> – itself a native '
  + 'blueprint – executes them in order. The processor owns the two structures the manifest manipulates: the '
  + '<a href="/contents/tech/core-concepts/worktop" rel="noopener">worktop</a>, where resources sit between instructions, and the '
  + 'auth zone, which holds the proofs a called method is checked against.</p>'
  + '<p>By the time a component method body runs, the signatures have been verified, the fee has been locked, the proofs are in the '
  + 'auth zone and the <a href="/contents/tech/core-concepts/access-rules-and-auth-zones" rel="noopener">access rule</a> on that '
  + 'method has already passed. Application code sees none of it. It cannot read a signature, an epoch, a validator set or another '
  + 'component’s fields, because no host function exposes any of them.</p>';

const APP_GUARANTEES =
  '<h2 id="what-the-layer-inherits">What the Layer Inherits</h2>'
  + '<p>Three properties arrive from below rather than from the blueprint, which is what makes application code on Radix shorter '
  + 'than its equivalent elsewhere. <a href="/contents/tech/core-concepts/resources" rel="noopener">Resources</a> are engine '
  + 'primitives, so a token cannot be duplicated or dropped by a blueprint that forgets to update a balance; a bucket that goes '
  + 'nowhere fails the transaction rather than burning its contents. Access rules are enforced by the system layer before the '
  + 'method body is entered, so an authorisation check the author did not write is still applied. And '
  + '<a href="/contents/tech/core-concepts/atomic-composability" rel="noopener">composability</a> is atomic by construction: a call '
  + 'into another component either completes or reverts the whole transaction, with no partially applied state to unwind.</p>'
  + '<p>The trade is that the layer is narrow on purpose. Determinism is the requirement every node re-executing a transaction has '
  + 'to meet, so there is no clock, no network, no filesystem and no unseeded randomness at this layer – see the '
  + '<a href="/contents/tech/core-protocols/vm-layer" rel="noopener">VM layer</a> for the host-function list that bounds it.</p>';

const APP_LINKS =
  '<h2>External Links</h2>\n<ul>\n'
  + '<li><a href="https://github.com/radixdlt/radixdlt-scrypto" target="_blank" rel="noopener">radixdlt-scrypto</a> – engine and SDK in one repository</li>\n'
  + '<li><a href="https://docs.radixdlt.com/docs/engine-tech-docs" target="_blank" rel="noopener">Radix Engine architecture (Radix Docs)</a></li>\n'
  + '<li><a href="https://docs.radixdlt.com/docs/blueprints-and-components" target="_blank" rel="noopener">Blueprints and components (Radix Docs)</a></li>\n'
  + '<li><a href="/contents/tech/core-protocols/vm-layer" rel="noopener">VM layer</a> – how the code on this layer is executed</li>\n'
  + '<li><a href="/contents/tech/core-protocols/system-layer" rel="noopener">System layer</a> – the abstractions it is written against</li>\n'
  + '</ul>';

const APP_EXCERPT = 'The topmost layer of the Radix Engine, and the only one whose code is uploaded rather than shipped with the node.';

// ============================= SYSTEM LAYER FIX =============================

// The claim sits either side of a link, so the match has to carry the markup.
const PU_LINK = '<a href="/contents/tech/releases/protocol-updates" rel="noopener">protocol updates</a>';
const SYS_OLD = `The kernel below this layer does not change between ${PU_LINK};`;
const SYS_NEW = `The kernel below this layer carries a version of its own and changes far less often across ${PU_LINK}: `
  + '<code>KernelBoot</code> has advanced once, from V1 to V2 at Cuttlefish, and that bump only widened the set of always-visible '
  + 'global nodes (see <a href="/contents/tech/core-protocols/kernel-layer#kernel-versions" rel="noopener">Kernel Layer</a>);';

const PAGES = [
  {
    tagPath: 'contents/tech/core-protocols', slug: 'kernel-layer', version: '2.0.0', change: 'major',
    excerpt: KERNEL_EXCERPT, dropStubBanner: true,
    sentinel: 'what-the-kernel-owns',
    replaceIntro: KERNEL_INTRO,
    sections: [KERNEL_OWNS, KERNEL_STATE, KERNEL_VISIBILITY, KERNEL_VERSIONS],
    replaceLinks: KERNEL_LINKS,
    message: 'Expanded from a one-paragraph stub, read from radixdlt-scrypto at 858c70f. Four new sections: what each kernel module owns and how KernelCallbackObject makes costing possible without the kernel knowing what a fee is; nodes and substates across the two SubstateDevice variants, Heap and Store; the three Visibility cases and the CallFrameMessage the kernel validates, which is where ownership transfer is enforced; and kernel versioning. That last one is new to the wiki: KernelBoot sits on the transaction tracker boot-loader partition, falls back to V1 when absent, was written at V1 by Bottlenose and advanced to V2 by Cuttlefish, and V2 widens the always-visible global node set from 25 to 26 by adding the Locker package. Stub banner removed and metadata.excerpt set.',
  },
  {
    tagPath: 'contents/tech/core-protocols', slug: 'application-layer', version: '2.0.0', change: 'major',
    excerpt: APP_EXCERPT, dropStubBanner: true,
    sentinel: 'what-runs-here',
    replaceIntro: APP_INTRO,
    sections: [APP_CONTAINS, APP_ENTRY, APP_GUARANTEES],
    replaceLinks: APP_LINKS,
    message: 'Expanded from a one-paragraph stub. Three new sections: what the layer contains and why a native blueprint is indistinguishable from a WASM one at this level; how a transaction reaches application code by way of the manifest, the transaction processor, the worktop and the auth zone, with the signature check, fee lock and access rule all resolved before a method body runs; and the three properties the layer inherits rather than implements. Organised around the one property that separates it from the layers below - it is the only layer whose code is uploaded rather than shipped with the node. Execution detail is left to the VM layer page rather than repeated. Stub banner removed and metadata.excerpt set.',
  },
];

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

async function writePage(page, blocks, version, change, message, metadata) {
  const now = new Date().toISOString();
  const json = JSON.stringify(blocks);
  await client.query('BEGIN');
  await client.query('UPDATE pages SET content=$1, version=$2, metadata=$3, updated_at=$4, last_verified_at=$4 WHERE id=$5',
    [json, version, JSON.stringify(metadata), now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, version, change, AUTHOR_ID, message, now]);
  await client.query('COMMIT');
}

const words = html => html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').split(/\s+/).filter(Boolean).length;

try {
  for (const p of PAGES) {
    if (isLockedPage(p.tagPath, p.slug)) throw new Error(`${p.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content, metadata FROM pages WHERE tag_path = $1 AND slug = $2', [p.tagPath, p.slug]);
    if (!rows.length) throw new Error(`page not found: ${p.slug}`);
    const page = rows[0];

    const blocks = JSON.parse(JSON.stringify(page.content));
    if (JSON.stringify(blocks).includes(p.sentinel)) {
      console.log(`  ${p.slug}: already applied - no write`);
      continue;
    }

    const introIdx = blocks.findIndex(b => b.text?.includes('<h2>Introduction</h2>'));
    if (introIdx === -1) throw new Error(`${p.slug}: Introduction block not found`);
    blocks[introIdx].text = p.replaceIntro;

    const linksIdx = blocks.findIndex(b => b.text?.includes('<h2>External Links</h2>'));
    if (linksIdx === -1) throw new Error(`${p.slug}: External Links block not found`);
    blocks[linksIdx].text = p.replaceLinks;

    // New sections go between the introduction and External Links.
    blocks.splice(linksIdx, 0, ...p.sections.map(text => ({ id: uid(), type: 'content', text })));

    if (p.dropStubBanner) {
      const before = blocks.length;
      const kept = blocks.filter(b => !(b.type === 'banner' && /stub/i.test(JSON.stringify(b))));
      if (kept.length === before) throw new Error(`${p.slug}: stub banner not matched`);
      blocks.length = 0;
      blocks.push(...kept);
    }

    const metadata = { ...(page.metadata || {}), excerpt: p.excerpt };
    const wordCount = blocks.filter(b => typeof b.text === 'string').reduce((n, b) => n + words(b.text), 0);
    console.log(`  ${DRY ? '[dry] ' : ''}/${p.tagPath}/${p.slug}  v${page.version} -> v${p.version}   blocks ${page.content.length} -> ${blocks.length}   ~${wordCount} words`);
    console.log(`          excerpt ${p.excerpt.length} chars`);
    if (!DRY) await writePage(page, blocks, p.version, p.change, p.message, metadata);
  }

  // The System Layer page states the kernel is unchanged across protocol updates.
  {
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
      ['contents/tech/core-protocols', 'system-layer']);
    if (!rows.length) throw new Error('system-layer not found');
    const page = rows[0];
    const blocks = JSON.parse(JSON.stringify(page.content));
    const hit = blocks.find(b => typeof b.text === 'string' && b.text.includes(SYS_OLD));
    if (!hit) {
      if (JSON.stringify(blocks).includes('KernelBoot')) console.log('  system-layer: already corrected - no write');
      else throw new Error('system-layer: the claim to correct was not matched');
    } else {
      hit.text = hit.text.replace(SYS_OLD, SYS_NEW);
      const [maj, min] = String(page.version).split('.').map(Number);
      const version = `${maj}.${min + 1}.0`;
      console.log(`  ${DRY ? '[dry] ' : ''}/contents/tech/core-protocols/system-layer  v${page.version} -> v${version}`);
      if (!DRY) await writePage(page, blocks, version, 'minor',
        'Corrected the claim that the kernel does not change between protocol updates. KernelBoot is a versioned substate on the transaction tracker boot-loader partition: Bottlenose wrote it at V1 and Cuttlefish advanced it to V2, widening the always-visible global node set from 25 addresses to 26. The system layer still changes far more often, which is the point the sentence was making, so the contrast is kept and the absolute is dropped.',
        (await client.query('SELECT metadata FROM pages WHERE id=$1', [page.id])).rows[0].metadata || {});
    }
  }
} finally {
  client.release();
  await pool.end();
}
