// scripts/seed-comparisons.mjs
// Batch seed script for technology comparison wiki pages
import pg from 'pg';
import { randomUUID } from 'crypto';
import { config } from 'dotenv';

config();

const uid = () => randomUUID();
const AUTHOR_ID = 'cmk5t48vx0000005zc5se4dqz'; // Hydrate

const pages = [
  // ─────────────────────────────────────────────
  // 1. Radix vs Ethereum
  // ─────────────────────────────────────────────
  {
    tagPath: 'contents/tech/comparisons',
    slug: 'radix-vs-ethereum',
    title: 'Radix vs Ethereum',
    excerpt: 'Technical comparison of Radix and Ethereum across consensus, smart contracts, state model, scalability, and developer experience.',
    content: [
      {
        id: uid(), type: 'infobox', blocks: [{
          id: uid(), type: 'content',
          text: `<table><tbody>
<tr><td colspan="2"><strong>Radix vs Ethereum</strong></td></tr>
<tr><td>Category</td><td>Layer-1 Comparison</td></tr>
<tr><td>Radix Consensus</td><td><a href="/contents/tech/core-protocols/cerberus-consensus-protocol" rel="noopener">Cerberus</a> (parallelised BFT)</td></tr>
<tr><td>Ethereum Consensus</td><td><a href="https://ethereum.org/en/developers/docs/consensus-mechanisms/pos/" target="_blank" rel="noopener">Gasper</a> (PoS + Casper FFG)</td></tr>
<tr><td>Radix VM</td><td><a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix Engine</a> (WASM)</td></tr>
<tr><td>Ethereum VM</td><td><a href="https://ethereum.org/en/developers/docs/evm/" target="_blank" rel="noopener">EVM</a> (bytecode)</td></tr>
</tbody></table>`
        }]
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Introduction</h2>
<p><a href="https://ethereum.org/" target="_blank" rel="noopener">Ethereum</a> is the most widely adopted smart contract platform, with the largest ecosystem of dApps, developers, and total value locked. <a href="https://www.radixdlt.com/" target="_blank" rel="noopener">Radix</a> is a purpose-built DeFi platform designed to address Ethereum's limitations in scalability, security, and developer experience. This article compares their architectures objectively.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Smart Contract Model</h2>
<h3>Ethereum: EVM + Solidity</h3>
<p>Ethereum uses the <a href="https://ethereum.org/en/developers/docs/evm/" target="_blank" rel="noopener">Ethereum Virtual Machine (EVM)</a> executing Solidity bytecode. Tokens are implemented as smart contracts (ERC-20, ERC-721) — a token is fundamentally a mapping of balances inside a contract's storage. This design has enabled massive innovation but also produces well-known vulnerabilities: reentrancy attacks, approval exploits (<code>approve</code>/<code>transferFrom</code>), and accidental token loss from sending to contracts without withdrawal functions.</p>
<h3>Radix: Radix Engine + Scrypto</h3>
<p>Radix uses the <a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix Engine</a> executing <a href="/contents/tech/core-protocols/scrypto-programming-language" rel="noopener">Scrypto</a> (compiled to WebAssembly). Assets are <a href="/contents/tech/core-concepts/asset-oriented-programming" rel="noopener">native platform primitives</a> that behave like physical objects — they cannot be copied, accidentally destroyed, or lost. Reentrancy is impossible by design, and there is no approval pattern. The engine enforces resource conservation at the platform level.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>State Model & Scalability</h2>
<h3>Ethereum: Account Model + L2 Rollups</h3>
<p>Ethereum uses a global account model where every transaction can potentially touch any contract's state. This requires <a href="https://www.radixdlt.com/blog/how-radix-engine-is-designed-to-scale-dapps" target="_blank" rel="noopener">total global ordering</a> of all transactions, creating a fundamental throughput bottleneck (~15 TPS on L1). Ethereum's scaling strategy relies on Layer-2 rollups (Optimistic and ZK) that process transactions off-chain and post proofs to L1, fragmenting liquidity and composability across L2s.</p>
<h3>Radix: Substate Model + Native Sharding</h3>
<p>Radix uses a <a href="/contents/tech/core-concepts/substate-model" rel="noopener">substate model</a> where state is decomposed into discrete records mapped to <a href="/contents/tech/core-concepts/sharding" rel="noopener">shards</a>. Transactions specify which substates they need via <a href="/contents/tech/core-protocols/transaction-manifests" rel="noopener">intent-based manifests</a>, enabling parallel processing. <a href="/contents/tech/core-protocols/cerberus-consensus-protocol" rel="noopener">Cerberus</a> "braids" consensus across shards only when needed, providing <a href="https://learn.radixdlt.com/article/what-is-cerberus" target="_blank" rel="noopener">linear scalability</a> while preserving <a href="/contents/tech/core-concepts/atomic-composability" rel="noopener">atomic composability</a> — no fragmentation.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Accounts & Transactions</h2>
<h3>Accounts</h3>
<p>Ethereum has two account types: Externally Owned Accounts (EOAs) controlled by private keys and smart contract accounts. <a href="https://eips.ethereum.org/EIPS/eip-4337" target="_blank" rel="noopener">ERC-4337</a> adds account abstraction via UserOperations, a separate mempool, Bundler nodes, and an EntryPoint contract — <a href="https://www.radixdlt.com/blog/comparing-account-abstraction-and-radix-smart-accounts" target="_blank" rel="noopener">significant additional complexity</a>. On Radix, every account is natively a <a href="/contents/tech/core-protocols/smart-accounts" rel="noopener">Smart Account</a> Component with built-in multi-factor auth, social recovery, and configurable deposit rules.</p>
<h3>Transactions</h3>
<p>Ethereum transactions contain opaque calldata that wallets cannot meaningfully display to users — users sign data they cannot understand. Radix <a href="/contents/tech/core-protocols/transaction-manifests" rel="noopener">Transaction Manifests</a> are human-readable instruction scripts that the <a href="/contents/tech/core-protocols/radix-wallet" rel="noopener">Radix Wallet</a> can parse and display, showing users exactly what a transaction will do before they sign.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Ecosystem & Maturity</h2>
<p>Ethereum has clear advantages in ecosystem size: thousands of dApps, hundreds of thousands of developers, and hundreds of billions in TVL. Its EVM has become the de facto standard, supported by major L2s (Arbitrum, Optimism, Base, zkSync), tooling (Hardhat, Foundry, OpenZeppelin), and institutional adoption.</p>
<p>Radix's ecosystem is significantly smaller but growing. Its advantage lies in architectural design — purpose-built for DeFi rather than retrofitted — with fewer smart contract vulnerabilities by design and a developer experience that <a href="https://docs.radixdlt.com/docs/blueprints-and-components" target="_blank" rel="noopener">reduces complexity</a> for financial applications. The trade-off is a smaller developer community, fewer tools, and less battle-tested infrastructure.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>External Links</h2>
<ul>
<li><a href="https://www.radixdlt.com/blog/comparing-account-abstraction-and-radix-smart-accounts" target="_blank" rel="noopener">Comparing Account Abstraction and Radix Smart Accounts</a> — Radix Blog</li>
<li><a href="https://www.radixdlt.com/blog/how-radix-engine-is-designed-to-scale-dapps" target="_blank" rel="noopener">How Radix Engine is Designed to Scale dApps</a> — Radix Blog</li>
<li><a href="https://ethereum.org/en/developers/docs/" target="_blank" rel="noopener">Ethereum Developer Documentation</a></li>
</ul>`
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 2. Radix vs Solana
  // ─────────────────────────────────────────────
  {
    tagPath: 'contents/tech/comparisons',
    slug: 'radix-vs-solana',
    title: 'Radix vs Solana',
    excerpt: 'Technical comparison of Radix and Solana covering consensus, programming model, scalability architecture, and reliability.',
    content: [
      {
        id: uid(), type: 'infobox', blocks: [{
          id: uid(), type: 'content',
          text: `<table><tbody>
<tr><td colspan="2"><strong>Radix vs Solana</strong></td></tr>
<tr><td>Category</td><td>Layer-1 Comparison</td></tr>
<tr><td>Radix Consensus</td><td><a href="/contents/tech/core-protocols/cerberus-consensus-protocol" rel="noopener">Cerberus</a> (parallelised BFT)</td></tr>
<tr><td>Solana Consensus</td><td><a href="https://solana.com/docs/intro/consensus" target="_blank" rel="noopener">Tower BFT + Proof of History</a></td></tr>
<tr><td>Radix Language</td><td><a href="/contents/tech/core-protocols/scrypto-programming-language" rel="noopener">Scrypto</a> (Rust-based)</td></tr>
<tr><td>Solana Language</td><td><a href="https://www.anchor-lang.com/" target="_blank" rel="noopener">Rust / Anchor</a></td></tr>
</tbody></table>`
        }]
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Introduction</h2>
<p><a href="https://solana.com/" target="_blank" rel="noopener">Solana</a> is a high-throughput Layer-1 blockchain that achieves speed through a single-shard, highly optimised architecture. <a href="https://www.radixdlt.com/" target="_blank" rel="noopener">Radix</a> targets similar performance goals through multi-shard parallelism. Both prioritise DeFi use cases, but their architectural approaches differ fundamentally.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Consensus & Architecture</h2>
<h3>Solana: Single-Shard High Throughput</h3>
<p>Solana uses <a href="https://solana.com/docs/intro/consensus" target="_blank" rel="noopener">Tower BFT</a> (a PBFT variant) combined with <strong>Proof of History (PoH)</strong> — a verifiable delay function that creates a historical record proving events occurred at specific points in time. This eliminates the need for validators to communicate timestamps, reducing consensus overhead. Solana processes transactions on a single shard at ~4,000 TPS (theoretical max ~65,000), achieving 400ms block times.</p>
<h3>Radix: Multi-Shard Parallelism</h3>
<p><a href="/contents/tech/core-protocols/cerberus-consensus-protocol" rel="noopener">Cerberus</a> parallelises a proven BFT process across practically unlimited <a href="/contents/tech/core-concepts/sharding" rel="noopener">shards</a>. Rather than optimising a single pipeline, it runs many pipelines in parallel and "braids" them together only for cross-shard transactions. This provides <a href="https://learn.radixdlt.com/article/what-is-cerberus" target="_blank" rel="noopener">linear scalability</a> — throughput grows with nodes — versus Solana's fixed throughput ceiling.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Programming Model</h2>
<p>Both platforms use Rust-based languages, but the paradigms diverge. Solana programs (smart contracts) use raw Rust or the <a href="https://www.anchor-lang.com/" target="_blank" rel="noopener">Anchor framework</a>. Programs operate on accounts — data containers owned by programs — in a model where tokens are entries in program-owned accounts (SPL Token standard). Developers must manage account sizing, rent, and manual serialisation.</p>
<p>Scrypto uses <a href="/contents/tech/core-concepts/asset-oriented-programming" rel="noopener">Asset-Oriented Programming</a> where resources are native engine primitives. Tokens are not entries in account data — they are physical-like objects managed by the engine. This eliminates entire vulnerability classes (reentrancy, approval exploits) and removes the need for manual account management.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Reliability</h2>
<p>Solana has experienced multiple network outages since launch, with the network halting entirely several times. These incidents stem from the single-shard architecture — when the leader validator or critical infrastructure is overwhelmed, the entire network stalls.</p>
<p>Radix's multi-shard design mitigates this risk: individual shard disruptions do not halt the entire network. However, Radix's full sharded consensus (Xi'an) has not yet been deployed to mainnet, so a direct reliability comparison at scale is premature.</p>
<h3>Trade-offs</h3>
<p>Solana's strengths include a mature, battle-tested ecosystem with significant DeFi TVL, a large developer community, and proven high throughput. Its weaknesses are the throughput ceiling, reliability concerns, and complex programming model. Radix offers superior developer ergonomics and theoretical scalability but has a smaller ecosystem and has not yet proven its sharded architecture at mainnet scale.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>External Links</h2>
<ul>
<li><a href="https://solana.com/docs" target="_blank" rel="noopener">Solana Documentation</a></li>
<li><a href="https://learn.radixdlt.com/article/what-is-cerberus" target="_blank" rel="noopener">What is Cerberus?</a> — Radix Knowledge Base</li>
<li><a href="https://arxiv.org/pdf/2008.04450" target="_blank" rel="noopener">Cerberus Whitepaper</a> — arXiv</li>
</ul>`
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 3. Radix vs Cosmos
  // ─────────────────────────────────────────────
  {
    tagPath: 'contents/tech/comparisons',
    slug: 'radix-vs-cosmos',
    title: 'Radix vs Cosmos',
    excerpt: 'Technical comparison of Radix\'s sharded single-network approach and Cosmos\'s app-chain architecture with IBC interoperability.',
    content: [
      {
        id: uid(), type: 'infobox', blocks: [{
          id: uid(), type: 'content',
          text: `<table><tbody>
<tr><td colspan="2"><strong>Radix vs Cosmos</strong></td></tr>
<tr><td>Category</td><td>Layer-1 Comparison</td></tr>
<tr><td>Radix Model</td><td>Single sharded network</td></tr>
<tr><td>Cosmos Model</td><td>Sovereign app-chains + <a href="https://ibcprotocol.dev/" target="_blank" rel="noopener">IBC</a></td></tr>
<tr><td>Radix Consensus</td><td><a href="/contents/tech/core-protocols/cerberus-consensus-protocol" rel="noopener">Cerberus</a></td></tr>
<tr><td>Cosmos Consensus</td><td><a href="https://docs.cometbft.com/" target="_blank" rel="noopener">CometBFT</a> (Tendermint)</td></tr>
</tbody></table>`
        }]
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Introduction</h2>
<p><a href="https://cosmos.network/" target="_blank" rel="noopener">Cosmos</a> pioneered the multi-chain thesis — a network of sovereign, application-specific blockchains connected via the <a href="https://ibcprotocol.dev/" target="_blank" rel="noopener">Inter-Blockchain Communication (IBC)</a> protocol. Radix takes the opposite approach: a single network with native <a href="/contents/tech/core-concepts/sharding" rel="noopener">sharding</a> and <a href="/contents/tech/core-concepts/atomic-composability" rel="noopener">atomic composability</a>. Both aim to solve scalability, but their philosophies differ fundamentally.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Architecture</h2>
<h3>Cosmos: Sovereign App-Chains</h3>
<p>In Cosmos, each application runs on its own blockchain built with the <a href="https://docs.cosmos.network/" target="_blank" rel="noopener">Cosmos SDK</a>. Each chain runs <a href="https://docs.cometbft.com/" target="_blank" rel="noopener">CometBFT</a> (formerly Tendermint) consensus independently, with its own validator set and security guarantees. Cross-chain communication occurs through IBC — an asynchronous message-passing protocol that handles token transfers and data between chains.</p>
<h3>Radix: Single Sharded Network</h3>
<p>Radix operates as one network where all Components share the same <a href="/contents/tech/core-protocols/cerberus-consensus-protocol" rel="noopener">Cerberus</a> consensus and security guarantees. State is distributed across shards via the <a href="/contents/tech/core-concepts/substate-model" rel="noopener">substate model</a>, but all shards participate in a unified consensus process. Cross-shard transactions are atomic — they either fully commit or fully revert across all involved shards.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Composability vs Sovereignty</h2>
<p>The fundamental trade-off is <strong>composability vs sovereignty</strong>:</p>
<ul>
<li><strong>Cosmos</strong> — each chain is sovereign (controls its own security, governance, and tokenomics) but cross-chain interactions are asynchronous. A DEX swap on Osmosis cannot atomically compose with a lending operation on Umee in a single transaction. IBC transfers take seconds to minutes and introduce bridge risk.</li>
<li><strong>Radix</strong> — all Components share security and can atomically compose. A single <a href="/contents/tech/core-protocols/transaction-manifests" rel="noopener">Transaction Manifest</a> can orchestrate operations across any Components on the network. The trade-off is that applications cannot have independent security or consensus parameters.</li>
</ul>
<p>For DeFi specifically, atomic composability is valuable — flash loans, multi-hop swaps, and leveraged positions require atomic execution guarantees that IBC cannot provide.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Developer Experience</h2>
<p>Cosmos SDK uses Go for application logic, with each chain requiring its own validator set, security budget, and operational infrastructure. This creates high barriers for launching new applications but grants complete customisation.</p>
<p>Radix uses <a href="/contents/tech/core-protocols/scrypto-programming-language" rel="noopener">Scrypto</a> (Rust-based) with <a href="/contents/tech/core-concepts/blueprints-and-packages" rel="noopener">Blueprints and Packages</a>. Deploying a new application does not require running validators or bootstrapping security — it inherits the network's full security from day one. This dramatically lowers the barrier to deployment but removes the sovereignty that Cosmos chains provide.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>External Links</h2>
<ul>
<li><a href="https://cosmos.network/" target="_blank" rel="noopener">Cosmos Network</a></li>
<li><a href="https://ibcprotocol.dev/" target="_blank" rel="noopener">IBC Protocol</a></li>
<li><a href="https://learn.radixdlt.com/article/what-is-cerberus" target="_blank" rel="noopener">What is Cerberus?</a> — Radix Knowledge Base</li>
</ul>`
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 4. Radix vs Polkadot
  // ─────────────────────────────────────────────
  {
    tagPath: 'contents/tech/comparisons',
    slug: 'radix-vs-polkadot',
    title: 'Radix vs Polkadot',
    excerpt: 'Technical comparison of Radix\'s sharded architecture and Polkadot\'s relay chain plus parachain model for scalability and interoperability.',
    content: [
      {
        id: uid(), type: 'infobox', blocks: [{
          id: uid(), type: 'content',
          text: `<table><tbody>
<tr><td colspan="2"><strong>Radix vs Polkadot</strong></td></tr>
<tr><td>Category</td><td>Layer-1 Comparison</td></tr>
<tr><td>Radix Model</td><td>Single sharded network</td></tr>
<tr><td>Polkadot Model</td><td>Relay chain + parachains</td></tr>
<tr><td>Radix Consensus</td><td><a href="/contents/tech/core-protocols/cerberus-consensus-protocol" rel="noopener">Cerberus</a></td></tr>
<tr><td>Polkadot Consensus</td><td><a href="https://wiki.polkadot.network/docs/learn-consensus" target="_blank" rel="noopener">BABE + GRANDPA</a></td></tr>
</tbody></table>`
        }]
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Introduction</h2>
<p><a href="https://polkadot.network/" target="_blank" rel="noopener">Polkadot</a> and Radix both address blockchain scalability through parallelism, but via different architectures. Polkadot uses a relay chain that coordinates specialised parachains, while Radix uses a single sharded network with <a href="/contents/tech/core-protocols/cerberus-consensus-protocol" rel="noopener">Cerberus</a> consensus. Both were designed from scratch rather than forked from existing codebases.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Scalability Architecture</h2>
<h3>Polkadot: Relay Chain + Parachains</h3>
<p>Polkadot's <a href="https://wiki.polkadot.network/docs/learn-architecture" target="_blank" rel="noopener">relay chain</a> provides shared security and finalisation. Parachains are independent blockchains built with <a href="https://substrate.io/" target="_blank" rel="noopener">Substrate</a> that run in parallel, producing blocks validated by relay chain validators. Parachain slots are limited (originally ~100), creating artificial scarcity. Cross-parachain communication uses <a href="https://wiki.polkadot.network/docs/learn-xcm" target="_blank" rel="noopener">XCM (Cross-Consensus Messaging)</a> — an asynchronous message format.</p>
<h3>Radix: Unified Sharding</h3>
<p>Radix does not separate execution into discrete chains. Instead, all state lives in a unified <a href="/contents/tech/core-concepts/substate-model" rel="noopener">substate model</a> across practically unlimited shards, all secured by the same Cerberus consensus. There is no slot scarcity — any developer can deploy Components without acquiring parachain slots or paying auction fees.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Cross-Shard Composability</h2>
<p>Both platforms aim to enable cross-shard/cross-chain interactions, but the guarantees differ:</p>
<ul>
<li><strong>Polkadot XCM</strong> — asynchronous message passing between parachains. Messages are delivered reliably but not atomically — a multi-parachain operation cannot be reverted as a single unit if one step fails. This makes complex DeFi compositions (flash loans, atomic arbitrage) across parachains difficult.</li>
<li><strong>Radix Cerberus</strong> — synchronous atomic consensus across shards. A single <a href="/contents/tech/core-protocols/transaction-manifests" rel="noopener">Transaction Manifest</a> can atomically interact with Components on different shards, with the entire transaction reverting if any step fails.</li>
</ul>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Developer Experience</h2>
<p>Polkadot's Substrate framework is powerful but complex — building a parachain requires implementing runtime logic in Rust, understanding FRAME pallets, and managing parachain lifecycle (slot auctions, crowdloans). Substrate is designed for building custom blockchains, which is a different level of abstraction from building dApps.</p>
<p>Radix's <a href="/contents/tech/core-protocols/scrypto-programming-language" rel="noopener">Scrypto</a> is specifically designed for dApp development. Deploying a <a href="/contents/tech/core-concepts/blueprints-and-packages" rel="noopener">Package</a> to Radix is analogous to deploying a smart contract — it does not require running infrastructure or acquiring scarce resources. This makes Radix more accessible for DeFi developers, while Polkadot is more suited for teams building specialised execution environments.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>External Links</h2>
<ul>
<li><a href="https://polkadot.network/" target="_blank" rel="noopener">Polkadot Network</a></li>
<li><a href="https://wiki.polkadot.network/" target="_blank" rel="noopener">Polkadot Wiki</a></li>
<li><a href="https://arxiv.org/pdf/2008.04450" target="_blank" rel="noopener">Cerberus Whitepaper</a> — arXiv</li>
</ul>`
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 5. Cerberus vs Other BFT Protocols
  // ─────────────────────────────────────────────
  {
    tagPath: 'contents/tech/comparisons',
    slug: 'cerberus-vs-other-bft-protocols',
    title: 'Cerberus vs Other BFT Protocols',
    excerpt: 'Comparison of Cerberus with PBFT, HotStuff, Tendermint, and Narwhal/Bullshark on shard support, atomicity, throughput, and finality.',
    content: [
      {
        id: uid(), type: 'infobox', blocks: [{
          id: uid(), type: 'content',
          text: `<table><tbody>
<tr><td colspan="2"><strong>Cerberus vs Other BFT Protocols</strong></td></tr>
<tr><td>Category</td><td>Consensus Protocol Comparison</td></tr>
<tr><td>Cerberus</td><td><a href="/contents/tech/core-protocols/cerberus-consensus-protocol" rel="noopener">Parallelised BFT with braiding</a></td></tr>
<tr><td>Peer Review</td><td><a href="https://arxiv.org/pdf/2008.04450" target="_blank" rel="noopener">arXiv:2008.04450</a> (2020, JSR 2023)</td></tr>
<tr><td>BFT Threshold</td><td>&lt; 1/3 Byzantine per shard</td></tr>
</tbody></table>`
        }]
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Introduction</h2>
<p><a href="/contents/tech/core-protocols/cerberus-consensus-protocol" rel="noopener">Cerberus</a> is Radix's consensus protocol, published as a <a href="https://arxiv.org/pdf/2008.04450" target="_blank" rel="noopener">peer-reviewed paper</a> in 2020 and reviewed in the Journal of Systems Research (2023). Independent reviewers concluded that Cerberus is among the most efficient multi-shard consensus protocols in terms of throughput and latency. This article compares it against established <a href="/contents/tech/core-concepts/byzantine-fault-tolerance" rel="noopener">BFT</a> protocols.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Single-Pipeline Protocols</h2>
<h3>PBFT (Practical Byzantine Fault Tolerance)</h3>
<p><a href="https://en.wikipedia.org/wiki/Practical_Byzantine_fault_tolerance" target="_blank" rel="noopener">PBFT</a> (Castro & Liskov, 1999) is the foundational BFT protocol. It runs a three-phase commit process (pre-prepare, prepare, commit) requiring O(n²) message complexity. PBFT provides deterministic finality but is limited to small validator sets (~20-50) due to communication overhead. All transactions are processed sequentially through a single leader.</p>
<h3>HotStuff</h3>
<p><a href="https://arxiv.org/abs/1803.05069" target="_blank" rel="noopener">HotStuff</a> (2018) reduces PBFT's message complexity to O(n) per round through a pipelining approach with rotating leaders. It forms the basis for Meta's abandoned Diem/Libra and the Aptos blockchain. HotStuff is more scalable than PBFT for larger validator sets but remains a single-pipeline protocol — all transactions are totally ordered.</p>
<h3>CometBFT (Tendermint)</h3>
<p><a href="https://docs.cometbft.com/" target="_blank" rel="noopener">CometBFT</a> (formerly Tendermint) is a BFT protocol used across the Cosmos ecosystem. It provides instant finality (no probabilistic confirmation) with O(n²) communication complexity. Each Cosmos chain runs its own CometBFT instance, enabling the multi-chain architecture but limiting individual chain throughput.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>DAG-Based Protocols</h2>
<h3>Narwhal/Bullshark</h3>
<p><a href="https://arxiv.org/abs/2105.11827" target="_blank" rel="noopener">Narwhal</a> (2021) separates data dissemination from consensus ordering using a DAG (Directed Acyclic Graph) structure. <a href="https://arxiv.org/abs/2201.05677" target="_blank" rel="noopener">Bullshark</a> (2022) adds partially synchronous BFT ordering on top. This combination achieves high throughput by parallelising data availability but still requires total ordering of all transactions — a single-shard model. Narwhal/Bullshark formed the basis of Sui's consensus layer.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Cerberus: Parallelised BFT</h2>
<p>Cerberus takes a fundamentally different approach. Rather than optimising a single consensus pipeline, it runs a proven BFT process <strong>in parallel across practically unlimited shards</strong>, each maintaining its own ordered transaction stream. Cross-shard transactions are handled through "braiding" — a synchronisation mechanism that achieves atomic commitment across involved shards without global coordination.</p>
<table>
<thead><tr><th>Property</th><th>PBFT</th><th>HotStuff</th><th>CometBFT</th><th>Narwhal/Bullshark</th><th>Cerberus</th></tr></thead>
<tbody>
<tr><td>Shard Support</td><td>Single</td><td>Single</td><td>Single (per chain)</td><td>Single</td><td>Unlimited</td></tr>
<tr><td>Cross-Shard Atomicity</td><td>N/A</td><td>N/A</td><td>Via IBC (async)</td><td>N/A</td><td>Native (braided)</td></tr>
<tr><td>Message Complexity</td><td>O(n²)</td><td>O(n)</td><td>O(n²)</td><td>O(n)</td><td>O(n) per shard</td></tr>
<tr><td>Finality</td><td>Deterministic</td><td>Deterministic</td><td>Deterministic</td><td>Deterministic</td><td>Deterministic</td></tr>
<tr><td>Throughput Scaling</td><td>Fixed ceiling</td><td>Fixed ceiling</td><td>Fixed per chain</td><td>Fixed ceiling</td><td>Linear with nodes</td></tr>
</tbody>
</table>
<p>The key innovation is that Cerberus provides <a href="/contents/tech/core-concepts/atomic-composability" rel="noopener">atomic composability</a> across shards — something no other production BFT protocol achieves — while maintaining linear throughput scaling.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>External Links</h2>
<ul>
<li><a href="https://arxiv.org/pdf/2008.04450" target="_blank" rel="noopener">Cerberus: A Parallelized BFT Consensus Protocol</a> — arXiv</li>
<li><a href="https://learn.radixdlt.com/article/what-is-cerberus" target="_blank" rel="noopener">What is Cerberus?</a> — Radix Knowledge Base</li>
<li><a href="https://en.wikipedia.org/wiki/Practical_Byzantine_fault_tolerance" target="_blank" rel="noopener">PBFT</a> — Wikipedia</li>
<li><a href="https://arxiv.org/abs/1803.05069" target="_blank" rel="noopener">HotStuff: BFT Consensus in the Lens of Blockchain</a> — arXiv</li>
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
