// sweep 429 — developers rotation. Six corrections, each checked against source on 14 September 2026.
//
// 1. /developers/transactions/02-transaction-lifecycle (head of the staleness queue, verified 26 July)
//    taught subintent syntax that does not exist: DEFINE_CHILD and SubintentHash(...) appear nowhere in
//    radixdlt-scrypto v1.4.0. The parser's pseudo-instruction is USE_CHILD NamedIntent(..) Intent("subtxid_..")
//    (radix-transactions/src/manifest/parser.rs:181, e2e.rs:1679) and YIELD_TO_CHILD takes the NamedIntent.
//    "Temporarily rejected (e.g., pending dependency)" has no counterpart in babylon-node v1.4.0.0
//    pending_transaction_result_cache.rs, whose temporary cases are a window not yet open, a fee loan not
//    repaid, a bootloading error and the user-transaction moratorium. "Epoch ± 2" replaced by the validator's
//    rule: end > start, at most 8,640 epochs (TransactionValidationConfig::babylon, inherited by cuttlefish).
//    Header now names the V2 split (intent_header_v2.rs, transaction_header_v2.rs).
// 2. /developers/infrastructure/01-running-a-node said registering a validator "costs 5-30 XRD in fees".
//    CREATE_VALIDATOR takes validator_creation_usd_cost (100, set by Anemone for every network but 241,
//    anemone.rs:67) times USD_PRICE_IN_XRD ("16.666666666666666666", radix-common constants) = 1,666.67 XRD.
//    Adds a Stokenet section from Daffy's handout v1.2 (t.me/RadixDevelopers/66450, 13 Sept): genesis.bin
//    fetched 14 Sept, 669 B, sha256 0006347310c9...; Docker Hub index digest for v1.4.0.0 read 46a50a6c...;
//    both match the handout.
// 3. /contents/tech/releases/stokenet expected an official image to end the patched-jar overlay. It shipped:
//    Network.java STOKENET pins genesis hash 2825a4f1... at v1.3.0.5 and 2536c14c... at v1.4.0.0-RC1 and
//    v1.4.0.0, and the base64 payload at v1.4.0.0 decodes byte-for-byte to genesis.bin.
// 4. /developers/infrastructure/02-radix-apis gave 21:19:06 as mainnet's last committed round; that is the
//    Gateway's last ingested state (557,840,622). The ledger's last round was 21:19:48.939 (557,840,627).
// 5. /developers/scrypto/05-testing-scrypto: the 1.92.0 toolchain pin is unchanged in radix-clis 1.4.0.
// 6. /developers/scrypto/01-fundamentals said Babylon scales "shard-aware via Cerberus"; Babylon runs one
//    shard group (the wiki's own Babylon infobox), sharded execution is Xi'an's.
//
// Run:  node scripts/sweep-429-developers-source-checks.mjs [--dry-run]

import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const A = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const L = (href, text) => `<a href="${href}" rel="noopener">${text}</a>`;
const SCRYPTO = 'https://github.com/radixdlt/radixdlt-scrypto/blob/v1.4.0';
const NODE = 'https://github.com/radixdlt/babylon-node/blob/v1.4.0.0';
const HANDOUT = 'https://stokenet.ams3.digitaloceanspaces.com/instructions/stokenet-new-validator-instructions.md';

function rep(blocks, id, find, replace) {
  const b = blocks.find((x) => x.id === id);
  if (!b) throw new Error(`block ${id} not found`);
  const n = b.text.split(find).length - 1;
  if (n !== 1) throw new Error(`block ${id}: expected 1 match, found ${n}: ${find.slice(0, 80)}`);
  b.text = b.text.replace(find, () => replace);
}

const LIFECYCLE_KEY_INSTRUCTIONS = [
  `<h3>Key Instructions</h3>`,
  `<p>A parent names each child subintent with <code>USE_CHILD</code>, which has to come before every other instruction in the manifest, and refers to it by that name afterwards. The syntax below follows the ${A(`${SCRYPTO}/radix-transactions/src/manifest/e2e.rs`, 'manifest compiler’s own tests')}. A child can also run <code>VERIFY_PARENT</code> with an access rule, so that only a chosen counterparty can use it. Nesting stops at ${A(`${SCRYPTO}/radix-transactions/src/validation/transaction_validation_configuration.rs`, 'three levels of subintent')} below the transaction intent.</p>`,
  `<pre><code class="language-rust"># Parent: declare the child by its subintent hash
USE_CHILD
    NamedIntent("my_child")
    Intent("subtxid_rdx1...");

# Parent: hand control to the child, passing everything on the worktop
YIELD_TO_CHILD
    NamedIntent("my_child")
    Expression("ENTIRE_WORKTOP");

# Child: hand control back to the parent
YIELD_TO_PARENT
    Expression("ENTIRE_WORKTOP");</code></pre>`,
].join('');

const NODE_STOKENET = [
  `<h2 id="sweep429-stokenet-node">Running a Node on Stokenet</h2>`,
  `<p>${L('/contents/tech/releases/stokenet', 'Stokenet')}, the public test network, was reset on 29 August 2026 onto a new genesis that kept network ID 2. A node derives the genesis for its network ID from its own binary, so until Eagle Ray a stock image joined the old, frozen chain and operators had to patch it. From ${A('https://github.com/radixdlt/babylon-node/releases/tag/v1.4.0.0', 'babylon-node v1.4.0.0')} the release compiles in the new chain’s genesis (${A(`${NODE}/common/src/main/java/com/radixdlt/networks/Network.java`, 'Network.java')}), and the stock image joins it with no patch.</p>`,
  `<p>The Stokenet operator, Daffy, keeps ${A(HANDOUT, 'a handout for community node operators')}; version 1.2, dated 13 September 2026, was ${A('https://t.me/RadixDevelopers/66450', 'posted in Radix Developer Discussion')} after a validator operator asked whether they could run a Stokenet node. It says the official node documentation still applies apart from three things:</p>`,
  `<ul>`,
  `<li><strong>The image.</strong> Run <code>radixdlt/babylon-node:v1.4.0.0</code> or later. The tag has four version components, so <code>v1.4.0</code> does not pull.</li>`,
  `<li><strong>The genesis file.</strong> Download <code>genesis.bin</code> and point <code>RADIXDLT_GENESIS_DATA_FILE</code> at it through a volume mount. Check its SHA-256 before starting: <code>0006347310c9d155fe4d625f1317e86e43bd3a550d2be2b656a2968163f95108</code>. The frozen chain’s genesis is also 669 bytes, so the size tells you nothing. The node compares the file with the genesis compiled into the release and the one stored in its database, and refuses to start with <code>Inconsistent genesis configuration</code> if they differ.</li>`,
  `<li><strong>Test XRD.</strong> The reset destroyed every balance and the faucet does not give enough to cover the ${L('#sweep429-validator-fee', 'validator creation fee')}, so the handout sends operators to a named contact on Telegram with an account address and a stake figure.</li>`,
  `</ul>`,
  `<p>Anyone who ran a Stokenet node before 29 August has to wipe the ledger database, because an existing database belongs to the old chain. A validator created after genesis names itself with <code>RADIXDLT_CONSENSUS_VALIDATOR_ADDRESS</code>; the genesis-based validator flag finds nothing for it. The handout also warns that the container prints its whole environment at startup, keystore password included, so filter <code>docker logs</code> before sharing any of it.</p>`,
  `<p>On mainnet the Eagle Ray fork enacted unconditionally. On Stokenet it follows the usual readiness vote, and the handout gives the threshold as validators holding 80% of stake signalling for 10 consecutive epochs, so a newly registered validator should check its node’s pending protocol updates and signal if Eagle Ray is still listed. The reset, the patched image that preceded this release and the seed nodes are recorded on the ${L('/contents/tech/releases/stokenet', 'Stokenet')} page.</p>`,
].join('\n');

const STOKENET_IMAGE = [
  `<h4 id="sweep429-stock-image">The official image shipped, 10 September 2026</h4>`,
  `<p>Eagle Ray was that image. In ${A(`${NODE}/common/src/main/java/com/radixdlt/networks/Network.java`, 'Network.java')}, the Stokenet entry pins genesis hash <code>2825a4f1&hellip;</code> at v1.3.0.5 and <code>2536c14c&hellip;</code> at both ${A('https://github.com/radixdlt/babylon-node/releases/tag/v1.4.0.0-RC1', 'v1.4.0.0-RC1')} (8 September) and ${A('https://github.com/radixdlt/babylon-node/releases/tag/v1.4.0.0', 'v1.4.0.0')} (10 September). <code>2536c14c&hellip;</code> is the hash a node on the reset chain logs at startup, and the genesis payload embedded at v1.4.0.0, decoded on 14 September, is byte-for-byte the published <code>genesis.bin</code>. A stock node from 1.4.0.0 onward derives the reset chain for network ID 2; a node on an older image still derives the frozen one.</p>`,
  `<p>The handout followed three days later. ${A(HANDOUT, 'Version 1.2')}, dated 13 September and ${A('https://t.me/RadixDevelopers/66450', 'linked in Radix Developer Discussion')} that evening, drops the jar, the Dockerfile and the build step, and tells anyone already running the patched image to change the <code>image:</code> line to <code>radixdlt/babylon-node:v1.4.0.0</code> and keep everything else. The genesis file stays, because the node checks it against the compiled genesis and the database, and so do the rotated seed keys and the database wipe. Version 1.2 adds a readiness step for Eagle Ray, which on Stokenet enacts through the usual vote rather than unconditionally as on mainnet. The steps for an operator are on ${L('/developers/infrastructure/01-running-a-node#sweep429-stokenet-node', 'Running a Radix Node')}.</p>`,
].join('\n');

const EDITS = [
  {
    tagPath: 'developers/transactions', slug: '02-transaction-lifecycle', version: '1.4.0', changeType: 'minor',
    sentinel: 'USE_CHILD',
    message: 'Subintent syntax corrected against radixdlt-scrypto v1.4.0: DEFINE_CHILD and SubintentHash do not exist; a parent declares USE_CHILD NamedIntent(..) Intent("subtxid_..") and yields with YIELD_TO_CHILD NamedIntent(..). Rejection outcomes rewritten from babylon-node v1.4.0.0 pending_transaction_result_cache.rs (no "pending dependency" case exists). Epoch window stated as the validator enforces it (end after start, at most 8,640 epochs), and the header split into its V2 intent and transaction headers.',
    apply(blocks) {
      rep(blocks, '61ce77a0-7c20-481c-8d14-3a1b5eec16e8',
        `<p>The <strong>header</strong> specifies the validity window (epoch range, ~5 min per epoch), the notary's public key, and a nonce. The <strong>manifest</strong> contains the instructions.</p>`,
        `<p>The <strong>header</strong> sets when the transaction is valid and who notarises it. Since the Cuttlefish update transactions are V2, and the header is in two parts. The ${A(`${SCRYPTO}/radix-transactions/src/model/v2/intent_header_v2.rs`, 'intent header')} holds the network ID, a validity window of epochs (an epoch lasts about five minutes), an optional window of proposer timestamps, and an <code>intent_discriminator</code> that makes otherwise identical intents distinct; every subintent carries one of its own. The ${A(`${SCRYPTO}/radix-transactions/src/model/v2/transaction_header_v2.rs`, 'transaction header')} holds the notary’s public key, whether the notary also counts as a signer, and the tip in basis points. The older ${A(`${SCRYPTO}/radix-transactions/src/model/v1/header.rs`, 'V1 header')} keeps all of this in one struct, with a <code>nonce</code> and a tip percentage in place of the discriminator and basis points. The <strong>manifest</strong> contains the instructions.</p>`);
      rep(blocks, '7d0145fd-bcfa-4dfd-8262-acff83f34027',
        `The epoch window determines how long the transaction remains valid – typically the current epoch ± 2.`,
        `The epoch window determines how long the transaction remains valid. The end epoch has to be later than the start, and the ${A(`${SCRYPTO}/radix-transactions/src/validation/transaction_validation_configuration.rs`, 'validator rejects a window')} longer than 8,640 epochs, about 30 days.`);
      rep(blocks, '7d0145fd-bcfa-4dfd-8262-acff83f34027',
        `<ul><li><strong>Committed</strong> – accepted on ledger (success or application-level failure)</li><li><strong>Permanently rejected</strong> – invalid structure or expired epoch</li><li><strong>Temporarily rejected</strong> – may become valid later (e.g., pending dependency)</li></ul>`,
        `<ul><li><strong>Committed</strong> – on ledger, as a success or a failure. A committed failure still pays its fee.</li><li><strong>Permanently rejected</strong> – never committed, and retrying cannot change that: the payload is too large, badly encoded or wrongly signed, its epoch or timestamp window has closed, or its intent has already been committed or cancelled.</li><li><strong>Temporarily rejected</strong> – the node ${A(`${NODE}/core-rust/state-manager/src/mempool/pending_transaction_result_cache.rs`, 'retries it later')}. This covers a window that has not opened yet, a fee payer that could not repay the fee loan, and a user-transaction moratorium such as the one mainnet ran in the epoch before the Eagle Ray fork.</li></ul>`);
      const b = blocks.find((x) => x.id === '6e8f39b4-fec0-4f7a-9e64-da635d345037');
      const i = b.text.indexOf('<h3>Key Instructions</h3>');
      if (i < 0 || !b.text.includes('DEFINE_CHILD') || !b.text.endsWith('</code></pre>')) throw new Error('lifecycle block 2 shape changed');
      b.text = b.text.slice(0, i) + LIFECYCLE_KEY_INSTRUCTIONS;
    },
  },
  {
    tagPath: 'developers/infrastructure', slug: '01-running-a-node', version: '2.9.0', changeType: 'minor',
    sentinel: 'sweep429-stokenet-node',
    message: 'Validator creation cost corrected: it is not 5-30 XRD in fees but validator_creation_usd_cost (100 since Anemone, anemone.rs) times the fixed USD_PRICE_IN_XRD of 16.67, 1,666.67 XRD. Adds Running a Node on Stokenet from Daffy\'s handout v1.2 (t.me/RadixDevelopers/66450, 13 Sept): stock babylon-node v1.4.0.0 compiles in the reset genesis, genesis.bin hash and Docker digest both checked 14 Sept.',
    apply(blocks) {
      rep(blocks, '201ab6b4-855b-4659-b47e-0c07a68cf9e7',
        `<li><strong>Register</strong> – submit a validator registration transaction (costs 5-30 <a href="/contents/tech/core-protocols/xrd-token" rel="noopener">XRD</a> in fees)</li>`,
        `<li id="sweep429-validator-fee"><strong>Create and register</strong> – create the validator with <code>CREATE_VALIDATOR</code>, passing your node’s public key, your fee factor and a bucket of <a href="/contents/tech/core-protocols/xrd-token" rel="noopener">XRD</a>, then call <code>register</code> with the owner badge it returns. The creation fee is set in US dollars, ${A(`${SCRYPTO}/radix-engine/src/updates/anemone.rs`, '100 since the Anemone update')}, and converted at the protocol’s ${A(`${SCRYPTO}/radix-common/src/constants/transaction_execution.rs`, 'fixed rate of 16.67 XRD to the dollar')} rather than the market price, so it comes to 1,666.67 XRD.</li>`);
      const at = blocks.findIndex((x) => x.id === '28a6443e-4596-4887-a461-52966dc9f5a3');
      if (at < 0) throw new Error('Next Steps block not found');
      blocks.splice(at, 0, { id: uid(), type: 'content', text: NODE_STOKENET });
    },
  },
  {
    tagPath: 'contents/tech/releases', slug: 'stokenet', version: '1.12.0', changeType: 'minor',
    sentinel: 'sweep429-stock-image',
    message: 'The official image the overlay was waiting for shipped: babylon-node Network.java pins the reset chain\'s genesis (2536c14c...) at v1.4.0.0-RC1 and v1.4.0.0, and the embedded payload decodes to genesis.bin exactly. Operator handout v1.2 (13 Sept, t.me/RadixDevelopers/66450) drops the patched jar. Operational note updated to match.',
    apply(blocks) {
      rep(blocks, '834f4f9b-1ff7-4374-aa6b-89b1b714031c',
        `The network runs the current node release with a patched genesis, so the published node instructions no longer work unmodified; the operator has since circulated a procedure for running a node against the new chain.`,
        `Until the Eagle Ray release a node needed a patched image to join the new chain; babylon-node v1.4.0.0 carries its genesis, and the operator’s procedure dropped the patch on 13 September.`);
      rep(blocks, '75a8a169-275d-4a95-85a8-58eb5e21665c',
        `and the validator registration all stay valid.</p>`,
        `and the validator registration all stay valid.</p>\n${STOKENET_IMAGE}`);
    },
  },
  {
    tagPath: 'developers/infrastructure', slug: '02-radix-apis', version: '1.6.3', changeType: 'patch',
    sentinel: '21:19:48',
    message: 'Halt boundary corrected: 21:19:06 UTC is the Gateway\'s last ingested state (557,840,622), not mainnet\'s last committed round, which was 21:19:48.939 (557,840,627). gateway-status described as the Gateway\'s position; restart and a 14 September read added.',
    apply(blocks) {
      const id = '54c04d45-6412-4a75-9f08-da8fca8f701d';
      rep(blocks, id,
        `mainnet committed its last round at 21:19:06 UTC on 31 August, and the public Gateway`,
        `mainnet committed its last round at 21:19:48 UTC on 31 August, and the public Gateway`);
      rep(blocks, id, `twenty-five hours and fifty minutes after the last committed round`, `twenty-five hours and forty-nine minutes after the last committed round`);
      rep(blocks, id, `<td>200 – returns the frozen ledger state itself</td>`, `<td>200 – returns the last state the Gateway ingested</td>`);
      rep(blocks, id,
        `because the stale ledger state <em>is</em> its payload`,
        `because the Gateway’s last ingested state <em>is</em> its payload. Through the halt that was state version 557,840,622, stamped 21:19:06, five versions short of the ledger’s last commit`);
      rep(blocks, id,
        `is the one endpoint the Gateway will not serve.</p>`,
        `is the one endpoint the Gateway will not serve.</p>\n<p>Mainnet ${L('/developers/infrastructure/01-running-a-node#sweep418-how-the-halt-ended', 'restarted on 11 September 2026')}. Read on 14 September, <code>/status/gateway-status</code> returned epoch 340,755 and <code>/state/entity/details</code> answered normally.</p>`);
    },
  },
  {
    tagPath: 'developers/scrypto', slug: '05-testing-scrypto', version: '1.6.2', changeType: 'patch',
    sentinel: 'unchanged in radix-clis 1.4.0',
    message: 'The rust-toolchain.toml template still pins Rust 1.92.0 at radixdlt-scrypto v1.4.0; the pin was stated for radix-clis 1.3.1 only.',
    apply(blocks) {
      rep(blocks, '5b1fab0e-420a-4ff9-bb60-a67d49968ef3',
        `Under <code>radix-clis</code> 1.3.1 it pins:`,
        `Under <code>radix-clis</code> 1.3.1, and ${A(`${SCRYPTO}/radix-clis/assets/template/rust-toolchain.toml_template`, 'unchanged in radix-clis 1.4.0')}, it pins:`);
    },
  },
  {
    tagPath: 'developers/scrypto', slug: '01-fundamentals', version: '1.4.3', changeType: 'patch',
    sentinel: 'sharded execution is the goal of',
    message: 'The EVM comparison said the Radix Engine scales "shard-aware via Cerberus". Babylon mainnet runs one shard group; sharded execution is what Xi\'an is for.',
    apply(blocks) {
      rep(blocks, 'ed3124a4-a19c-4cd6-8822-5ca0d79d2281',
        `<td>Shard-aware via <a href="/contents/tech/core-protocols/cerberus-consensus-protocol" rel="noopener">Cerberus</a></td>`,
        `<td>One shard group on <a href="/contents/tech/releases/radix-mainnet-babylon" rel="noopener">Babylon</a>; sharded execution is the goal of <a href="/contents/tech/releases/radix-mainnet-xian" rel="noopener">Xi'an</a></td>`);
    },
  },
];

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  for (const e of EDITS) {
    if (isLockedPage(e.tagPath, e.slug)) throw new Error(`${e.tagPath}/${e.slug} is LOCKED`);
    const { rows } = await client.query('SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [e.tagPath, e.slug]);
    if (!rows.length) throw new Error(`${e.tagPath}/${e.slug} not found`);
    const page = rows[0];
    if (JSON.stringify(page.content).includes(e.sentinel)) {
      console.log(`  ${e.slug}: already applied, no write`);
      continue;
    }
    const blocks = JSON.parse(JSON.stringify(page.content));
    e.apply(blocks);
    const json = JSON.stringify(blocks);
    if (!json.includes(e.sentinel)) throw new Error(`${e.slug}: sentinel missing after apply`);
    console.log(`  ${DRY ? '[dry] ' : ''}${e.tagPath}/${e.slug}  v${page.version} -> v${e.version}  (${JSON.stringify(page.content).length} -> ${json.length} chars)`);
    if (DRY) continue;
    const now = new Date().toISOString();
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content = $1, version = $2, updated_at = $3 WHERE id = $4', [json, e.version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, e.version, e.changeType, AUTHOR_ID, e.message, now]);
    await client.query('COMMIT');
  }
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  throw err;
} finally {
  client.release();
  await pool.end();
}
