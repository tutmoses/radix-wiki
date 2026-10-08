// Sweep 557: Composability rewritten. The page was an Ethereum DAO essay (c. 2022) run through a
// find-and-replace of "Ethereum" -> "Radix", so it said "Radix Requests for Comment (ERC)", that
// ERC-20 "defines the characteristics of a fungible token within Radix", that "any Radix dApp can use
// Uniswap's contracts" and that Radix suffered "high fees". None of it was true. Rebuilt from the
// Radix docs (blueprints and components, external calls, resources, metadata standards, manifest,
// subintents). The DAO-tooling half is general DAO theory and belongs on caper.network, not here.
// Also: Substate Model's "Why It Matters" said substates let Cerberus execute on different shards
// today; Babylon runs as one shard group and braiding never shipped. Re-tensed to the conditional.
import { uid, isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');
const A = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const W = (path, text) => `<a href="${path}" rel="noopener">${text}</a>`;
const DOCS = 'https://docs.radixdlt.com/docs';

// ---- Composability -------------------------------------------------------------------------------
const C_SENTINEL = 'id="composability-limits"';
const C_INFOBOX = `<table><tr><td><strong>Category</strong></td><td>Core Property</td></tr><tr><td><strong>Code reuse</strong></td><td>${W('/contents/tech/core-concepts/blueprints-and-packages', 'Blueprints and packages')}, external calls</td></tr><tr><td><strong>Shared assets</strong></td><td>Native ${W('/contents/tech/core-concepts/resources', 'resources')}, no token standard</td></tr><tr><td><strong>Composed in</strong></td><td>The ${W('/contents/tech/core-protocols/transaction-manifests', 'transaction manifest')}</td></tr><tr><td><strong>Strict form</strong></td><td>${W('/contents/tech/core-concepts/atomic-composability', 'Atomic composability')}</td></tr></table>`;

const C_BLOCKS = [
  `<h2>Overview</h2><p><strong>Composability</strong> is the ability of one application to use another as a part: to call its code, hold its assets, and feed its output into something else. On Radix it works at three levels, each supplied by the platform rather than agreed between developers: code deployed by one team can be instantiated and called by any other; every token behaves the same way in every application because the engine defines what a token is; and a single transaction can chain calls to many applications, passing assets from one to the next. The strict form of the third, where the whole chain succeeds or fails as one, has its own page, ${W('/contents/tech/core-concepts/atomic-composability', 'Atomic Composability')}.</p>`,
  `<h2>Reusing Code</h2><p>Scrypto, Radix's Rust SDK for on-ledger code, splits a smart contract in two. A <strong>blueprint</strong> holds the logic and the shape of the state; a <strong>component</strong> is a live instance of it, with its own state and assets. Blueprints are deployed in <strong>packages</strong>, and "multiple components can be instantiated from the same blueprint": the docs' example is one liquidity-pool blueprint serving many token pairs, each pair its own component that behaves identically (${A(`${DOCS}/blueprints-and-components/`, 'Radix Docs: Blueprints and Components')}).</p><p>Code in one package can call code in another. The docs call this an external or cross-blueprint call, which "allows a developer to create complex systems by composing various blueprints and components together": a blueprint declares the interface it expects, then calls functions on a blueprint at a known package address or methods on a global component (${A(`${DOCS}/advanced-external-calls/`, 'Radix Docs: Advanced External Calls')}). Whether a given method will accept the call is up to that component's ${W('/contents/tech/core-concepts/access-rules-and-auth-zones', 'access rules')}, and its author can charge a ${W('/contents/tech/core-concepts/component-royalties', 'royalty')} on each use.</p>`,
  `<h2>Shared Assets Without a Token Standard</h2><p>On Ethereum, a token is a contract, and applications can handle one another's tokens only because their authors implement the same interface: ${A('https://eips.ethereum.org/EIPS/eip-20', 'ERC-20')} for fungible tokens, ${A('https://eips.ethereum.org/EIPS/eip-721', 'ERC-721')} for non-fungible ones. A contract that departs from the interface, or implements it with a bug, breaks every application that assumed it.</p><p>Radix has no equivalent standard to agree on. Resources, its name for tokens of every kind, "are native to the Radix Engine, meaning the engine knows how resources are created and behaves, therefore enforces resource behaviors"; they can only move between containers, never be copied or lost, and even ${W('/contents/tech/core-protocols/xrd-token', 'XRD')} is one (${A(`${DOCS}/resources/`, 'Radix Docs: Resources')}). Supply rules, minting rights and withdrawal restrictions are settings on the resource that the engine enforces and wallets can read, not code each issuer writes. A component that accepts a bucket of tokens therefore handles every resource on the network the same way, with no adapter per token, and no application has to be granted an allowance to move a user's tokens (${W('/contents/tech/core-concepts/native-assets-vs-token-approvals', 'Native Assets vs. Token Approvals')}).</p><p>What developers do agree on is metadata. The ${A(`${DOCS}/metadata-for-wallet-display/`, 'metadata standards')} name the fields, such as <code>name</code>, <code>symbol</code> and <code>description</code>, that the Radix Wallet, the Dashboard and exchanges expect on a resource, component or package, as a "least common denominator" for display. They govern how an asset is presented, not how it behaves.</p>`,
  `<h2>Composing in the Transaction</h2><p>The third level does not need either application to know about the other. A ${W('/contents/tech/core-protocols/transaction-manifests', 'transaction manifest')} lists a sequence of component calls and the movements of resources between them, which "make[s] it possible to compose multiple actions to be executed atomically"; the manifest can also present badges for authorization, pay the fee, and assert minimum amounts so the user gets a guaranteed result (${A(`${DOCS}/manifest/`, 'Radix Docs: Transactions & Manifests')}). Assets returned by one call land on the ${W('/contents/tech/core-concepts/worktop', 'worktop')} and are passed into the next, so a swap on one exchange can fund a deposit into a lending market in the same transaction without either team writing integration code.</p><p>Since the Cuttlefish protocol update, composition can also span parties. A ${W('/contents/tech/core-concepts/subintents-and-pre-authorizations', 'subintent')} is a signed mini-transaction with its own manifest that only executes as part of a larger one, exchanging buckets with its parent through yield instructions; the engine guarantees that "in a successful execution, every subintent will be executed in its entirety" (${A(`${DOCS}/subintents/`, 'Radix Docs: Subintents')}). Delegated fee payment and multi-party trades are built this way.</p>`,
  `<h2 ${C_SENTINEL}>Where Composability Stops</h2><p>Composition holds only for assets and code on the same ledger. Tokens from other chains reach Radix as wrapped copies through a bridge, ${W('/ecosystem/hyperlane', 'Hyperlane')}, and a transaction on Radix cannot also act on the chain the original sits on; what the copy is worth depends on the bridge, as the ${W('/contents/history/hyperlane-asset-drain-2026', '2026 Hyperlane asset drain')} showed.</p><p>Within Radix, every transaction today is settled by one consensus instance covering the whole ledger, so any manifest can reach any component. Keeping that true across many shards is what ${W('/contents/tech/core-protocols/cerberus-consensus-protocol', 'Cerberus')} was specified to do, and it has not shipped: the ${W('/contents/tech/research/hyperscale-rs', 'hyperscale-rs')} work on a sharded network commits per shard rather than braiding consensus across them. ${W('/contents/tech/core-concepts/atomic-composability', 'Atomic Composability')} covers what that leaves open.</p>`,
  `<h2>See Also</h2><ul><li>${W('/contents/tech/core-concepts/atomic-composability', 'Atomic Composability')}</li><li>${W('/contents/tech/core-concepts/blueprints-and-packages', 'Blueprints and Packages')}</li><li>${W('/contents/tech/core-concepts/components', 'Components')}</li><li>${W('/contents/tech/core-concepts/resources', 'Resources')}</li><li>${W('/contents/tech/core-concepts/decentralized-finance-defi', 'Decentralized Finance (DeFi)')}</li></ul><h2>External Links</h2><ul><li>${A(`${DOCS}/blueprints-and-components/`, 'Blueprints and Components – Radix Docs')}</li><li>${A(`${DOCS}/advanced-external-calls/`, 'Advanced External Calls – Radix Docs')}</li><li>${A(`${DOCS}/resources/`, 'Resources – Radix Docs')}</li><li>${A(`${DOCS}/manifest/`, 'Transactions & Manifests – Radix Docs')}</li><li>${A('https://www.radixdlt.com/articles-learn/what-is-atomic-composability', 'What is Atomic Composability – Radix Learn')}</li></ul>`,
];

// ---- Substate Model ------------------------------------------------------------------------------
const S_OLD_START = '<h3>Why It Matters</h3>';
const S_OLD_END = 'This creates bottlenecks around popular contracts (DEXes, stablecoins).</p>';
const S_NEW = `<h3>Why It Matters</h3>
<p>Because each substate can be locked on its own, two transactions conflict only if they touch the same substates, even when they call the same component. That is the property ${W('/contents/tech/core-protocols/cerberus-consensus-protocol', 'Cerberus')} was designed to exploit, by running non-conflicting transactions on different shards at once. Mainnet does not shard yet: Babylon runs as a single shard group, so today the granularity decides what conflicts rather than where it runs.</p>
<p>Under Ethereum's account model the contract is the unit of state, so any two transactions touching the same contract are ordered against each other even when they read and write different data inside it, which bottlenecks popular contracts such as exchanges and stablecoins.</p>`;
const S_SENTINEL = 'Mainnet does not shard yet';

async function edit(client, tagPath, slug, mutate, opts) {
  if (isLockedPage(tagPath, slug)) throw new Error(`${slug} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [tagPath, slug]);
  if (!rows.length) throw new Error(`${slug}: page not found`);
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));
  const next = mutate(blocks);
  if (!next) { console.log(`  ${slug}: already applied – no write`); return; }
  const version = await writeRevision(client, page, next, { ...opts, dry: DRY });
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
}

await withClient(async (client) => {
  await edit(client, 'contents/tech/core-concepts', 'composability', (blocks) => {
    if (JSON.stringify(blocks).includes(C_SENTINEL)) return null;
    const infobox = blocks.find((b) => b.type === 'infobox');
    if (!infobox || blocks[0] !== infobox) throw new Error('infobox not first');
    const video = infobox.blocks.filter((b) => b.text?.includes('data-youtube-video'));
    infobox.blocks = [{ id: uid(), type: 'content', text: C_INFOBOX }, ...video];
    return [infobox, ...C_BLOCKS.map((text) => ({ id: uid(), type: 'content', text }))];
  }, {
    change: 'major',
    message: 'Rewritten from the Radix docs. The old text was an Ethereum DAO essay with "Ethereum" replaced by "Radix" (it called ERC-20 a Radix standard and claimed high Radix fees). Now: code reuse via blueprints and external calls, native resources in place of a token standard, metadata standards, composition in the manifest and subintents, and where composition stops (bridges, sharding). DAO-tooling material dropped as general DAO theory.',
    verified: true,
  });

  await edit(client, 'contents/tech/core-concepts', 'substate-model', (blocks) => {
    if (blocks.some((b) => b.text?.includes(S_SENTINEL))) return null;
    const hits = blocks.filter((b) => b.text?.includes(S_OLD_START) && b.text.includes(S_OLD_END));
    if (hits.length !== 1) throw new Error(`substate anchor matched ${hits.length} blocks`);
    const t = hits[0].text;
    hits[0].text = t.slice(0, t.indexOf(S_OLD_START)) + S_NEW + t.slice(t.indexOf(S_OLD_END) + S_OLD_END.length);
    return blocks;
  }, {
    change: 'patch',
    message: '"Why It Matters" said substates let Cerberus execute transactions on different shards today; Babylon runs as one shard group and cross-shard braiding never shipped. Re-tensed to the design intent; rest of the page checked against the Radix Engine docs it cites.',
    verified: true,
  });
});
