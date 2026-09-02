// Creates /ecosystem/hyperlane. Six pages already talked about Hyperlane with
// nowhere to link: community/flightofthefox, contents/history/hyperlane-asset-drain-2026,
// contents/resources/how-to-buy-xrd, contents/tech/core-protocols/radix-engine,
// ecosystem/reddicks and ecosystem/weft-finance.
//
// Everything here is read from a primary source, verified 2026-09-01:
//   hyperlane-registry chains/radix/{metadata,addresses}.yaml - domain id, deployer,
//     mailbox / IGP / ISM / merkle hook / validator-announce components
//   hyperlane-registry deployments/warp_routes/{USDC,USDT,ETH,WBTC,SOL,BNB} - all six
//     Radix routes, type synthetic on Radix against collateral on the origin chains
//   github.com/hyperlane-xyz/hyperlane-radix - created 2025-07-10, Apache-2.0,
//     (c) Abacus Works, last push 2025-10-01, README carries the deployed packages
//     and the Zellic audit (15-22 August 2025, report PDF 200 at 261,438 bytes)
//   radixdlt.com/blog/hyperlane-integrates-radix... (11 Aug 2025) and /hyperlane-is-live (5 Sep 2025)
//   hyperlane-monorepo rust/main/chains - hyperlane-radix is one of eight chain families
//   docs.hyperlane.xyz/docs/intro - protocol description, official X handle
//   Drain figures carried over from /contents/history/hyperlane-asset-drain-2026 v2.1.0
import { uid, insertPages } from './seed-utils.mjs';

const R = {
  hUSDC: 'resource_rdx1thxj9m87sn5cc9ehgp9qxp6vzeqxtce90xm5cp33373tclyp4et4gv',
  hUSDT: 'resource_rdx1th4v03gezwgzkuma6p38lnum8ww8t4ds9nvcrkr2p9ft6kxx3kxvhe',
  hETH: 'resource_rdx1th09yvv7tgsrv708ffsgqjjf2mhy84mscmj5jwu4g670fh3e5zgef0',
  hWBTC: 'resource_rdx1t58kkcqdz0mavfz98m98qh9m4jexyl9tacsvlhns6yxs4r6hrm5re5',
  hSOL: 'resource_rdx1t5ljlq97xfcewcdjxsqld89443fchqg96xv8a8k8gdftdycy9haxpx',
  hBNB: 'resource_rdx1t4et4jddp2fdupr00k83ct9jpnkgewply42l5098ztjkfvjfedvjva',
};
const res = (sym) => `<a href="https://dashboard.radixdlt.com/resource/${R[sym]}" target="_blank" rel="noopener">${sym}</a>`;

const INFOBOX = `<table><tbody>` +
  `<tr><td><strong>Type</strong></td><td>Permissionless interchain messaging protocol and token bridge</td></tr>` +
  `<tr><td><strong>Developer</strong></td><td><a href="https://www.hyperlane.xyz" target="_blank" rel="noopener">Abacus Works, Inc.</a></td></tr>` +
  `<tr><td><strong>Radix integration announced</strong></td><td><a href="https://www.radixdlt.com/blog/hyperlane-integrates-radix-permissionless-bridge-to-150-chains-coming-soon" target="_blank" rel="noopener">11 August 2025</a></td></tr>` +
  `<tr><td><strong>Live on Radix mainnet</strong></td><td><a href="https://www.radixdlt.com/blog/hyperlane-is-live" target="_blank" rel="noopener">5 September 2025</a></td></tr>` +
  `<tr><td><strong>Radix Hyperlane domain</strong></td><td><code>1633970780</code></td></tr>` +
  `<tr><td><strong>Bridged assets</strong></td><td>hUSDC, hUSDT, hETH, hWBTC, hSOL, hBNB</td></tr>` +
  `<tr><td><strong>Audit</strong></td><td><a href="https://github.com/Zellic/publications/blob/6b0207586e075d5d1937d5cad23ac5ef79f75805/Hyperlane%20-%20Radix%20-%20Zellic%20Audit%20Report.pdf" target="_blank" rel="noopener">Zellic</a>, 15–22 August 2025</td></tr>` +
  `<tr><td><strong>Source</strong></td><td><a href="https://github.com/hyperlane-xyz/hyperlane-radix" target="_blank" rel="noopener">hyperlane-radix</a>, Apache-2.0</td></tr>` +
  `<tr><td><strong>Position on Radix</strong></td><td>All six routes were emptied in the <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">drain of 31 August 2026</a>, and Radix mainnet has been halted since 21:19 UTC that day</td></tr>` +
  `</tbody></table>`;

const INTRO = `<p><strong>Hyperlane</strong> is a permissionless interoperability protocol that carries messages and token transfers between blockchains, built by <a href="https://www.hyperlane.xyz" target="_blank" rel="noopener">Abacus Works</a>. Its distinguishing property is that it needs nobody's approval: any chain can deploy it, and any developer can open a route on top of it. It went live on Radix mainnet on <a href="https://www.radixdlt.com/blog/hyperlane-is-live" target="_blank" rel="noopener">5 September 2025</a>, and until August 2026 it was the route by which USDC, USDT, ETH, WBTC, SOL and BNB reached the network.</p><p>Radix is not an EVM chain, so the integration was not a configuration exercise. Hyperlane's node software carries a separate implementation per chain family, and <a href="https://github.com/hyperlane-xyz/hyperlane-monorepo/tree/main/rust/main/chains" target="_blank" rel="noopener">the eight that exist</a> are Ethereum, Cosmos, Sealevel, Starknet, Aleo, Fuel, Tron and Radix. The on-ledger half is a Scrypto codebase of its own, <a href="https://github.com/hyperlane-xyz/hyperlane-radix" target="_blank" rel="noopener">hyperlane-radix</a>, published under Apache-2.0 and audited by <a href="https://www.zellic.io/" target="_blank" rel="noopener">Zellic</a> before deployment.</p><p>On 31 August 2026 every asset Hyperlane had issued on Radix was drained in under an hour and bridged out. The flaw was not in Hyperlane. It was in the <a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix Engine</a> beneath it, and the warp routes were the exit rather than the opening. That incident has <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">its own page</a>.</p>`;

const HOW = `<h2>How it works</h2><p>Hyperlane's core is a <strong>mailbox</strong>: a contract on each chain that accepts an outgoing message and delivers incoming ones. Off-chain <a href="https://docs.hyperlane.xyz/docs/intro" target="_blank" rel="noopener">relayers and validators</a> carry the message between mailboxes, and what decides whether a delivered message is believed is an <strong>Interchain Security Module</strong>, an ISM. The ISM is the part Hyperlane treats as configurable: an application picks the validator set and the quorum it wants rather than inheriting a single bridge's trust assumptions. Each chain is addressed by a numeric <strong>domain</strong>. Radix's is <code>1633970780</code>, which the registry derives, and comments in place, from the ASCII of the word "radix" reduced modulo 2<sup>31</sup>−1.</p><p>Token bridging is an application built on that base, called a <strong>warp route</strong>. A route names one contract per chain and gives each a type. On the chain the asset is native to, the contract is <code>collateral</code>: it holds the real token. On every other chain it is <code>synthetic</code>: it mints a local token when a message arrives and burns it when one is sent. Radix always holds the synthetic side, which is why the bridged assets appear on the ledger as ordinary Radix resources with an <code>h</code> prefix and why their supply on Radix falls to zero when everything is bridged out. Nothing is held in escrow on Radix; the backing sits on Ethereum, Arbitrum, Base, BNB Chain and Solana.</p><p>The <a href="https://github.com/hyperlane-xyz/hyperlane-registry/tree/main/chains/radix" target="_blank" rel="noopener">Hyperlane registry</a> publishes the deployed Radix components in the open: the mailbox at <code>component_rdx1cpcq2wcs8zmpjanjf5ek76y4wttdxswnyfcuhynz4zmhjfjxqfsg9z</code>, an interchain gas paymaster, a default ISM, a merkle-tree hook and a validator-announce component, all deployed by Abacus Works.</p>`;

const INTEGRATION = `<h2>The Radix integration</h2><p>The Foundation announced the integration on <a href="https://www.radixdlt.com/blog/hyperlane-integrates-radix-permissionless-bridge-to-150-chains-coming-soon" target="_blank" rel="noopener">11 August 2025</a>, describing Hyperlane as having processed "over $8 billion of asset transfers and 10m+ crosschain messages" and promising bridging to more than 150 chains. The repository had been opened on 10 July 2025. Zellic assessed the code from <strong>15 to 22 August 2025</strong> and the <a href="https://github.com/Zellic/publications/blob/6b0207586e075d5d1937d5cad23ac5ef79f75805/Hyperlane%20-%20Radix%20-%20Zellic%20Audit%20Report.pdf" target="_blank" rel="noopener">report</a> is published. Mainnet launch followed on 5 September 2025 with four assets (USDC, USDT, wBTC, ETH) reachable from Ethereum, Arbitrum, Base and BNB Chain; SOL and BNB routes came later.</p><p>Two things about the deployment are unusually legible for a bridge. The blueprints are built <a href="https://docs.radixdlt.com/docs/scrypto-builder" target="_blank" rel="noopener">deterministically</a> inside a GitHub Action, so the package on the ledger can be reproduced from the tagged source rather than taken on trust; the README names <code>package_rdx1pk3ldj3ktxuw6sv5txspjt2a8s42c7xxcn6wnf5yuytdrcqhpflfkc</code> for the mailbox, ISMs and gas paymaster at v1.0.0 and <code>package_rdx1pkzmcj4mtal34ddx9jrt8um6u3yqheqpfvcj4s0ulmgyt094fw0jzh</code> for the warp tokens at v1.1.0. And every route's configuration lives in the public registry rather than in a company's private deployment notes.</p><p>Two front ends served the same routes: <a href="/ecosystem/astrolescent" rel="noopener">Astrolescent</a>, the Radix-native one, and <a href="https://nexus.hyperlane.xyz/" target="_blank" rel="noopener">Hyperlane Nexus</a>, the protocol's own reference application. The last commit to hyperlane-radix landed on 1 October 2025, which is what a bridge integration looks like when it is finished rather than abandoned.</p>`;

const ASSETS = `<h2>The bridged assets</h2><p>Six resources were issued by Hyperlane warp routes on Radix. Each is the synthetic side of a route whose collateral sits elsewhere, and each supply figure below was read at epoch 339,871 on 31 August 2026, after the drain.</p><table><tbody><tr><td><strong>Asset</strong></td><td><strong>Backed by</strong></td><td><strong>Decimals</strong></td><td><strong>Supply after 31 August 2026</strong></td></tr><tr><td>${res('hUSDC')}</td><td>USDC on Ethereum, Arbitrum, Base and Solana</td><td>6</td><td>1,092.793964</td></tr><tr><td>${res('hUSDT')}</td><td>USDT on Ethereum</td><td>6</td><td>0.036292</td></tr><tr><td>${res('hETH')}</td><td>ETH on Ethereum</td><td>18</td><td>0.010278</td></tr><tr><td>${res('hWBTC')}</td><td>WBTC on Ethereum</td><td>8</td><td>0.005600</td></tr><tr><td>${res('hSOL')}</td><td>SOL on Solana</td><td>9</td><td>0.136338</td></tr><tr><td>${res('hBNB')}</td><td>BNB on BNB Chain</td><td>18</td><td>0.002105</td></tr></tbody></table><p>None of the six carries a recall or freeze authority. Read on the ledger, ${res('hUSDC')} reports <code>recaller</code> and <code>freezer</code> both <code>deny_all</code> with <code>rules_locked</code> true, so no party can claw the token back or immobilise it and no party can grant themselves that power later. This is deliberate and it follows from what a warp route is. The bridge's badge must be able to mint and burn, because that is how the route tracks its collateral; anything beyond that would let the issuer seize a user's balance. The trade is symmetric, and August 2026 collected the other half of it: the assets could not be recalled out of anyone's account, and they could not be recalled back either.</p>`;

const DRAIN = `<h2>The August 2026 drain</h2><p>Between 16:02 and 16:58 UTC on <strong>31 August 2026</strong>, twenty-six transactions emptied all six resources out of user accounts and dApp liquidity pools and bridged the proceeds out over Hyperlane's own warp routes to a single Ethereum account. 458,914.89 hUSDC and 72,420.38 hUSDT left, alongside the four non-stable assets, and each transaction paid the ordinary 500 XRD bridge fee. The full ledger account is on <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">Hyperlane Asset Drain and Network Halt (August 2026)</a>.</p><p>The distinction that matters for this page is where the flaw was. The transactions did not exploit a warp route, forge a Hyperlane message or defeat an ISM; the bridging half of each transaction was a legitimate burn-and-release that the route was built to perform. What let the attacker reach other people's vaults in the first place was a reference check in the <a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix Engine</a>, stated as the root cause that evening by the Foundation and the <a href="https://t.me/RadixAccountabilityCouncil/925" target="_blank" rel="noopener">Radix Accountability Council</a>. Any resource on Radix was in scope, wrapped or native. The bridged assets went first because they were the ones with somewhere to go.</p><p>Node runners halted Radix mainnet at 21:19 UTC the same evening and it has not restarted. Hyperlane's routes are intact and the protocol continues to operate on its other chains; on Radix they have nothing to move, and until the network resumes nothing can be minted or burned through them.</p>`;

const LINKS = `<h2>External Links</h2><ul>` +
  `<li><a href="https://www.hyperlane.xyz" target="_blank" rel="noopener">hyperlane.xyz</a> – the protocol's site</li>` +
  `<li><a href="https://docs.hyperlane.xyz/docs/intro" target="_blank" rel="noopener">Hyperlane documentation</a> – mailboxes, ISMs, hooks and warp routes</li>` +
  `<li><a href="https://github.com/hyperlane-xyz/hyperlane-radix" target="_blank" rel="noopener">hyperlane-radix</a> – the Scrypto implementation, deployed packages and audit</li>` +
  `<li><a href="https://github.com/hyperlane-xyz/hyperlane-registry/tree/main/chains/radix" target="_blank" rel="noopener">Radix in the Hyperlane registry</a> – domain id, deployed components, gateway and explorer entries</li>` +
  `<li><a href="https://github.com/Zellic/publications/blob/6b0207586e075d5d1937d5cad23ac5ef79f75805/Hyperlane%20-%20Radix%20-%20Zellic%20Audit%20Report.pdf" target="_blank" rel="noopener">Zellic audit report</a> – Hyperlane on Radix, August 2025</li>` +
  `<li><a href="https://explorer.hyperlane.xyz/" target="_blank" rel="noopener">Hyperlane Explorer</a> – interchain messages by origin and destination domain</li>` +
  `<li><a href="https://nexus.hyperlane.xyz/" target="_blank" rel="noopener">Hyperlane Nexus</a> – the protocol's own bridging front end</li>` +
  `</ul>`;

const pages = [{
  tagPath: 'ecosystem',
  slug: 'hyperlane',
  title: 'Hyperlane',
  metadata: {
    status: '🟢 Active',
    category: 'Infrastructure',
    website: 'hyperlane.xyz',
    github: 'github.com/hyperlane-xyz/hyperlane-radix',
    x: 'x.com/hyperlane',
    team: 'Abacus Works, Inc.',
    assets: R.hUSDC,
    excerpt: 'The permissionless interoperability protocol that bridged USDC, USDT, ETH, WBTC, SOL and BNB to Radix from September 2025, and the route the August 2026 drain left by.',
  },
  content: [
    { id: uid(), type: 'infobox', blocks: [{ id: uid(), type: 'content', text: INFOBOX }] },
    { id: uid(), type: 'content', text: INTRO },
    { id: uid(), type: 'content', text: HOW },
    { id: uid(), type: 'content', text: INTEGRATION },
    { id: uid(), type: 'content', text: ASSETS },
    { id: uid(), type: 'content', text: DRAIN },
    { id: uid(), type: 'content', text: LINKS },
  ],
}];

await insertPages(pages, 'ecosystem', 'Create the Hyperlane page. Six pages referenced Hyperlane with nowhere to link. Sourced from the Hyperlane registry and hyperlane-radix repository, the Zellic audit, and the two Foundation announcements.');
