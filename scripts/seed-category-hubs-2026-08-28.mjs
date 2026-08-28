// scripts/seed-category-hubs-2026-08-28.mjs
//
// The Semrush crawl of 2026-08-04 flagged twelve pages under 200 words. Ten of them
// were core-concept articles since expanded; the rest are category listings that have
// no article of their own, so the only prose on them is the tag description.
//
// A category's article is a page row at the EMPTY slug — the same slot the homepage
// occupies — so /contents/tech/releases becomes "Radix Protocol Releases" with its
// listing as the last section, rather than an index pointing at an article elsewhere.
// contents/history already works this way; these five join it.
//
// Deliberately NOT seeded:
//   /charts, /leaderboard      — app views holding zero pages. Their word count is
//                                what a tool page weighs; an article would be a lie
//                                about what the URL is.
//   /contents                  — the root container. Its children are already three
//                                fully-articled branches; a hub here would restate them.
//   /community, /policy,
//   /contents/resources,
//   /contents/tech/operations  — real categories, but each wants an editorial decision
//                                about scope before it gets a voice. Left for a human.
//
// Facts are taken from this wiki's own child articles so the hubs cannot drift from
// the pages they head: Babylon's epoch 32717 / 28 September 2023 from
// contents/tech/releases/radix-mainnet-babylon, the Hyperscale test figures from
// contents/tech/research/hyperscale-500k-tps, Cerberus's JSys publication from
// contents/tech/research/cerberus-whitepaper.

import { uid } from './seed-utils.mjs';
import { insertPages } from './seed-utils.mjs';

const infobox = (rows) => ({
  id: uid(),
  type: 'infobox',
  blocks: [{ id: uid(), type: 'content', text: `<table>\n${rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('\n')}\n</table>` }],
});
const html = (text) => ({ id: uid(), type: 'content', text });

const pages = [
  // ---------------------------------------------------------------- releases
  {
    tagPath: 'contents/tech/releases',
    slug: '',
    title: 'Radix Protocol Releases',
    metadata: { excerpt: 'Radix ships its network in named releases – Olympia, Alexandria, Babylon, Xi’an – each named for an ancient city and each moving one layer of the stack.' },
    content: [
      infobox([
        ['First mainnet', '<a href="/contents/tech/releases/radix-mainnet-olympia" rel="noopener">Olympia</a>, July 2021'],
        ['Current mainnet', '<a href="/contents/tech/releases/radix-mainnet-babylon" rel="noopener">Babylon</a>, 28 September 2023'],
        ['Babylon enactment', 'Epoch 32,717'],
        ['Next mainnet', '<a href="/contents/tech/releases/radix-mainnet-xian" rel="noopener">Xi&rsquo;an</a>'],
        ['Public test network', '<a href="/contents/tech/releases/stokenet" rel="noopener">Stokenet</a>'],
        ['Smaller updates', '<a href="/contents/tech/releases/protocol-updates" rel="noopener">Protocol updates</a>, two to three a year'],
        ['Naming', 'Cities of the ancient world'],
      ]),
      html(`<h2>Introduction</h2>
<p>Radix names its major network releases after cities of the ancient world, and the choice turns out to be a good guide to how the network has been built. Each release is a place the protocol stopped and settled for a while, and each one added a layer the previous release had done without.</p>
<p>A release changes the rules that every <a href="/contents/tech/core-protocols/radix-engine" rel="noopener">node</a> runs, so it cannot be adopted piecemeal. Node operators upgrade, the validator set signals readiness, and the network crosses over at a nominated epoch. Between releases, smaller <a href="/contents/tech/releases/protocol-updates" rel="noopener">protocol updates</a> land two to three times a year; Radix documentation notes these are what other networks would call hard forks.</p>`),
      html(`<h2>The line of mainnets</h2>
<p><a href="/contents/tech/releases/radix-mainnet-olympia" rel="noopener">Olympia</a> opened the public network in July 2021 with the node software, a desktop wallet, staking, an explorer and the native XRD token. It ran no smart contracts at all: the <a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix Engine</a> was not yet available as an execution environment for applications, so Olympia was a ledger for holding and staking rather than for building.</p>
<p><a href="/contents/tech/releases/radix-developer-environment-alexandria" rel="noopener">Alexandria</a> followed in December 2021 and is the odd entry in the sequence, because it was not a network at all. It appended the Olympia release with a <a href="/contents/tech/core-protocols/scrypto-programming-language" rel="noopener">Scrypto</a> developer environment and a local simulator, letting developers write and test against an engine that mainnet could not yet run. The library came before the city.</p>
<p><a href="/contents/tech/releases/radix-mainnet-babylon" rel="noopener">Babylon</a> closed that gap on 28 September 2023, migrating from Alexandria at epoch 32,717. It brought smart contracts, the Radix Engine as a live runtime, native assets and the Radix Wallet. Babylon is the release the network is on today, and most of what this wiki documents under <a href="/contents/tech/core-concepts" rel="noopener">core concepts</a> describes Babylon behaviour.</p>
<p><a href="/contents/tech/releases/radix-mainnet-xian" rel="noopener">Xi&rsquo;an</a> is the release still ahead. It is intended to allow an unlimited number of shard groups and so put Radix&rsquo;s sharded state model fully to work &ndash; the scalability half of the original design, which every release so far has deferred.</p>`),
      html(`<h2>Networks that are not mainnet</h2>
<p><a href="/contents/tech/releases/stokenet" rel="noopener">Stokenet</a> is the public test network, carrying the same protocol version as mainnet so that a blueprint proved there behaves the same when deployed. It is periodically reset, which destroys every balance, transaction and deployed package while leaving the network ID, Gateway URL and account addresses intact.</p>
<p><a href="/contents/tech/releases/rcnet" rel="noopener">RCnet</a> &ndash; the Radix Community Network &ndash; ran during the approach to Babylon, giving developers the tools and standards for the new engine before it reached mainnet. Stokenet superseded it.</p>`),
      html(`<h2>Reading the sequence</h2>
<p>Taken together the releases show a protocol built one layer at a time and in an unusual order: settlement first, then execution, then scale. Olympia proved the ledger, Babylon proved the engine, and Xi&rsquo;an is where the sharding that motivated the whole project has to arrive. That ordering is why Radix spent a decade in <a href="/contents/tech/research" rel="noopener">research</a> before it had smart contracts, and why the scalability claim is still the one being tested rather than the one being demonstrated.</p>`),
    ],
  },

  // ---------------------------------------------------------------- research
  {
    tagPath: 'contents/tech/research',
    slug: '',
    title: 'Radix Research',
    metadata: { excerpt: 'Thirteen years of consensus designs behind Radix – eMunie, Tempo, Cerberus, Cassandra and Hyperscale – and what each one was built to fix.' },
    content: [
      infobox([
        ['Began', '2013, as <a href="/contents/tech/research/emunie" rel="noopener">eMunie</a>'],
        ['Originator', '<a href="/community/dan-hughes" rel="noopener">Dan Hughes</a> (1974&ndash;2025)'],
        ['Published protocol', '<a href="/contents/tech/research/cerberus-whitepaper" rel="noopener">Cerberus</a>, peer-reviewed in JSys, June 2023'],
        ['Current line', '<a href="/contents/tech/research/hyperscale-rs" rel="noopener">hyperscale-rs</a>, community-built in Rust'],
        ['Best public test', '&gt;500,000 TPS sustained, January 2026'],
      ]),
      html(`<h2>Introduction</h2>
<p>Most of Radix exists because one problem was refused for thirteen years. A single-threaded ledger cannot serve the world&rsquo;s financial traffic, and the usual answers &ndash; bigger blocks, faster blocks, execution moved off the ledger &ndash; buy time rather than remove the ceiling. The research collected here is the record of the designs that were tried against that ceiling, including the ones that were abandoned.</p>
<p>Reading it in order is the fastest way to understand why Radix looks the way it does. The discarded work is not a footnote to the shipped protocol; it is the reason the shipped protocol has the shape it has.</p>`),
      html(`<h2>The line of designs</h2>
<p><a href="/contents/tech/research/emunie" rel="noopener">eMunie</a> is where it starts, around 2013 and before Ethereum launched, as <a href="/community/dan-hughes" rel="noopener">Dan Hughes&rsquo;</a> first distributed ledger project. <a href="/contents/tech/research/tempo-consensus-mechanism" rel="noopener">Tempo</a>, proposed in 2017 as the fifth iteration, was a DAG-based design that pioneered ledger pre-sharding and lazy consensus &ndash; the idea that related transactions can be grouped and that not every node needs to agree about every one.</p>
<p><a href="/contents/tech/core-protocols/cerberus-consensus-protocol" rel="noopener">Cerberus</a> replaced Tempo and is the design Radix is named for in the literature. Its <a href="/contents/tech/research/cerberus-whitepaper" rel="noopener">whitepaper</a> appeared as a preprint in 2020 and was peer-reviewed and published in the Journal of Systems Research in June 2023, which is a rarer credential in this field than it sounds. <a href="/contents/tech/research/consensus-evolution" rel="noopener">Consensus evolution at Radix</a> traces the whole sequence in one place.</p>
<p><a href="/contents/tech/research/cassandra" rel="noopener">Cassandra</a> is the sharp-edged one. Hughes ran it to attack two questions a sharded network cannot avoid: what happens when a subset of validators stops processing transactions and liveness fails, and how validator sets can be reconfigured while the network runs.</p>`),
      html(`<h2>Hyperscale, and what the tests measured</h2>
<p>The current line is Hyperscale. In January 2026 the Radix Foundation completed a public test in which its reference implementation sustained more than 500,000 transactions per second and peaked above 700,000, on commodity AWS m6i.xlarge instances of four cores and 16 GB each. The <a href="/contents/tech/research/hyperscale-500k-tps" rel="noopener">test page</a> carries the setup in full.</p>
<p>What the figure measures is worth stating precisely, because it is easy to over-read. The test exercised the Foundation&rsquo;s Hyperscale implementation. It was not a measurement of Cerberus as specified, and the braided cross-shard consensus described in the Cerberus paper has not shipped in any implementation.</p>
<p><a href="/contents/tech/research/hyperscale-rs" rel="noopener">hyperscale-rs</a> is the community-built Rust implementation of the Hyperscale protocol, led by flightofthefox of proven.network and opened for public review, and it is the leading candidate to deliver <a href="/contents/tech/releases/radix-mainnet-xian" rel="noopener">Xi&rsquo;an</a>. The <a href="/contents/tech/research/radix-economic-model" rel="noopener">economic model</a> sits alongside this work, governing where XRD comes from and where it goes.</p>`),
      html(`<h2>Why the record is kept</h2>
<p>A protocol that has rewritten its consensus layer five times invites an obvious question about whether the sixth will land. Keeping the discarded designs legible is the honest answer to it: each iteration names a failure mode that the next one had to survive, and the current work can be judged against that list rather than against a promise. Xi&rsquo;an is where the thirteen years get their result.</p>`),
    ],
  },

  // ------------------------------------------------------------- comparisons
  {
    tagPath: 'contents/tech/comparisons',
    slug: '',
    title: 'Radix Compared',
    metadata: { excerpt: 'Radix set against Ethereum, Solana, Cosmos and Polkadot, and Cerberus against the BFT protocols it descends from.' },
    content: [
      infobox([
        ['Compared against', 'Ethereum, Solana, Cosmos, Polkadot'],
        ['Protocol comparison', '<a href="/contents/tech/comparisons/cerberus-vs-other-bft-protocols" rel="noopener">Cerberus vs other BFT protocols</a>'],
        ['Radix consensus', '<a href="/contents/tech/core-protocols/cerberus-consensus-protocol" rel="noopener">Cerberus</a>'],
        ['Radix execution', '<a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix Engine</a> and <a href="/contents/tech/core-protocols/scrypto-programming-language" rel="noopener">Scrypto</a>'],
      ]),
      html(`<h2>Introduction</h2>
<p>Radix makes choices that have no counterpart on most networks. Assets are engine primitives rather than balances inside contracts, authority is carried by <a href="/contents/tech/core-concepts/badges" rel="noopener">badges</a> that are themselves resources, and the state model is sharded by design rather than by appended rollups. Describing those choices in isolation tends to produce a list of adjectives. Setting them against a network the reader already knows makes them concrete.</p>
<p>That is what these pages are for. Each takes one well-understood design and works out where Radix diverges, what the divergence buys, and what it costs.</p>`),
      html(`<h2>The comparison set</h2>
<p><a href="/contents/tech/comparisons/radix-vs-ethereum" rel="noopener">Radix vs Ethereum</a> is the load-bearing one, because Ethereum&rsquo;s account-and-contract model is the default mental picture almost every reader arrives with. The gap between a token as a balance in a mapping and a token as a resource the engine itself moves is where most of Radix&rsquo;s design follows from.</p>
<p><a href="/contents/tech/comparisons/radix-vs-solana" rel="noopener">Radix vs Solana</a> sets two different answers to throughput against each other: parallel execution on one very fast machine, against sharded consensus across many ordinary ones. <a href="/contents/tech/comparisons/radix-vs-cosmos" rel="noopener">Radix vs Cosmos</a> and <a href="/contents/tech/comparisons/radix-vs-polkadot" rel="noopener">Radix vs Polkadot</a> both address the multi-chain approach, where scale comes from many chains linked by a messaging layer and <a href="/contents/tech/core-concepts/atomic-composability" rel="noopener">atomic composability</a> across them is the thing given up.</p>
<p><a href="/contents/tech/comparisons/cerberus-vs-other-bft-protocols" rel="noopener">Cerberus vs other BFT protocols</a> is the narrowest and most technical of the set, placing Cerberus among the HotStuff-derived family it comes from.</p>`),
      html(`<h2>How to read them</h2>
<p>A comparison written by a project about its rivals is worth reading with the obvious caution, and these pages are written on a wiki about Radix. Where a claim is contested or a Radix feature has not shipped, the pages say so, and the <a href="/contents/tech/research" rel="noopener">research</a> section carries the unresolved parts of the design. The comparisons are most useful for locating the real architectural fork in the road; the question of which branch was right is still open, and Radix&rsquo;s branch is the one with the least mainnet evidence behind it.</p>`),
    ],
  },

  // ------------------------------------------------------------- developers
  {
    tagPath: 'developers',
    slug: '',
    title: 'Building on Radix',
    metadata: { excerpt: 'The developer path for Radix: Scrypto blueprints, transaction manifests, the dApp Toolkit and ROLA, node and API infrastructure, and agent tooling.' },
    content: [
      infobox([
        ['Contract language', '<a href="/contents/tech/core-protocols/scrypto-programming-language" rel="noopener">Scrypto</a>, a Rust dialect'],
        ['Execution', '<a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix Engine</a>'],
        ['Transactions', '<a href="/contents/tech/core-protocols/transaction-manifests" rel="noopener">Transaction manifests</a>'],
        ['Test network', '<a href="/contents/tech/releases/stokenet" rel="noopener">Stokenet</a>'],
        ['Front-end', 'Radix dApp Toolkit, Gateway SDK, ROLA'],
        ['Start here', '<a href="/developers/getting-started/01-install-scrypto" rel="noopener">Installing Scrypto</a>'],
      ]),
      html(`<h2>Introduction</h2>
<p>Building on Radix asks you to unlearn one habit before anything else works. On most networks a token is a number your contract keeps in a mapping, and moving it means writing code that decrements one entry and increments another. On Radix the engine owns the asset. A <a href="/contents/tech/core-concepts/resources" rel="noopener">resource</a> moves between <a href="/contents/tech/core-concepts/buckets-proofs-and-vaults" rel="noopener">vaults</a> through the engine&rsquo;s own rules, and a blueprint that tries to lose it will not compile into a transaction that commits.</p>
<p>That single change removes a category of bug rather than a line of code, and it is why the learning path below starts with resources rather than with syntax.</p>`),
      html(`<h2>The path</h2>
<p><a href="/developers/getting-started/01-install-scrypto" rel="noopener">Getting started</a> installs the toolchain, writes a first blueprint and deploys it to <a href="/contents/tech/releases/stokenet" rel="noopener">Stokenet</a> and then mainnet. The <a href="/developers/scrypto/01-fundamentals" rel="noopener">Scrypto series</a> is the long one: fundamentals, resources and NFTs, <a href="/developers/scrypto/03-authorization-and-badges" rel="noopener">authorization and access rules</a>, events and royalties, testing, vault patterns, multi-component architecture, oracles, and permissioned assets.</p>
<p>The <a href="/developers/transactions/01-manifest-language" rel="noopener">transactions series</a> covers the layer between an application and the ledger &ndash; the manifest language, the transaction lifecycle, fees, the Radix Engine Toolkit, and how addresses and entity types are formed. Manifests are worth real attention: a Radix transaction states what it intends to do in a form the wallet can show a user before they sign it.</p>
<p>On the client side, the <a href="/developers/frontend/01-radix-dapp-toolkit" rel="noopener">front-end series</a> runs from the dApp Toolkit through the Gateway SDK to <a href="/developers/frontend/03-rola-authentication" rel="noopener">ROLA</a>, the wallet-signature login this wiki itself uses. <a href="/developers/infrastructure/01-running-a-node" rel="noopener">Infrastructure</a> covers running a node and the public APIs, and <a href="/developers/tools/radix-web3-js" rel="noopener">tools</a> collects the community libraries and manifest builders.</p>`),
      html(`<h2>Agents</h2>
<p>The newest branch here is for software that acts on its own behalf. <a href="/developers/ai-agents/radix-context" rel="noopener">Radix Context</a> and <a href="/developers/ai-agents/radix-skills" rel="noopener">Radix Skills</a> package the protocol&rsquo;s documentation for coding agents, and <a href="/developers/ai-agents/ai-agents-and-x402" rel="noopener">x402 payments</a> covers the emerging way an agent pays for a request it has just been refused. Radix&rsquo;s subintents make that pattern unusually clean, because a client can commit to an exact payment without holding the XRD to pay the network fee.</p>`),
      html(`<h2>What to expect</h2>
<p>Scrypto is Rust, so the borrow checker is part of the job and the compile times are real. In exchange, most of what a Solidity audit looks for is unrepresentable: there is no reentrancy path through a resource transfer, no approve-and-drain, and no way to mint an asset a blueprint was not authorized to mint. Whether that trade suits a given project is a judgment about the team as much as the protocol, and it is worth making before the first blueprint rather than after.</p>`),
    ],
  },

  // ------------------------------------------------------------------- tech
  {
    tagPath: 'contents/tech',
    slug: '',
    title: 'Radix Technology',
    metadata: { excerpt: 'How the Radix stack fits together: Cerberus consensus, the Radix Engine, Scrypto, and the asset-oriented model that ties them.' },
    content: [
      infobox([
        ['Consensus', '<a href="/contents/tech/core-protocols/cerberus-consensus-protocol" rel="noopener">Cerberus</a>'],
        ['Execution', '<a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix Engine</a>'],
        ['Contract language', '<a href="/contents/tech/core-protocols/scrypto-programming-language" rel="noopener">Scrypto</a>'],
        ['Model', '<a href="/contents/tech/core-concepts/asset-oriented-programming" rel="noopener">Asset-oriented programming</a>'],
        ['Current release', '<a href="/contents/tech/releases/radix-mainnet-babylon" rel="noopener">Babylon</a>'],
        ['Open question', 'Sharded scale, at <a href="/contents/tech/releases/radix-mainnet-xian" rel="noopener">Xi&rsquo;an</a>'],
      ]),
      html(`<h2>Introduction</h2>
<p>Radix is a layer-one network built around a claim that sounds modest and is not: that a ledger should understand what an asset is. On nearly every other network an asset is a convention &ndash; a balance held in a contract&rsquo;s storage, obeying whatever rules that contract&rsquo;s author wrote and whatever bugs they left. On Radix, assets are objects the <a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix Engine</a> holds and moves itself, and application code can only ask the engine to move them.</p>
<p>Almost everything else in this section follows from that decision, including the parts that are still unfinished.</p>`),
      html(`<h2>The stack</h2>
<p><a href="/contents/tech/core-protocols/cerberus-consensus-protocol" rel="noopener">Cerberus</a> is the consensus layer, a BFT protocol designed so that transactions touching unrelated state can be agreed in parallel rather than serialized into one chain. Above it the <a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix Engine</a> executes transactions against a state model of typed objects, and <a href="/contents/tech/core-protocols/scrypto-programming-language" rel="noopener">Scrypto</a>, a dialect of Rust, is how developers write for it.</p>
<p><a href="/contents/tech/core-concepts" rel="noopener">Core concepts</a> is where the vocabulary lives: <a href="/contents/tech/core-concepts/resources" rel="noopener">resources</a>, <a href="/contents/tech/core-concepts/buckets-proofs-and-vaults" rel="noopener">buckets, proofs and vaults</a>, <a href="/contents/tech/core-concepts/badges" rel="noopener">badges</a>, <a href="/contents/tech/core-concepts/components" rel="noopener">components</a> and <a href="/contents/tech/core-concepts/blueprints-and-packages" rel="noopener">blueprints</a>. <a href="/contents/tech/core-protocols" rel="noopener">Core protocols</a> covers the layers themselves, and <a href="/contents/tech/core-concepts/atomic-composability" rel="noopener">atomic composability</a> is the property the whole arrangement exists to preserve: any two applications can be combined inside one transaction that either wholly succeeds or wholly does not.</p>`),
      html(`<h2>The rest of this section</h2>
<p><a href="/contents/tech/releases" rel="noopener">Releases</a> tracks the named mainnets from Olympia through Babylon to Xi&rsquo;an, and the protocol updates between them. <a href="/contents/tech/research" rel="noopener">Research</a> holds the thirteen years of consensus designs behind the current one, including the abandoned ones. <a href="/contents/tech/comparisons" rel="noopener">Comparisons</a> sets Radix against Ethereum, Solana, Cosmos and Polkadot. <a href="/contents/tech/operations" rel="noopener">Operations</a> covers running against the live network.</p>`),
      html(`<h2>What is settled and what is not</h2>
<p>The execution half of the design is live and has been since Babylon in September 2023. Asset-oriented programming, badges, manifests and the wallet are all in production, and the properties they claim can be checked against mainnet today.</p>
<p>The scalability half is not. Cerberus as specified runs unsharded on mainnet, the braided cross-shard consensus in the whitepaper has never shipped, and the sharded design that motivated the project waits on <a href="/contents/tech/releases/radix-mainnet-xian" rel="noopener">Xi&rsquo;an</a>. A reader evaluating Radix should keep those halves apart: one is a shipped system with a track record, the other is a research programme with promising test numbers and no mainnet.</p>`),
    ],
  },
];

await insertPages(pages, '', 'Seed the category hub article: the category’s own page, with its listing as the closing section.');
