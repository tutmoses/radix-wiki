import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

// Blueprints & Packages and Smart Accounts were both a single Overview block
// with a bullet list, on two of the terms the rest of the Tech section links to
// most. Read from the radixdlt-scrypto checkout at 858c70f (27 March 2026).

const DRY = process.argv.includes('--dry-run');
const SRC = 'https://github.com/radixdlt/radixdlt-scrypto/blob/main';

// ========================= BLUEPRINTS & PACKAGES =========================

const BP_WHAT_A_PACKAGE_HOLDS =
  '<h2 id="what-a-package-holds">What a Package Holds</h2>'
  + '<p>Publishing a package creates one ledger entity whose state is split across seven partitions, and reading the list is the '
  + 'shortest description of what a package is. One holds the blueprint definitions. One holds each blueprint’s declared '
  + 'dependencies. One holds the type schemas. One holds the royalty configuration, one the authorisation template, and one the VM '
  + 'type, which is either <code>Native</code> or <code>ScryptoV1</code>. The last two both hold code: the '
  + '<strong>original</strong> WebAssembly as uploaded, and the <strong>instrumented</strong> WebAssembly the engine actually '
  + 'runs, with metering calls injected so execution charges by the instruction. Both are kept, so a node can show the developer '
  + 'what was published and still execute what was metered.</p>';

const BP_WHAT_A_BLUEPRINT_DECLARES =
  '<h2 id="what-a-blueprint-declares">What a Blueprint Declares</h2>'
  + '<p>A blueprint is not only code. <code>BlueprintDefinitionInit</code>, the structure a publisher submits, carries seven fields, '
  + 'and five of them are policy rather than logic:</p>'
  + '<ul>'
  + '<li><strong>Type</strong> – <code>Outer</code>, or <code>Inner</code> naming the outer blueprint it belongs to. An inner '
  + 'blueprint cannot exist on its own; a vault is inner to its resource manager, which is what stops a vault outliving the '
  + '<a href="/contents/tech/core-concepts/resources" rel="noopener">resource</a> it holds.</li>'
  + '<li><strong>Transient</strong> – when set, no <a href="/contents/tech/core-concepts/components" rel="noopener">component</a> '
  + 'of this blueprint may be persisted. This is how a bucket or a proof is forced to be resolved inside the transaction that '
  + 'created it.</li>'
  + '<li><strong>Feature set</strong> – the options an instantiator may switch on, fixed at publication.</li>'
  + '<li><strong>Dependencies</strong> – addresses always visible to this blueprint’s call frames.</li>'
  + '<li><strong>Royalty and auth config</strong> – the charge per function, and the rules protecting each function and '
  + 'method.</li>'
  + '</ul>'
  + '<p>The remaining field is the schema: state layout, function signatures, events and named types. Because the schema is on the '
  + 'ledger rather than in a separate artefact, a wallet or an explorer can decode a component’s state and a method’s '
  + 'arguments without the developer publishing an ABI anywhere, which is what lets the Radix Wallet show what a transaction does '
  + 'before it is signed.</p>'
  + '<p>Authorisation is declared here too, and in two parts. Function auth is <code>AllowAll</code>, a map of rules per function, '
  + 'or <code>RootOnly</code>, that last one reserved for functions only the transaction processor may call. Method auth is either '
  + '<code>AllowAll</code> or a static mapping from method to role, with the roles themselves resolved per component by the '
  + '<a href="/contents/tech/core-concepts/role-assignment-module" rel="noopener">role assignment module</a>. The blueprint fixes '
  + 'which roles exist; each component decides who fills them.</p>';

const BP_PUBLISHING =
  '<h2 id="publishing">Publishing, and What Cannot Change After</h2>'
  + '<p>The Package blueprint exposes four functions and no others: <code>publish_wasm</code>, '
  + '<code>publish_wasm_advanced</code>, which additionally takes an owner role and metadata, <code>publish_native</code>, which '
  + 'only the engine’s own genesis and protocol updates use, and <code>PackageRoyalty_claim_royalties</code>. There is no '
  + 'function to replace a package’s code, and no method either.</p>'
  + '<p>A published package is therefore immutable, and upgrading means publishing a new package at a new address and moving '
  + 'whatever should move. Blueprints carry a <code>{major, minor, patch}</code> version, and a comment on '
  + '<code>BlueprintDefinition</code> records the intent behind it – the interface "must be backward compatible with minor '
  + 'version updates" – but the versioning describes definitions rather than giving anyone a way to swap code beneath a '
  + 'running component. A component that exists keeps running the code it was instantiated against, for as long as the ledger '
  + 'does.</p>';

const BP_ROYALTIES =
  '<h2 id="royalties">Royalties</h2>'
  + '<p>A blueprint author can charge per call, which is the part of the model with no equivalent on most networks. '
  + '<code>RoyaltyAmount</code> has three forms: <code>Free</code>, a fixed amount in XRD, or an amount in USD, which the engine '
  + 'converts at the protocol’s own price. A package-level royalty sets the charge per function, and a component can add its '
  + 'own on top. The cap is a constant, <code>MAX_PER_FUNCTION_ROYALTY_IN_XRD</code>, set to 166.67 XRD, so a call cannot be '
  + 'priced arbitrarily high by an author whose blueprint something else already depends on.</p>'
  + '<p>Collected royalties accumulate on the package and are withdrawn by whoever holds the right to call '
  + '<code>claim_royalties</code>. <a href="/contents/tech/core-concepts/component-royalties" rel="noopener">Component '
  + 'royalties</a> covers the instance-level half.</p>';

const BP_LINKS =
  '<h2>External Links</h2>\n<ul>\n'
  + `<li><a href="${SRC}/radix-engine-interface/src/blueprints/package/substates.rs" target="_blank" rel="noopener">package/substates.rs</a> – the partitions, BlueprintDefinition and BlueprintVersion</li>\n`
  + `<li><a href="${SRC}/radix-engine-interface/src/blueprints/package/invocations.rs" target="_blank" rel="noopener">package/invocations.rs</a> – BlueprintDefinitionInit, and the four publish entry points</li>\n`
  + `<li><a href="${SRC}/radix-common/src/constants/transaction_execution.rs" target="_blank" rel="noopener">transaction_execution.rs</a> – the per-function royalty cap</li>\n`
  + '<li><a href="https://docs.radixdlt.com/docs/blueprints-and-components" target="_blank" rel="noopener">Blueprints and components (Radix Docs)</a></li>\n'
  + '<li><a href="/contents/tech/core-protocols/vm-layer" rel="noopener">VM layer</a> – how published code is validated, metered and run</li>\n'
  + '</ul>';

const BP_EXCERPT = 'Blueprints define logic and policy, packages deploy them, components instantiate them. A published package cannot be changed.';

// ============================= SMART ACCOUNTS =============================

const SA_INTERFACE =
  '<h2 id="who-can-call-what">Who Can Call What</h2>'
  + '<p>An account is a component of the native Account blueprint, and its authorisation template says which of its methods the '
  + 'owner reserves and which anyone may call. The owner holds <code>withdraw</code>, <code>lock_fee</code>, '
  + '<code>create_proof_of_amount</code>, <code>burn</code>, the deposit-rule setters, and – against expectation – '
  + '<code>deposit</code> and <code>deposit_batch</code>.</p>'
  + '<p>Four methods are public, and they are the four a stranger sending you tokens actually uses: '
  + '<code>try_deposit_or_refund</code>, <code>try_deposit_or_abort</code>, and the batch form of each. The difference between the '
  + 'pair is what happens when the account declines: a refund returns the resources to the sender and lets the transaction carry '
  + 'on, an abort fails the transaction outright. Making the unconditional <code>deposit</code> owner-only is what gives the '
  + 'deposit rules below any force – a sender cannot route around them, because the method that ignores them is not one they '
  + 'are allowed to call.</p>';

const SA_DEPOSIT_RULES =
  '<h2 id="deposit-rules">Deposit Rules</h2>'
  + '<p>An account carries one default and a list of exceptions. The default is <code>Accept</code>, <code>Reject</code>, or '
  + '<code>AllowExisting</code>, which takes a <a href="/contents/tech/core-concepts/resources" rel="noopener">resource</a> only '
  + 'if the account already holds some of it. Each exception sets a resource to <code>Allowed</code> or <code>Disallowed</code>, '
  + 'and which list is consulted follows from the default: under <code>Accept</code> the deny list applies, under '
  + '<code>Reject</code> the allow list applies, and under <code>AllowExisting</code> both do.</p>'
  + '<p><code>AllowExisting</code> is the setting that answers airdrop spam. An account holding XRD and two tokens it chose keeps '
  + 'receiving all three without maintaining any list, and nothing else reaches it. Separately, an account can name '
  + '<strong>authorized depositors</strong> – badges whose holder may deposit regardless of the rules – which is how an '
  + 'exchange or a payroll contract keeps paying an account that otherwise rejects unknown resources.</p>';

const SA_SECURIFY =
  '<h2 id="from-a-key-to-a-badge">From a Key to a Badge</h2>'
  + '<p>An account created by a wallet is not written to the ledger first. Its address is derived from the hash of a public key '
  + '– the entity types are <code>GlobalPreallocatedEd25519Account</code> and '
  + '<code>GlobalPreallocatedSecp256k1Account</code> – so the address exists, and can receive tokens, before any transaction '
  + 'creates the component. The engine instantiates it on first use, with its owner role set to the signature of that key.</p>'
  + '<p><code>securify</code> is the one-way door out of that arrangement. Calling it mints a non-fungible named "Account Owner '
  + 'Badge", whose local id is the account’s own address bytes, hands the badge to the caller, sets the account’s owner '
  + 'role to whoever holds it, and sets the <code>securify</code> role itself to <code>DenyAll</code> so the call cannot be made a '
  + 'second time. Control has moved from a key to a transferable badge, and a badge is a resource like any other: it can sit in a '
  + 'vault, be held by a multi-signature component, or be governed by an '
  + '<a href="/contents/tech/core-concepts/access-controller" rel="noopener">access controller</a>. That is the mechanism behind '
  + 'the MFA Security Shield and behind social recovery, and neither needed a change to the account blueprint to become '
  + 'possible.</p>';

const SA_LINKS =
  '<h2>External Links</h2>\n<ul>\n'
  + `<li><a href="${SRC}/radix-engine/src/blueprints/account/blueprint.rs" target="_blank" rel="noopener">account/blueprint.rs</a> – the role template, securify, and preallocated-account instantiation</li>\n`
  + `<li><a href="${SRC}/radix-engine-interface/src/blueprints/account/invocations.rs" target="_blank" rel="noopener">account/invocations.rs</a> – every account method, DefaultDepositRule and ResourcePreference</li>\n`
  + '<li><a href="https://docs.radixdlt.com/docs/account" target="_blank" rel="noopener">Accounts (Radix Docs)</a></li>\n'
  + '<li><a href="/contents/tech/core-concepts/access-controller" rel="noopener">Access Controller</a> – multi-factor control and recovery over the owner badge</li>\n'
  + '<li><a href="/contents/tech/core-protocols/radix-wallet" rel="noopener">Radix Wallet</a></li>\n'
  + '</ul>';

const SA_EXCERPT = 'Every Radix account is a component with access rules, deposit rules and a securify path from key control to badge control.';

const PAGES = [
  {
    tagPath: 'contents/tech/core-concepts', slug: 'blueprints-and-packages', version: '2.0.0', change: 'major',
    excerpt: BP_EXCERPT, sentinel: 'what-a-package-holds',
    sections: [BP_WHAT_A_PACKAGE_HOLDS, BP_WHAT_A_BLUEPRINT_DECLARES, BP_PUBLISHING, BP_ROYALTIES],
    appendLinks: BP_LINKS,
    message: 'Expanded from a single Overview bullet list, read from radixdlt-scrypto at 858c70f. Four new sections: the seven partitions a published package occupies, including the two that hold code - the original WebAssembly as uploaded and the instrumented copy the engine meters and runs; the seven fields of BlueprintDefinitionInit, five of which are policy rather than logic, with inner blueprints and the transient flag explained through the vault and the bucket; publishing, where the Package blueprint has four functions and none of them replaces code, so a package is immutable and a component keeps the code it was instantiated against; and royalties, with the three RoyaltyAmount forms and the 166.67 XRD per-function cap. External Links section added - the page had none.',
  },
  {
    tagPath: 'contents/tech/core-protocols', slug: 'smart-accounts', version: '2.0.0', change: 'major',
    excerpt: SA_EXCERPT, sentinel: 'who-can-call-what',
    sections: [SA_INTERFACE, SA_DEPOSIT_RULES, SA_SECURIFY],
    appendLinks: SA_LINKS,
    message: 'Expanded from a single Overview bullet list, read from radixdlt-scrypto at 858c70f. Three new sections: the account role template, where deposit and deposit_batch are owner-only and the four try_deposit variants are the public ones, which is what gives deposit rules their force; the deposit rules themselves, the three defaults and which of the allow and deny lists each consults, plus authorized depositors; and securify, which mints the Account Owner Badge with the account address as its local id, moves the owner role onto it and denies the securify role afterwards, so control passes from a key to a transferable resource once and only once. External Links section added - the page had none.',
  },
];

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

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
    // Neither page has an External Links section, so everything appends after
    // the existing Overview; assert that rather than assume it.
    if (JSON.stringify(blocks).includes('<h2>External Links</h2>')) throw new Error(`${p.slug}: already has External Links`);
    if (!blocks.some(b => b.text?.includes('<h2>Overview</h2>'))) throw new Error(`${p.slug}: Overview block not found`);

    blocks.push(...[...p.sections, p.appendLinks].map(text => ({ id: uid(), type: 'content', text })));

    const metadata = { ...(page.metadata || {}), excerpt: p.excerpt };
    const wordCount = blocks.filter(b => typeof b.text === 'string').reduce((n, b) => n + words(b.text), 0);
    console.log(`  ${DRY ? '[dry] ' : ''}/${p.tagPath}/${p.slug}  v${page.version} -> v${p.version}   blocks ${page.content.length} -> ${blocks.length}   ~${wordCount} words`);
    console.log(`          excerpt ${p.excerpt.length} chars`);

    if (!DRY) {
      const now = new Date().toISOString();
      const json = JSON.stringify(blocks);
      await client.query('BEGIN');
      await client.query('UPDATE pages SET content=$1, version=$2, metadata=$3, updated_at=$4, last_verified_at=$4 WHERE id=$5',
        [json, p.version, JSON.stringify(metadata), now, page.id]);
      await client.query(
        `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [cuid(), page.id, json, page.title, p.version, p.change, AUTHOR_ID, p.message, now]);
      await client.query('COMMIT');
    }
  }
} finally {
  client.release();
  await pool.end();
}
