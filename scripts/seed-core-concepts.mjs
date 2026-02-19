// scripts/seed-core-concepts.mjs
// Batch seed script for new core-concepts and core-protocols wiki pages
import pg from 'pg';
import { randomUUID } from 'crypto';
import { config } from 'dotenv';

config();

const uid = () => randomUUID();
const AUTHOR_ID = 'cmk5t48vx0000005zc5se4dqz'; // Hydrate

const pages = [
  // ─────────────────────────────────────────────
  // 1. Asset-Oriented Programming
  // ─────────────────────────────────────────────
  {
    tagPath: 'contents/tech/core-concepts',
    slug: 'asset-oriented-programming',
    title: 'Asset-Oriented Programming',
    excerpt: 'Programming paradigm where digital assets are first-class platform primitives that behave like physical objects, eliminating entire classes of smart contract vulnerabilities.',
    content: [
      {
        id: uid(), type: 'infobox', blocks: [{
          id: uid(), type: 'content',
          text: `<table><tbody>
<tr><td colspan="2"><strong>Asset-Oriented Programming</strong></td></tr>
<tr><td>Paradigm</td><td>Resource-centric smart contracts</td></tr>
<tr><td>Introduced</td><td>Radix Babylon (2023)</td></tr>
<tr><td>Language</td><td><a href="/contents/tech/core-protocols/scrypto-programming-language" rel="noopener">Scrypto</a></td></tr>
<tr><td>Runtime</td><td><a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix Engine</a></td></tr>
<tr><td>Specification</td><td><a href="https://www.radixdlt.com/blog/scrypto-an-asset-oriented-smart-contract-language" target="_blank" rel="noopener">Radix Blog</a></td></tr>
</tbody></table>`
        }]
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Introduction</h2>
<p><strong>Asset-Oriented Programming</strong> is the foundational programming paradigm of the <a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix platform</a>, in which digital assets — tokens, NFTs, badges — are treated as native, first-class primitives governed by the execution environment rather than by application code. Unlike the <a href="https://ethereum.org/en/developers/docs/accounts/" target="_blank" rel="noopener">Ethereum account model</a> where a token is merely a number in a mapping inside a smart contract (<code>balances[address] = 100</code>), on Radix resources are physical-like objects that can never be copied, accidentally destroyed, or lost.</p>
<p>This design is enforced by the <a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix Engine</a>'s <a href="/contents/tech/core-concepts/finite-state-machines" rel="noopener">finite state machine</a> constraint model. When a <a href="/contents/tech/core-protocols/scrypto-programming-language" rel="noopener">Scrypto</a> component method accepts a <a href="/contents/tech/core-concepts/buckets-proofs-and-vaults" rel="noopener">Bucket</a> of tokens, ownership of those tokens physically transfers to the component at the engine level — not by updating a balance entry, but by moving a container.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>How It Differs from Ethereum</h2>
<p>On Ethereum, transferring ERC-20 tokens involves calling the token contract's <code>transfer</code> function, which decrements the sender's balance and increments the receiver's. This creates several vulnerability classes:</p>
<ul>
<li><strong>Reentrancy attacks</strong> — an external call can re-enter the contract before state updates complete (the cause of the <a href="https://en.wikipedia.org/wiki/The_DAO" target="_blank" rel="noopener">2016 DAO hack</a>)</li>
<li><strong>Approval exploits</strong> — the <code>approve</code>/<code>transferFrom</code> pattern introduces a second attack surface</li>
<li><strong>Accidental token loss</strong> — tokens sent to a contract with no withdrawal function are permanently locked</li>
</ul>
<p>Asset-Oriented Programming eliminates these by design. Reentrancy is impossible because resources physically move rather than balances being updated. There is no approval pattern — you pass a Bucket directly. And the Radix Engine enforces that every Bucket must be deposited into a <a href="/contents/tech/core-concepts/buckets-proofs-and-vaults" rel="noopener">Vault</a> by the end of a transaction, or the transaction fails.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Resources as Platform Primitives</h2>
<p>Resources on Radix are created via <a href="https://docs.radixdlt.com/docs/resources" target="_blank" rel="noopener">built-in system calls</a> with configurable behaviours: mintable, burnable, divisibility, metadata, and more. The platform enforces conservation — if 100 tokens enter a transaction, exactly 100 must leave it (unless authorised minting or burning occurs). This guarantee is provided at the engine level, not by application code, meaning that bugs in Scrypto components cannot violate resource conservation.</p>
<p>Because resources are native types, the <a href="/contents/tech/core-protocols/radix-wallet" rel="noopener">Radix Wallet</a> can display and manage any token or NFT without requiring per-token integration — unlike Ethereum wallets which must manually add each ERC-20 contract address.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>External Links</h2>
<ul>
<li><a href="https://www.radixdlt.com/blog/scrypto-an-asset-oriented-smart-contract-language" target="_blank" rel="noopener">Scrypto: An Asset-Oriented Smart Contract Language</a> — Radix Blog</li>
<li><a href="https://docs.radixdlt.com/docs/resources" target="_blank" rel="noopener">Resources</a> — Radix Documentation</li>
<li><a href="https://github.com/radixdlt/radixdlt-scrypto" target="_blank" rel="noopener">radixdlt-scrypto</a> — GitHub Repository</li>
</ul>`
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 2. Blueprints & Packages
  // ─────────────────────────────────────────────
  {
    tagPath: 'contents/tech/core-concepts',
    slug: 'blueprints-and-packages',
    title: 'Blueprints & Packages',
    excerpt: 'Scrypto\'s deployment model where reusable Blueprint templates are bundled into Packages, from which on-ledger Component instances are created.',
    content: [
      {
        id: uid(), type: 'infobox', blocks: [{
          id: uid(), type: 'content',
          text: `<table><tbody>
<tr><td colspan="2"><strong>Blueprints & Packages</strong></td></tr>
<tr><td>Concept</td><td>Smart contract deployment model</td></tr>
<tr><td>Analogy</td><td>Class → Instance (OOP)</td></tr>
<tr><td>Compilation</td><td>Rust/Scrypto → WebAssembly</td></tr>
<tr><td>Runtime</td><td><a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix Engine</a></td></tr>
<tr><td>Documentation</td><td><a href="https://docs.radixdlt.com/docs/blueprints-and-components" target="_blank" rel="noopener">Radix Docs</a></td></tr>
</tbody></table>`
        }]
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Introduction</h2>
<p>In the Radix ecosystem, a <strong>Blueprint</strong> is a reusable template — analogous to a class in object-oriented programming — from which <strong>Components</strong> (on-ledger smart contract instances) are created. One or more Blueprints are bundled into a <strong>Package</strong>, which is the deployable unit on the Radix network.</p>
<p>This model separates code deployment from instantiation. A developer publishes a Package once, and anyone on the network can then <a href="https://docs.radixdlt.com/docs/blueprints-and-components" target="_blank" rel="noopener">instantiate Components</a> from its Blueprints — each with its own on-ledger address, state, and <a href="/contents/tech/core-concepts/buckets-proofs-and-vaults" rel="noopener">Vaults</a> holding resources.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Architecture</h2>
<h3>Blueprints</h3>
<p>A Blueprint defines:</p>
<ul>
<li><strong>State fields</strong> — typed data the Component stores (e.g., a <code>Vault</code> for collected fees, a <code>u64</code> counter)</li>
<li><strong>Functions</strong> — stateless methods callable without a Component instance (including constructors like <code>instantiate_*</code>)</li>
<li><strong>Methods</strong> — stateful methods that operate on a specific Component instance</li>
<li><strong>Events</strong> — typed events emitted during execution for off-chain indexing</li>
</ul>
<p>Blueprints can also declare <a href="/contents/tech/core-concepts/access-rules-and-auth-zones" rel="noopener">access rules</a>, <a href="/contents/tech/core-concepts/component-royalties" rel="noopener">royalties</a>, and metadata at both the Blueprint and Component level.</p>
<h3>Packages</h3>
<p><a href="/contents/tech/core-protocols/scrypto-programming-language" rel="noopener">Scrypto</a> source code is compiled into <a href="https://webassembly.org/" target="_blank" rel="noopener">WebAssembly</a> and bundled into a Package. Once published to the ledger, the Package receives a unique on-ledger address (e.g., <code>package_rdx1...</code>). All Blueprints within the Package share the same address namespace.</p>
<p>The Radix network includes several <strong>native Packages</strong> — system-provided Blueprints for Accounts, Validators, Access Controllers, and Resources — that form the platform's built-in functionality.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Component Lifecycle</h2>
<ol>
<li><strong>Develop</strong> — write Scrypto Blueprints using Rust tooling</li>
<li><strong>Test</strong> — use the <a href="https://docs.radixdlt.com/docs/getting-rust-scrypto" target="_blank" rel="noopener">Scrypto test framework</a> with the ledger simulator</li>
<li><strong>Publish</strong> — deploy the compiled Package to the Radix ledger via a <a href="/contents/tech/core-protocols/transaction-manifests" rel="noopener">Transaction Manifest</a></li>
<li><strong>Instantiate</strong> — call a Blueprint's constructor function to create a Component</li>
<li><strong>Interact</strong> — call the Component's methods via Transaction Manifests</li>
</ol>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>External Links</h2>
<ul>
<li><a href="https://docs.radixdlt.com/docs/blueprints-and-components" target="_blank" rel="noopener">Blueprints and Components</a> — Radix Documentation</li>
<li><a href="https://docs.radixdlt.com/docs/learning-to-explain-your-first-scrypto-project" target="_blank" rel="noopener">Your First Scrypto Project</a> — Radix Documentation</li>
<li><a href="https://github.com/radixdlt/radixdlt-scrypto" target="_blank" rel="noopener">radixdlt-scrypto</a> — GitHub Repository</li>
</ul>`
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 3. Buckets, Proofs & Vaults
  // ─────────────────────────────────────────────
  {
    tagPath: 'contents/tech/core-concepts',
    slug: 'buckets-proofs-and-vaults',
    title: 'Buckets, Proofs & Vaults',
    excerpt: 'The three core asset containers in Scrypto: Vaults for permanent storage, Buckets for in-transaction movement, and Proofs for authorization attestation.',
    content: [
      {
        id: uid(), type: 'infobox', blocks: [{
          id: uid(), type: 'content',
          text: `<table><tbody>
<tr><td colspan="2"><strong>Buckets, Proofs & Vaults</strong></td></tr>
<tr><td>Category</td><td>Asset container primitives</td></tr>
<tr><td>Paradigm</td><td><a href="/contents/tech/core-concepts/asset-oriented-programming" rel="noopener">Asset-Oriented Programming</a></td></tr>
<tr><td>Runtime</td><td><a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix Engine</a></td></tr>
<tr><td>Documentation</td><td><a href="https://docs.radixdlt.com/docs/buckets-and-vaults" target="_blank" rel="noopener">Radix Docs</a></td></tr>
</tbody></table>`
        }]
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Introduction</h2>
<p><strong>Buckets</strong>, <strong>Vaults</strong>, and <strong>Proofs</strong> are the three core asset containers in <a href="/contents/tech/core-protocols/scrypto-programming-language" rel="noopener">Scrypto</a>, each serving a distinct purpose in <a href="/contents/tech/core-concepts/asset-oriented-programming" rel="noopener">Asset-Oriented Programming</a>. Together they form the mechanism by which resources are stored, moved, and used for authorisation on the Radix network.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Vaults</h2>
<p>A <strong>Vault</strong> is a permanent, on-ledger container that holds a single type of resource (fungible tokens or <a href="/contents/tech/core-protocols/nfts-on-radix" rel="noopener">non-fungible tokens</a>). Vaults are owned by Components — including <a href="/contents/tech/core-protocols/smart-accounts" rel="noopener">Account components</a> — and represent the resting state of all assets on the network.</p>
<p>At the end of every transaction, all resources must reside in Vaults. Any resources left outside a Vault cause the transaction to fail, preventing accidental token loss. A Component may hold multiple Vaults, but each Vault holds only one resource type.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Buckets</h2>
<p>A <strong>Bucket</strong> is a temporary, in-transaction container for moving resources between Components. Buckets exist only during transaction execution — they are created when resources are withdrawn from a Vault and destroyed when deposited into another Vault.</p>
<p>The lifecycle of a Bucket within a <a href="/contents/tech/core-protocols/transaction-manifests" rel="noopener">Transaction Manifest</a>:</p>
<ol>
<li>Withdraw resources from an Account Vault → creates a Bucket</li>
<li>Pass the Bucket to a Component method → transfers ownership</li>
<li>The Component deposits the Bucket into its own Vault</li>
</ol>
<p>The Radix Engine enforces that all Buckets must be empty or deposited by the end of the transaction. This guarantee — enforced at the platform level, not by application code — makes it impossible to accidentally lose tokens by sending them to the wrong address.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Proofs</h2>
<p>A <strong>Proof</strong> is a non-transferable cryptographic attestation created from a Vault or Bucket, proving that the caller possesses a certain quantity or type of resource. Proofs do not move the underlying assets — they attest to their existence.</p>
<p>Proofs are placed onto an <a href="/contents/tech/core-concepts/access-rules-and-auth-zones" rel="noopener">Auth Zone</a> during transaction execution, where they are checked against Component <a href="/contents/tech/core-concepts/access-rules-and-auth-zones" rel="noopener">Access Rules</a>. This is how authorisation works on Radix: rather than checking <code>msg.sender</code> as on Ethereum, a Scrypto method requires a Proof of a specific badge resource.</p>
<p><strong>Virtual Proofs</strong> are automatically created by the Radix Engine from transaction signatures. When a user signs a transaction with their wallet key, the engine creates a virtual Proof of the account's signature badge, linking traditional cryptographic signing to Radix's badge-based authorisation.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>External Links</h2>
<ul>
<li><a href="https://docs.radixdlt.com/docs/buckets-and-vaults" target="_blank" rel="noopener">Buckets and Vaults</a> — Radix Documentation</li>
<li><a href="https://docs.radixdlt.com/docs/resources" target="_blank" rel="noopener">Resources</a> — Radix Documentation</li>
<li><a href="https://docs.radixdlt.com/docs/auth" target="_blank" rel="noopener">Proofs and Auth</a> — Radix Documentation</li>
</ul>`
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 4. Access Rules & Auth Zones
  // ─────────────────────────────────────────────
  {
    tagPath: 'contents/tech/core-concepts',
    slug: 'access-rules-and-auth-zones',
    title: 'Access Rules & Auth Zones',
    excerpt: 'Radix\'s declarative authorisation model where Components define what badge Proofs must be present in the caller\'s Auth Zone for a method call to succeed.',
    content: [
      {
        id: uid(), type: 'infobox', blocks: [{
          id: uid(), type: 'content',
          text: `<table><tbody>
<tr><td colspan="2"><strong>Access Rules & Auth Zones</strong></td></tr>
<tr><td>Category</td><td>Authorisation model</td></tr>
<tr><td>Mechanism</td><td>Badge-based Proof verification</td></tr>
<tr><td>Scope</td><td>Per-method, per-Component</td></tr>
<tr><td>Documentation</td><td><a href="https://docs.radixdlt.com/docs/auth" target="_blank" rel="noopener">Radix Docs</a></td></tr>
</tbody></table>`
        }]
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Introduction</h2>
<p><strong>Access Rules</strong> are declarative authorisation policies attached to <a href="/contents/tech/core-concepts/blueprints-and-packages" rel="noopener">Blueprint</a> and Component methods. They define what <a href="/contents/tech/core-concepts/buckets-proofs-and-vaults" rel="noopener">Proofs</a> must be present for a call to succeed. <strong>Auth Zones</strong> are per-call-frame containers that hold Proofs during <a href="/contents/tech/core-protocols/transaction-manifests" rel="noopener">Transaction Manifest</a> execution, forming Radix's native authorisation system.</p>
<p>This model replaces Ethereum's <code>msg.sender</code> pattern with a more flexible, composable approach. Instead of checking "who called this function", Radix checks "what Proofs are available" — enabling multi-factor authentication, role-based access, and delegated authority natively.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Badges</h2>
<p>A <strong>badge</strong> is any resource — fungible token or NFT — that a Component's Access Rules reference for authorisation. There is nothing structurally special about a badge; it is simply a resource used for access control. For example, an "admin badge" NFT might be required to call a <code>set_price</code> method on a DEX Component.</p>
<p>Access Rules support composite logic:</p>
<ul>
<li><strong>require(resource)</strong> — must present Proof of a specific resource</li>
<li><strong>require_amount(n, resource)</strong> — must prove ownership of at least <em>n</em> units</li>
<li><strong>require_any_of / require_all_of</strong> — OR / AND composition of multiple badge requirements</li>
<li><strong>require_n_of(n, resources)</strong> — threshold (N of M) badge requirements</li>
</ul>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Auth Zone Mechanics</h2>
<p>Each call frame in a transaction has its own Auth Zone — a stack of Proofs. When a Transaction Manifest creates a Proof (e.g., from an Account's Vault) and pushes it, subsequent method calls in the same frame can see it.</p>
<p><strong>Proof propagation rules</strong> provide security guarantees:</p>
<ul>
<li>Proofs move <strong>up</strong> the call stack freely — a method can return a Proof to the manifest's Auth Zone</li>
<li>Proofs move <strong>down</strong> the stack once — if the manifest pushes a Proof and calls Component A, then Component B, both see the Proof</li>
<li>But if Component B internally calls Component C, Proofs from the manifest <strong>do not propagate</strong> to C's frame — preventing unintended authorisation delegation</li>
</ul>
<p>Access Rules can be configured as <strong>locked</strong> (immutable) or <strong>updatable</strong>, and support named roles (e.g., "admin", "minter") that map to different badge requirements. <a href="/contents/tech/core-protocols/smart-accounts" rel="noopener">Smart Accounts</a> use a specialised <strong>Access Controller</strong> Component that implements multi-factor authentication using this same mechanism.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>External Links</h2>
<ul>
<li><a href="https://docs.radixdlt.com/docs/auth" target="_blank" rel="noopener">Proofs / Auth</a> — Radix Documentation</li>
<li><a href="https://docs.radixdlt.com/docs/authorization-approach" target="_blank" rel="noopener">Authorization Model</a> — Radix Documentation</li>
<li><a href="https://www.radixdlt.com/blog/how-radix-multi-factor-smart-accounts-work-and-what-they-can-do" target="_blank" rel="noopener">Multi-Factor Smart Accounts</a> — Radix Blog</li>
</ul>`
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 5. Validator Nodes
  // ─────────────────────────────────────────────
  {
    tagPath: 'contents/tech/core-concepts',
    slug: 'validator-nodes',
    title: 'Validator Nodes',
    excerpt: 'Network participants running Cerberus consensus, selected via Delegated Proof of Stake where the top 100 validators by staked XRD form the Active Validator Set.',
    content: [
      {
        id: uid(), type: 'infobox', blocks: [{
          id: uid(), type: 'content',
          text: `<table><tbody>
<tr><td colspan="2"><strong>Validator Nodes</strong></td></tr>
<tr><td>Consensus</td><td><a href="/contents/tech/core-protocols/cerberus-consensus-protocol" rel="noopener">Cerberus</a></td></tr>
<tr><td>Selection</td><td><a href="/contents/tech/core-concepts/delegated-proof-of-stake-dpos" rel="noopener">Delegated Proof of Stake</a></td></tr>
<tr><td>Active Set Size</td><td>100 validators</td></tr>
<tr><td>Epoch Length</td><td>10,000 rounds</td></tr>
<tr><td>Uptime Threshold</td><td>98%</td></tr>
<tr><td>Dashboard</td><td><a href="https://dashboard.radixdlt.com/network-staking" target="_blank" rel="noopener">Radix Dashboard</a></td></tr>
</tbody></table>`
        }]
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Introduction</h2>
<p><strong>Validator Nodes</strong> are network participants that run the <a href="/contents/tech/core-protocols/cerberus-consensus-protocol" rel="noopener">Cerberus consensus protocol</a> to propose and validate transactions on the Radix network. They are selected through a <a href="/contents/tech/core-concepts/delegated-proof-of-stake-dpos" rel="noopener">Delegated Proof of Stake (DPoS)</a> mechanism where XRD holders delegate their tokens to validators they trust.</p>
<p>The <strong>top 100 validators</strong> by total delegated stake form the <strong>Active Validator Set</strong> at the start of each epoch. Only active validators participate in consensus and receive <a href="/contents/tech/core-concepts/network-emissions" rel="noopener">network emissions</a>.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Consensus & Epochs</h2>
<p>Consensus proceeds in <strong>epochs</strong>, each consisting of 10,000 rounds. In each round, one validator is the "leader" responsible for proposing consensus. Validators take turns as leader with probability proportional to their stake.</p>
<p>If a validator is offline during its leader rounds, those rounds fail — blocking transaction commitment until the next healthy validator's round begins. Validators must maintain at least <strong>98% uptime</strong>; below this threshold, the protocol provides zero emissions rewards to that validator and its stakers for the epoch.</p>
<h3>Revenue Sources</h3>
<ul>
<li>A share of <a href="/contents/tech/core-concepts/network-emissions" rel="noopener">network emissions</a> proportional to stake</li>
<li>A configurable validator fee (percentage of staker emissions)</li>
<li>A portion of transaction fees and tips</li>
</ul>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Registration & Operation</h2>
<p>Anyone can register as a validator by running a <a href="https://docs.radixdlt.com/docs/node-registering-as-a-validator" target="_blank" rel="noopener">full node</a> and submitting a registration transaction. Validators are on-ledger Components with configurable metadata (name, URL, icon), a fee percentage, and optional staker acceptance rules.</p>
<p>A validator enters the Active Set only if it accumulates enough delegated stake to rank in the top 100. Validators below this threshold remain registered but do not participate in consensus or earn rewards.</p>
<p>When XRD holders <a href="/contents/tech/core-concepts/staking" rel="noopener">stake</a> to a validator, they receive <a href="/contents/tech/core-concepts/liquid-stake-units" rel="noopener">Liquid Stake Units (LSUs)</a> — fungible tokens representing their staked position — which can be traded, used as collateral in DeFi, or unstaked (subject to a delay period).</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>External Links</h2>
<ul>
<li><a href="https://docs.radixdlt.com/docs/validator" target="_blank" rel="noopener">Validator</a> — Radix Documentation</li>
<li><a href="https://learn.radixdlt.com/article/how-should-i-choose-validators-to-stake-to" target="_blank" rel="noopener">How Should I Choose Validators?</a> — Radix Knowledge Base</li>
<li><a href="https://dashboard.radixdlt.com/network-staking" target="_blank" rel="noopener">Network Staking Dashboard</a> — Radix Dashboard</li>
</ul>`
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 6. Network Emissions
  // ─────────────────────────────────────────────
  {
    tagPath: 'contents/tech/core-concepts',
    slug: 'network-emissions',
    title: 'Network Emissions',
    excerpt: 'Protocol-level minting of new XRD distributed as staking rewards to validators and delegators, constituting Radix\'s inflation mechanism and security incentive.',
    content: [
      {
        id: uid(), type: 'infobox', blocks: [{
          id: uid(), type: 'content',
          text: `<table><tbody>
<tr><td colspan="2"><strong>Network Emissions</strong></td></tr>
<tr><td>Total Supply Cap</td><td>24 billion XRD</td></tr>
<tr><td>Genesis Allocation</td><td>12 billion (July 2021)</td></tr>
<tr><td>Emissions Pool</td><td>~12 billion over ~40 years</td></tr>
<tr><td>Annual Rate</td><td>~300 million XRD/year</td></tr>
<tr><td>Fee Burn Rate</td><td>50% of base transaction fees</td></tr>
<tr><td>Reference</td><td><a href="https://learn.radixdlt.com/article/start-here-radix-tokens-and-tokenomics" target="_blank" rel="noopener">Radix Tokenomics</a></td></tr>
</tbody></table>`
        }]
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Introduction</h2>
<p><strong>Network Emissions</strong> are the protocol-level minting of new <a href="/contents/tech/core-protocols/xrd-token" rel="noopener">$XRD</a> tokens distributed as <a href="/contents/tech/core-concepts/staking" rel="noopener">staking</a> rewards to <a href="/contents/tech/core-concepts/validator-nodes" rel="noopener">validators</a> and their delegators. This mechanism provides the primary economic incentive for securing the Radix network through <a href="/contents/tech/core-concepts/delegated-proof-of-stake-dpos" rel="noopener">Delegated Proof of Stake</a>.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Supply & Distribution</h2>
<p>XRD has a hard cap of <strong>24 billion tokens</strong>. At genesis in July 2021, 12 billion were allocated: 9.6 billion unlocked and circulating, and 2.4 billion locked indefinitely in a stable coin reserve. The remaining 12 billion are minted as emissions over approximately 40 years at a rate of roughly 300 million XRD per year.</p>
<p>Emissions for each epoch are allocated to active validators proportional to their share of total staked XRD. Validators take their configured fee percentage, and the remainder flows to delegators proportionally. The protocol <strong>auto-compounds</strong> staker rewards by re-staking emission XRD, increasing the value of existing <a href="/contents/tech/core-concepts/liquid-stake-units" rel="noopener">Liquid Stake Units</a>.</p>
<h3>Eligibility</h3>
<ul>
<li>Only the <strong>top 100 validators</strong> in the Active Validator Set receive emissions</li>
<li>Validators with uptime below <strong>98%</strong> receive zero emissions for that epoch</li>
<li>This creates strong incentives for high availability and distributed staking</li>
</ul>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Fee Burning</h2>
<p><strong>50% of base network transaction fees</strong> are burned (permanently destroyed), creating deflationary pressure that partially offsets emissions inflation. As network usage grows, the burn rate increases — potentially reducing net inflation or even making XRD deflationary at scale.</p>
<p>This dual mechanism — inflationary emissions for security, deflationary fee burning for value — aims to balance network security incentives with long-term token value.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>External Links</h2>
<ul>
<li><a href="https://learn.radixdlt.com/article/start-here-radix-tokens-and-tokenomics" target="_blank" rel="noopener">Tokens and Tokenomics</a> — Radix Knowledge Base</li>
<li><a href="https://www.radixdlt.com/blog/staking-validating-what-you-need-to-know" target="_blank" rel="noopener">Staking & Validating</a> — Radix Blog</li>
</ul>`
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 7. Component Royalties
  // ─────────────────────────────────────────────
  {
    tagPath: 'contents/tech/core-concepts',
    slug: 'component-royalties',
    title: 'Component Royalties',
    excerpt: 'Protocol-native mechanism allowing developers to earn recurring XRD revenue every time a transaction calls methods on their deployed Blueprints or Components.',
    content: [
      {
        id: uid(), type: 'infobox', blocks: [{
          id: uid(), type: 'content',
          text: `<table><tbody>
<tr><td colspan="2"><strong>Component Royalties</strong></td></tr>
<tr><td>Type</td><td>Developer incentive mechanism</td></tr>
<tr><td>Denominations</td><td>XRD or approximate USD</td></tr>
<tr><td>Scope</td><td>Per-function / per-method</td></tr>
<tr><td>Mutability</td><td>Lockable or updatable</td></tr>
<tr><td>Documentation</td><td><a href="https://docs.radixdlt.com/docs/using-royalties" target="_blank" rel="noopener">Radix Docs</a></td></tr>
</tbody></table>`
        }]
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Introduction</h2>
<p><strong>Component Royalties</strong> are an on-ledger, protocol-native mechanism that allows developers to earn recurring <a href="/contents/tech/core-protocols/xrd-token" rel="noopener">XRD</a> revenue every time a transaction interacts with their deployed <a href="/contents/tech/core-concepts/blueprints-and-packages" rel="noopener">Blueprints or Components</a>. Unlike grant programs or one-time funding, royalties scale with ecosystem usage and are enforced by the protocol itself.</p>
<p>This creates a sustainable <a href="https://learn.radixdlt.com/article/what-is-the-radix-developer-royalties-system" target="_blank" rel="noopener">developer incentive system</a> where building widely-used infrastructure is directly rewarded — every piece of code that contributes to a transaction can earn its share.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>How Royalties Work</h2>
<p>Developers set royalty amounts on individual functions (Blueprint-level) and methods (Component-level). Royalties are charged as part of the transaction fee whenever that function or method is called.</p>
<p>Royalties can be denominated in:</p>
<ul>
<li><strong>XRD</strong> — a fixed amount per call (e.g., 1 XRD)</li>
<li><strong>Approximate USD</strong> — a dollar-equivalent amount (e.g., $0.05 per call), where the protocol uses a constant multiplier to convert USD to XRD at execution time</li>
<li><strong>Free</strong> — no royalty charged</li>
</ul>
<p>A single DeFi transaction that involves multiple Components — say a DEX, a lending pool, and an oracle — pays royalties to each Component's developer. Revenue grows linearly with transaction volume.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Mutability & Trust</h2>
<p>Royalties can be marked as <strong>locked</strong> (immutable forever) or <strong>updatable</strong> (the developer can change or later lock them). Locked royalties provide certainty to users and integrators that fees will not increase. Updatable royalties may discourage usage, since the developer could raise fees unpredictably.</p>
<p>This opt-in model means developers must balance revenue aspirations against user trust — locking royalties at launch signals commitment, while keeping them updatable provides flexibility.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>External Links</h2>
<ul>
<li><a href="https://docs.radixdlt.com/docs/using-royalties" target="_blank" rel="noopener">Using Royalties</a> — Radix Documentation</li>
<li><a href="https://learn.radixdlt.com/article/what-is-the-radix-developer-royalties-system" target="_blank" rel="noopener">Developer Royalties System</a> — Radix Knowledge Base</li>
<li><a href="https://radixdlt.medium.com/on-ledger-recurring-developer-revenue-incentives-to-buidl-bfc0ba03dd1b" target="_blank" rel="noopener">On-Ledger Recurring Developer Revenue</a> — Radix Medium</li>
</ul>`
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 8. Byzantine Fault Tolerance
  // ─────────────────────────────────────────────
  {
    tagPath: 'contents/tech/core-concepts',
    slug: 'byzantine-fault-tolerance',
    title: 'Byzantine Fault Tolerance',
    excerpt: 'The ability of a distributed system to reach consensus correctly even when up to one-third of participants are faulty or malicious, as implemented through Cerberus on Radix.',
    content: [
      {
        id: uid(), type: 'infobox', blocks: [{
          id: uid(), type: 'content',
          text: `<table><tbody>
<tr><td colspan="2"><strong>Byzantine Fault Tolerance</strong></td></tr>
<tr><td>Origin</td><td><a href="https://en.wikipedia.org/wiki/Byzantine_fault" target="_blank" rel="noopener">Byzantine Generals Problem</a> (1982)</td></tr>
<tr><td>Threshold</td><td>Tolerates &lt; 1/3 faulty nodes</td></tr>
<tr><td>Radix Implementation</td><td><a href="/contents/tech/core-protocols/cerberus-consensus-protocol" rel="noopener">Cerberus</a></td></tr>
<tr><td>Whitepaper</td><td><a href="https://arxiv.org/pdf/2008.04450" target="_blank" rel="noopener">arXiv:2008.04450</a></td></tr>
</tbody></table>`
        }]
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Introduction</h2>
<p><strong>Byzantine Fault Tolerance (BFT)</strong> is the ability of a distributed system to reach consensus correctly even when up to one-third of participating nodes are faulty or malicious. The term originates from the <a href="https://en.wikipedia.org/wiki/Byzantine_fault" target="_blank" rel="noopener">Byzantine Generals Problem</a>, a thought experiment by Lamport, Shostak, and Pease (1982) about coordinating action among parties who may include traitors.</p>
<p>In blockchain systems, BFT ensures that the network can agree on the state of the ledger even if some validators are offline, sending conflicting messages, or actively attempting to disrupt consensus. BFT protocols guarantee safety (no incorrect state) as long as fewer than 1/3 of participants are Byzantine.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Classical BFT and Its Limitations</h2>
<p>Classical BFT protocols like <a href="https://en.wikipedia.org/wiki/Practical_Byzantine_fault_tolerance" target="_blank" rel="noopener">PBFT</a> (Practical Byzantine Fault Tolerance) run a single consensus pipeline where 2/3+ of validators must agree. While provably secure, this creates a throughput bottleneck — all transactions flow through one pipeline, and the communication complexity grows quadratically with the number of validators (O(n²)).</p>
<p>This is the core tension in blockchain design: proven BFT security comes at the cost of limited throughput. Many Layer-1 blockchains "solve" this by reducing the validator count or using probabilistic finality, trading security for performance.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Cerberus: Parallelised BFT</h2>
<p>Radix's <a href="/contents/tech/core-protocols/cerberus-consensus-protocol" rel="noopener">Cerberus protocol</a> takes a different approach: it takes a proven single-pipe BFT consensus process and parallelises it across a practically unlimited number of <a href="/contents/tech/core-concepts/sharding" rel="noopener">shards</a>. Each shard runs its own local BFT consensus to order transactions on its substates.</p>
<p>When a transaction touches state on multiple shards, Cerberus "braids" consensus across those shards using an atomic commitment protocol. This ensures that either all shards commit the transaction or none do — preserving <a href="/contents/tech/core-concepts/atomic-composability" rel="noopener">atomic composability</a> across the entire network.</p>
<p>This design provides <strong>linear scalability</strong>: throughput increases proportionally as more nodes and shards are added. The <a href="https://arxiv.org/pdf/2008.04450" target="_blank" rel="noopener">Cerberus whitepaper</a> demonstrated that the protocol can handle millions of transactions per second in simulation, outperforming other sharded consensus approaches while maintaining the full security guarantees of classical BFT.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>External Links</h2>
<ul>
<li><a href="https://en.wikipedia.org/wiki/Byzantine_fault" target="_blank" rel="noopener">Byzantine Fault</a> — Wikipedia</li>
<li><a href="https://learn.radixdlt.com/article/what-is-cerberus" target="_blank" rel="noopener">What is Cerberus?</a> — Radix Knowledge Base</li>
<li><a href="https://arxiv.org/pdf/2008.04450" target="_blank" rel="noopener">Cerberus Whitepaper</a> — arXiv</li>
</ul>`
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 9. Substate Model
  // ─────────────────────────────────────────────
  {
    tagPath: 'contents/tech/core-concepts',
    slug: 'substate-model',
    title: 'Substate Model',
    excerpt: 'Radix\'s state architecture where all ledger state is decomposed into discrete, typed records called substates, enabling parallelised consensus across shards.',
    content: [
      {
        id: uid(), type: 'infobox', blocks: [{
          id: uid(), type: 'content',
          text: `<table><tbody>
<tr><td colspan="2"><strong>Substate Model</strong></td></tr>
<tr><td>Category</td><td>State storage architecture</td></tr>
<tr><td>Enforced by</td><td><a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix Engine</a> FSM</td></tr>
<tr><td>Comparison</td><td>Hybrid of UTXO + Account models</td></tr>
<tr><td>Consensus</td><td><a href="/contents/tech/core-protocols/cerberus-consensus-protocol" rel="noopener">Cerberus</a> (per-shard)</td></tr>
<tr><td>Reference</td><td><a href="https://www.radixdlt.com/blog/how-radix-engine-is-designed-to-scale-dapps" target="_blank" rel="noopener">Radix Blog</a></td></tr>
</tbody></table>`
        }]
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Introduction</h2>
<p>The <strong>Substate Model</strong> is Radix's state storage architecture where all ledger state is decomposed into discrete, typed records called <strong>substates</strong>. Each substate is subject to specific rules enforced by the <a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix Engine</a>'s <a href="/contents/tech/core-concepts/finite-state-machines" rel="noopener">finite state machine</a> constraint model. This architecture combines properties of both the <a href="/contents/tech/core-concepts/unspent-transaction-output-utxo-model" rel="noopener">UTXO</a> and account models while enabling parallelised consensus.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Structure</h2>
<p>The Radix Engine state model is structured as a <strong>forest of state sub-trees</strong>. Each sub-tree consists of entities (identified by unique addresses) that have zero or more substates at keyed positions. Substates are typed — for example, a token balance substate tracks ownership and enforces conservation (if tokens leave Alice, they must arrive at Bob).</p>
<p>Entities can own other entities, forming ownership trees. A Component entity might own multiple Vault entities, each containing resource substates. This hierarchical structure maps naturally to <a href="/contents/tech/core-concepts/sharding" rel="noopener">shards</a> — each Component's state can reside on a dedicated shard with full throughput.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Comparison to Other Models</h2>
<h3>vs. UTXO (Bitcoin, Cardano)</h3>
<p>Like Bitcoin's UTXO model, Radix transactions specify substates as inputs. However, unlike pure UTXO where transactions must reference specific UTXOs (causing contention when multiple transactions target the same UTXO), Radix transactions express <strong>intent</strong> rather than specific substates. The Radix Engine resolves which substates satisfy the intent at execution time.</p>
<p>This is significant: on Cardano, the first DEX (<a href="https://en.wikipedia.org/wiki/SundaeSwap" target="_blank" rel="noopener">SundaeSwap</a>) experienced severe contention because multiple users tried to consume the same UTXOs. Radix's intent-based approach avoids this entirely.</p>
<h3>vs. Account Model (Ethereum)</h3>
<p>Unlike Ethereum where all token state lives inside a single contract's storage, Radix distributes state across substates assignable to different shards. This eliminates single-contract bottlenecks — on Ethereum, every Uniswap trade goes through one contract's state, creating a serialisation point that limits throughput.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>External Links</h2>
<ul>
<li><a href="https://www.radixdlt.com/blog/how-radix-engine-is-designed-to-scale-dapps" target="_blank" rel="noopener">How Radix Engine is Designed to Scale dApps</a> — Radix Blog</li>
<li><a href="https://learn.radixdlt.com/article/what-is-radix-engine" target="_blank" rel="noopener">What is Radix Engine?</a> — Radix Knowledge Base</li>
</ul>`
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 10. Liquid Stake Units (LSUs)
  // ─────────────────────────────────────────────
  {
    tagPath: 'contents/tech/core-concepts',
    slug: 'liquid-stake-units',
    title: 'Liquid Stake Units (LSUs)',
    excerpt: 'Fungible tokens representing staked XRD positions that can be freely traded or used as DeFi collateral while the underlying XRD continues earning staking rewards.',
    content: [
      {
        id: uid(), type: 'infobox', blocks: [{
          id: uid(), type: 'content',
          text: `<table><tbody>
<tr><td colspan="2"><strong>Liquid Stake Units (LSUs)</strong></td></tr>
<tr><td>Type</td><td>Fungible resource token</td></tr>
<tr><td>Issued by</td><td>Validator Components</td></tr>
<tr><td>Backed by</td><td>Staked XRD + accrued emissions</td></tr>
<tr><td>Tradeable</td><td>Yes (native Radix resource)</td></tr>
<tr><td>Unstaking Delay</td><td>~2,016 epochs (~2 weeks)</td></tr>
<tr><td>Dashboard</td><td><a href="https://dashboard.radixdlt.com/network-staking" target="_blank" rel="noopener">Radix Dashboard</a></td></tr>
</tbody></table>`
        }]
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Introduction</h2>
<p><strong>Liquid Stake Units (LSUs)</strong> are fungible tokens issued by <a href="/contents/tech/core-concepts/validator-nodes" rel="noopener">Validator</a> Components when XRD is staked. Each validator issues its own unique LSU resource, representing a proportional claim on the validator's total staked XRD plus accrued <a href="/contents/tech/core-concepts/network-emissions" rel="noopener">emissions</a> rewards.</p>
<p>Unlike traditional staking models where staked tokens are locked and illiquid, LSUs are standard Radix <a href="/contents/tech/core-concepts/asset-oriented-programming" rel="noopener">resources</a> that can be freely transferred, traded on DEXes, or used as collateral in DeFi protocols — all while the underlying XRD continues earning staking rewards.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>How LSUs Work</h2>
<p>When a user stakes XRD to a validator, the Validator Component mints LSU tokens and deposits them into the user's account. The exchange rate between LSU and XRD increases over time as emissions rewards accrue. For example, if 1 LSU was initially worth 1 XRD, after a period of emissions it might be worth 1.05 XRD — the protocol auto-compounds rewards by increasing the redemption value.</p>
<p>To unstake, a user returns their LSUs to the Validator Component, which burns them and initiates an unstaking delay of approximately 2,016 epochs (~2 weeks). After the delay, the user receives their proportional share of XRD.</p>
<h3>DeFi Composability</h3>
<p>Because LSUs are standard resources, they integrate natively with the Radix DeFi ecosystem:</p>
<ul>
<li><strong>DEX trading</strong> — LSUs can be swapped on <a href="/ecosystem/ociswap" rel="noopener">Ociswap</a>, <a href="/ecosystem/caviarnine" rel="noopener">CaviarNine</a>, and other DEXes</li>
<li><strong>Lending collateral</strong> — protocols like <a href="/ecosystem/weft-finance" rel="noopener">Weft Finance</a> accept LSUs as collateral</li>
<li><strong>Liquidity provision</strong> — LSU/XRD pools allow liquid staking liquidity</li>
</ul>
<p>This composability means stakers no longer face a binary choice between earning staking rewards and participating in DeFi.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>External Links</h2>
<ul>
<li><a href="https://learn.radixdlt.com/article/start-here-radix-tokens-and-tokenomics" target="_blank" rel="noopener">Tokens and Tokenomics</a> — Radix Knowledge Base</li>
<li><a href="https://dashboard.radixdlt.com/network-staking" target="_blank" rel="noopener">Network Staking Dashboard</a> — Radix Dashboard</li>
<li><a href="https://www.radixdlt.com/blog/staking-validating-what-you-need-to-know" target="_blank" rel="noopener">Staking & Validating</a> — Radix Blog</li>
</ul>`
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 11. Radix Gateway API (core-protocols)
  // ─────────────────────────────────────────────
  {
    tagPath: 'contents/tech/core-protocols',
    slug: 'radix-gateway-api',
    title: 'Radix Gateway API',
    excerpt: 'JSON-based HTTP API enabling dApps, wallets, and explorers to query ledger state, submit transactions, and stream network activity without running a full node.',
    content: [
      {
        id: uid(), type: 'infobox', blocks: [{
          id: uid(), type: 'content',
          text: `<table><tbody>
<tr><td colspan="2"><strong>Radix Gateway API</strong></td></tr>
<tr><td>Type</td><td>JSON HTTP API</td></tr>
<tr><td>Current Version</td><td>v1.10.4</td></tr>
<tr><td>Protocol</td><td>HTTP POST (all endpoints)</td></tr>
<tr><td>SDK</td><td><a href="https://www.npmjs.com/package/@radixdlt/babylon-gateway-api-sdk" target="_blank" rel="noopener">@radixdlt/babylon-gateway-api-sdk</a></td></tr>
<tr><td>API Reference</td><td><a href="https://radix-babylon-gateway-api.redoc.ly/" target="_blank" rel="noopener">Redoc Documentation</a></td></tr>
<tr><td>Source Code</td><td><a href="https://github.com/radixdlt/babylon-gateway" target="_blank" rel="noopener">GitHub</a></td></tr>
</tbody></table>`
        }]
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Introduction</h2>
<p>The <strong>Radix Gateway API</strong> is a JSON-based HTTP API layer exposed by the Babylon Radix Gateway that enables dApp frontends, <a href="/contents/tech/core-protocols/radix-wallet" rel="noopener">wallets</a>, and explorers to efficiently query current and historical ledger state, submit transactions, and stream network activity — all without running a full node.</p>
<p>The Gateway sits between dApp clients and the <a href="/contents/tech/core-protocols/radix-core-api" rel="noopener">Radix Core API</a> (which communicates directly with <a href="/contents/tech/core-concepts/validator-nodes" rel="noopener">validator nodes</a>), providing a developer-friendly abstraction layer with features like cursor-based pagination, historical state browsing, and consistent reads.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>API Groups</h2>
<p>The Gateway API is organised into five main groups, all using HTTP POST:</p>
<ol>
<li><strong>Status</strong> (<code>/status/*</code>) — gateway and network configuration, health checks</li>
<li><strong>Transaction</strong> (<code>/transaction/*</code>) — construction metadata, preview (dry-run), submission, and status tracking</li>
<li><strong>Stream</strong> (<code>/stream/*</code>) — read committed transactions with filters (by account, resource, badge, event type, manifest class)</li>
<li><strong>State</strong> (<code>/state/*</code>) — query current and historical entity state (accounts, components, resources, validators, key-value stores, NFT data)</li>
<li><strong>Statistics</strong> (<code>/statistics/*</code>) — network statistics, validator uptime</li>
</ol>
<p>Additional <strong>Extensions</strong> endpoints provide specialised queries like resource holder lists and role requirement lookups.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Developer Usage</h2>
<p>Most Radix dApp developers interact with the Gateway through the <a href="https://www.npmjs.com/package/@radixdlt/babylon-gateway-api-sdk" target="_blank" rel="noopener">TypeScript SDK</a>. If using the <a href="/contents/tech/core-protocols/radix-connect" rel="noopener">Radix dApp Toolkit</a>, the Gateway SDK is already integrated and does not need separate import.</p>
<p>Key features for developers:</p>
<ul>
<li><strong>Historical state</strong> — browse entity state at any past ledger version via <code>at_ledger_state</code></li>
<li><strong>Consistent reads</strong> — pin multiple queries to the same ledger version snapshot</li>
<li><strong>Opt-in properties</strong> — reduce bandwidth by requesting only needed fields</li>
<li><strong>Transaction preview</strong> — dry-run manifests before submission to check outcomes</li>
</ul>
<h3>Providers</h3>
<p>The official Radix gateway is the primary provider, but third-party services including RadixAPI and NowNodes also offer Gateway API access for redundancy and geographic distribution.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>External Links</h2>
<ul>
<li><a href="https://radix-babylon-gateway-api.redoc.ly/" target="_blank" rel="noopener">Gateway API Reference</a> — Redoc Documentation</li>
<li><a href="https://docs.radixdlt.com/docs/gateway-sdk" target="_blank" rel="noopener">Gateway SDK</a> — Radix Documentation</li>
<li><a href="https://docs.radixdlt.com/docs/network-apis" target="_blank" rel="noopener">Network APIs</a> — Radix Documentation</li>
<li><a href="https://github.com/radixdlt/babylon-gateway" target="_blank" rel="noopener">babylon-gateway</a> — GitHub Repository</li>
</ul>`
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 12. Radix Core API (core-protocols)
  // ─────────────────────────────────────────────
  {
    tagPath: 'contents/tech/core-protocols',
    slug: 'radix-core-api',
    title: 'Radix Core API',
    excerpt: 'Low-level API exposed directly by Radix full nodes for raw ledger access, transaction construction, and node management — primarily used by infrastructure operators.',
    content: [
      {
        id: uid(), type: 'infobox', blocks: [{
          id: uid(), type: 'content',
          text: `<table><tbody>
<tr><td colspan="2"><strong>Radix Core API</strong></td></tr>
<tr><td>Type</td><td>Low-level node API</td></tr>
<tr><td>Exposed by</td><td>Radix full nodes</td></tr>
<tr><td>Audience</td><td>Infrastructure operators, Gateway providers</td></tr>
<tr><td>Higher-level</td><td><a href="/contents/tech/core-protocols/radix-gateway-api" rel="noopener">Radix Gateway API</a></td></tr>
<tr><td>Documentation</td><td><a href="https://docs.radixdlt.com/docs/network-apis" target="_blank" rel="noopener">Radix Docs</a></td></tr>
</tbody></table>`
        }]
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Introduction</h2>
<p>The <strong>Radix Core API</strong> is a low-level API exposed directly by Radix full nodes, providing raw access to ledger state, transaction submission, consensus status, and node management. Unlike the <a href="/contents/tech/core-protocols/radix-gateway-api" rel="noopener">Gateway API</a> which is designed for dApp developers, the Core API is primarily used by infrastructure operators, Gateway providers, and tools that need direct node communication.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Architecture</h2>
<p>The Core API runs on every Radix full node and provides the lowest-level programmatic access to the network. The <a href="/contents/tech/core-protocols/radix-gateway-api" rel="noopener">Gateway API</a> is built on top of the Core API — it ingests data from Core API endpoints, indexes it into a PostgreSQL database, and exposes a higher-level query interface.</p>
<p>Key capabilities:</p>
<ul>
<li><strong>Raw ledger streaming</strong> — access committed transactions as they are finalised</li>
<li><strong>Transaction construction</strong> — low-level transaction building and submission</li>
<li><strong>Mempool inspection</strong> — view pending transactions</li>
<li><strong>Node status</strong> — consensus health, sync status, peer information</li>
<li><strong>State queries</strong> — direct access to the <a href="/contents/tech/core-concepts/substate-model" rel="noopener">Substate Model</a></li>
</ul>
<p>Most dApp developers should use the <a href="/contents/tech/core-protocols/radix-gateway-api" rel="noopener">Gateway API</a> or the <a href="https://docs.radixdlt.com/docs/gateway-sdk" target="_blank" rel="noopener">TypeScript SDK</a> rather than the Core API directly, as the Gateway provides pagination, indexing, and a more convenient query model.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>External Links</h2>
<ul>
<li><a href="https://docs.radixdlt.com/docs/network-apis" target="_blank" rel="noopener">Network APIs</a> — Radix Documentation</li>
<li><a href="https://github.com/radixdlt/babylon-node" target="_blank" rel="noopener">babylon-node</a> — GitHub Repository</li>
</ul>`
      },
    ],
  },
];

// ─────────────────────────────────────────────
// Database insertion
// ─────────────────────────────────────────────

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  ssl: { rejectUnauthorized: false },
});

const client = await pool.connect();

try {
  let inserted = 0;
  let skipped = 0;

  for (const page of pages) {
    const existing = await client.query(
      'SELECT id FROM pages WHERE tag_path = $1 AND slug = $2',
      [page.tagPath, page.slug]
    );

    if (existing.rows.length > 0) {
      console.log(`SKIP: ${page.tagPath}/${page.slug} (already exists)`);
      skipped++;
      continue;
    }

    const pageId = uid();
    const revisionId = uid();
    const now = new Date().toISOString();
    const contentJson = JSON.stringify(page.content);

    await client.query('BEGIN');

    await client.query(
      `INSERT INTO pages (id, slug, title, content, excerpt, tag_path, metadata, version, author_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, '{}'::jsonb, '1.0.0', $7, $8, $8)`,
      [pageId, page.slug, page.title, contentJson, page.excerpt, page.tagPath, AUTHOR_ID, now]
    );

    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, changes, author_id, message, created_at)
       VALUES ($1, $2, $3::jsonb, $4, '1.0.0', 'major', '[]'::jsonb, $5, 'Initial version', $6)`,
      [revisionId, pageId, contentJson, page.title, AUTHOR_ID, now]
    );

    await client.query('COMMIT');
    console.log(`INSERT: ${page.tagPath}/${page.slug}`);
    inserted++;
  }

  console.log(`\nDone: ${inserted} inserted, ${skipped} skipped`);
} catch (err) {
  await client.query('ROLLBACK');
  console.error('Error:', err);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
