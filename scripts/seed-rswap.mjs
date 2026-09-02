// Creates /ecosystem/rswap. Seven pages named RSwap with nowhere to point, and
// /ecosystem/caviarnine rendered the anchor text "RSwap" over a link to
// /ecosystem/reddicks, which is a page about the DCKS token rather than the DEX.
//
// Verified 2026-09-01, 07:0x UTC (mainnet halted since 31 Aug 21:19, so every
// on-ledger figure here is a last-known reading and is dated as one):
//   dex.reddicks.meme/api/pairs -> 65 pairs, 7 dex components, pools created
//     2025-09-04 to 2026-07-25; 27 pairs carry a Hyperlane leg, 33 legs in all,
//     32 of them below one unit, sole exception 10.397862 hUSDC; 24h volume 0 on
//     every pair; LSULP/DCKS holds 17,533,687.62 LSULP
//   api.llama.fi/protocol/rswap -> id 7764, listed 2026-04-28, category Dexs,
//     chain Radix, twitter REDDICKS_XRD, audit_links = the Pessimistic audit of
//     DefiPlaza's Radix contracts; last TVL point 2026-08-31T14:54:23Z at $179,614
//     with HWBTC $33,876 and HETH $22,281 in the composition
//   DefiLlama-Adapters projects/rswap/index.js -> reads basePool + quotePool per pair
//   docs.defiplaza.net/radix/overview -> "DefiPlaza's CALM algorithm"; CALM is
//     DefiPlaza's, NOT CaviarNine's (the reddicks page said CaviarNine's and is
//     corrected in the companion sweep). The wiki's own /ecosystem/dogecube already
//     credited it correctly to DefiPlaza.
//   t.me/radix_dlt/{998767,998770,999057,999912} - authorship read from ?embed=1:
//     998767 / 999057 / 999912 are Gary (@GarySky1); 998770 is Timan (Astrolescent)
import { uid, insertPages } from './seed-utils.mjs';

const LSULP = 'resource_rdx1thksg5ng70g9mmy9ne7wz0sc7auzrrwy7fmgcxzel2gvp8pj0xxfmf';
const DCKS = 'resource_rdx1t42hpqvsk4t42l6aw09hwphd2axvetp6gvas9ztue0p30f4hzdwxrp';
const DEX = 'component_rdx1czlszr76d2wrc28uslyqddp6cgelx6y4rf2a80056wwd4grx9u09xy';

const INFOBOX = `<table><tbody>` +
  `<tr><td><strong>Type</strong></td><td>Automated market maker (DEX) on Radix</td></tr>` +
  `<tr><td><strong>Operator</strong></td><td>The <a href="/ecosystem/reddicks" rel="noopener">Reddicks</a> project (DCKS)</td></tr>` +
  `<tr><td><strong>Interface</strong></td><td><a href="https://dex.reddicks.meme" target="_blank" rel="noopener">dex.reddicks.meme</a></td></tr>` +
  `<tr><td><strong>Built on</strong></td><td><a href="/ecosystem/defiplaza" rel="noopener">DefiPlaza</a>'s CALM pair contracts; swap routing with <a href="/ecosystem/astrolescent" rel="noopener">Astrolescent</a></td></tr>` +
  `<tr><td><strong>Pairs</strong></td><td>65 across 7 exchange components, created 4 September 2025 to 25 July 2026</td></tr>` +
  `<tr><td><strong>Quote assets</strong></td><td>DCKS (37 pairs), XRD (12), LSULP (8), hUSDC (4), hETH (2), hSOL (2)</td></tr>` +
  `<tr><td><strong>Largest pair</strong></td><td><a href="https://dashboard.radixdlt.com/pool/pool_rdx1ch7xn38jgrfzmpk6392z3twh9zhh7w8hqgz8s9cvmcj0yhv3xzck8e" target="_blank" rel="noopener">LSULP/DCKS</a>, holding 17,533,687.62 LSULP</td></tr>` +
  `<tr><td><strong>Listed on DeFiLlama</strong></td><td><a href="https://defillama.com/protocol/rswap" target="_blank" rel="noopener">28 April 2026</a></td></tr>` +
  `<tr><td><strong>Position, 1 September 2026</strong></td><td>Every Hyperlane leg in every pool reads empty after the <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">drain of 31 August</a>, and 24-hour volume is zero on all 65 pairs because Radix mainnet is halted</td></tr>` +
  `</tbody></table>`;

const INTRO = `<p><strong>RSwap</strong> is a decentralised exchange on Radix, run by the <a href="/ecosystem/reddicks" rel="noopener">Reddicks</a> meme-coin project and reached at <a href="https://dex.reddicks.meme" target="_blank" rel="noopener">dex.reddicks.meme</a>. It is not a protocol of its own so much as a venue assembled from other people's parts: the pair contracts are <a href="/ecosystem/defiplaza" rel="noopener">DefiPlaza</a>'s, the swap routing is worked on with <a href="/ecosystem/astrolescent" rel="noopener">Astrolescent</a>, and the deepest pool on it is denominated in <a href="/ecosystem/caviarnine" rel="noopener">CaviarNine</a>'s liquid-staking unit.</p><p>For most of its life RSwap was a minor venue. It became a notable one in the second half of August 2026, when CaviarNine announced it was leaving Radix and RSwap said within hours that it was staying. Liquidity moved: an independent measure has its total value locked more than quadrupling between 15 and 30 August. Then, on 31 August, the <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">Hyperlane asset drain</a> emptied every bridged asset on the network, including the ones sitting in twenty-seven of RSwap's pools, and the network halted five hours later.</p>`;

const HOW = `<h2>How it works</h2><p>RSwap is built on <a href="/ecosystem/defiplaza" rel="noopener">DefiPlaza</a>'s Radix exchange contracts, and its structure shows it. Each trading pair is a component holding <strong>two</strong> pools rather than one, a base pool and a quote pool, which is how DefiPlaza's <a href="https://docs.defiplaza.net/radix/overview" target="_blank" rel="noopener">CALM algorithm</a> works: CALM keeps a record of each pair's impermanent loss and prices trades that increase it differently from trades that reduce it, using two distinct pricing functions rather than a single curve. DefiPlaza's own documentation is explicit that this is a deliberate alternative to liquidity concentration, not an instance of it.</p><p>Read from the venue's <a href="https://dex.reddicks.meme/api/pairs" target="_blank" rel="noopener">public pair API</a> on 1 September 2026, RSwap listed <strong>65 pairs</strong> spread across seven exchange components, the largest of which carries 37 of them. Pools were created between 4 September 2025 and 25 July 2026. The quote side is dominated by the operator's own token: DCKS quotes 37 pairs, XRD 12, CaviarNine's <a href="https://dashboard.radixdlt.com/resource/${LSULP}" target="_blank" rel="noopener">LSULP</a> eight, and the <a href="/ecosystem/hyperlane" rel="noopener">Hyperlane</a>-bridged assets the remaining eight.</p><p>The largest single pair is LSULP/DCKS, holding <strong>17,533,687.62 LSULP</strong> when last read, up from 17,293,134.15 on 19 August. That one position made RSwap the second-largest holder of LSULP on Radix after <a href="/ecosystem/weft-finance" rel="noopener">Weft Finance</a>, which is an unusual thing for a meme-coin DEX to be, and it is a dependency on a project that has announced it is leaving.</p>`;

const LIQUIDITY = `<h2>Two measures of the same liquidity</h2><p>RSwap publishes its own liquidity figures in the main Radix Telegram group, and <a href="https://defillama.com/protocol/rswap" target="_blank" rel="noopener">DeFiLlama</a> publishes an independent one. They agree on the direction and differ on the size by a factor that has stayed remarkably steady.</p><table><tbody><tr><td><strong>Date (2026)</strong></td><td><strong>Announced by RSwap</strong></td><td><strong>DeFiLlama TVL</strong></td><td><strong>Ratio</strong></td></tr><tr><td>22 August</td><td><a href="https://t.me/radix_dlt/999057" target="_blank" rel="noopener">$300,000</a></td><td>$99,564</td><td>3.01</td></tr><tr><td>29 August</td><td><a href="https://t.me/radix_dlt/999912" target="_blank" rel="noopener">$500,000</a></td><td>$172,940</td><td>2.89</td></tr></tbody></table><p>A gap that holds within four per cent across two independent announcements a week apart is more likely to be a difference of method than an error in either figure. An adapter values only the assets it recognises and prices; a venue counting "total liquidity" over pairs held in two pools each may be counting something else. This wiki records both with their dates and treats neither as wrong.</p><p>The DeFiLlama series itself dates the inflection precisely. Radix TVL sat in the low forty-thousands through mid-August, turned upward on <strong>19 August</strong> — the day CaviarNine announced its departure and Gary posted RSwap's <a href="https://t.me/radix_dlt/998767" target="_blank" rel="noopener">"RSwap is here to stay"</a> reply hours later — and rose almost without interruption to $188,796 on 30 August. Timan of Astrolescent <a href="https://t.me/radix_dlt/998770" target="_blank" rel="noopener">answered that post</a> twenty minutes on with "Proudly powered by @DefiPlaza and @Astrolescent_Official", confirming both of those were staying too.</p><table><tbody><tr><td><strong>Date (2026)</strong></td><td><strong>DeFiLlama TVL</strong></td></tr><tr><td>15 August</td><td>$40,535</td></tr><tr><td>19 August</td><td>$63,732</td></tr><tr><td>22 August</td><td>$99,564</td></tr><tr><td>26 August</td><td>$170,721</td></tr><tr><td>30 August</td><td>$188,796</td></tr><tr><td>31 August, 14:54 UTC</td><td>$179,614</td></tr></tbody></table>`;

const DRAIN = `<h2>What the drain took</h2><p>The last figure in that table is the last one there is. DeFiLlama's adapter reads RSwap's pool balances through the Radix Gateway, and its final data point is timestamped <strong>14:54:23 UTC on 31 August 2026</strong> — sixty-eight minutes before the <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">Hyperlane asset drain</a> began, and six hours before the network halted. Nothing has been recorded since, because there is nothing to read. Anyone looking at RSwap's public TVL today is looking at a pre-drain number.</p><p>That number was $179,614, and its composition was published alongside it: LSULP $66,372, DCKS $49,438, <strong>hWBTC $33,876</strong>, <strong>hETH $22,281</strong>, ASTRL $3,338, DFP2 $2,495 and DELIVER $1,814. The two Hyperlane assets are <strong>31 per cent of the total</strong>, and between 16:02 and 16:58 UTC they left.</p><p>RSwap's own pair API, which kept serving after the drain and before the halt, records the outcome without comment. Of the 65 pairs, <strong>27 carry at least one Hyperlane leg</strong>, 33 legs in all. Read on 1 September, <strong>32 of those 33 hold less than a single unit</strong>. The one exception is 10.397862 hUSDC in the hETH/hUSDC pair. The DCKS and LSULP sides of the same pools are untouched and sit where they were, which is what a one-sided drain looks like: the pools still exist, they are simply no longer pairs.</p><p>Every one of the 65 pairs also reports <strong>zero volume over the preceding 24 hours</strong>. That is not a judgement about RSwap. Radix mainnet stopped producing rounds at 21:19 UTC on 31 August and no transaction has settled anywhere on the network since. RSwap had said nothing publicly in the main Radix Telegram group in the ten hours after the halt.</p>`;

const REDDICKS = `<h2>Relationship to Reddicks</h2><p>RSwap is the trading layer of <a href="/ecosystem/reddicks" rel="noopener">Reddicks</a> rather than a separate business, and the two are financially joined: Reddicks runs a protocol-owned treasury that takes a 1% fee on RSwap buys and sells and recycles it into protocol-owned liquidity. DeFiLlama files the venue under the DCKS ecosystem and describes it as "a meme-driven DEX built for the DCKS ecosystem", which is also why DCKS quotes 37 of the 65 pairs.</p><p>The relationship runs the other way too. When Reddicks <a href="/ecosystem/deliver" rel="noopener">acquired DELIVER</a> in mid-2026, taking roughly 60 million tokens and the project's <a href="/ecosystem/ociswap" rel="noopener">Ociswap</a> pool badge into the DCKS treasury, the stated purpose was to pair the holding against DCKS and deepen liquidity here. DELIVER duly appears in RSwap's pool composition, at $1,814 of the 31 August total.</p><p>Announcements are posted to the main Radix Telegram group by <a href="https://t.me/GarySky1" target="_blank" rel="noopener">Gary</a> under the Reddicks banner; the project's X account is <a href="https://x.com/REDDICKS_XRD" target="_blank" rel="noopener">@REDDICKS_XRD</a>. RSwap has no token of its own.</p>`;

const LINKS = `<h2>External Links</h2><ul>` +
  `<li><a href="https://dex.reddicks.meme" target="_blank" rel="noopener">dex.reddicks.meme</a> – the exchange</li>` +
  `<li><a href="https://dex.reddicks.meme/api/pairs" target="_blank" rel="noopener">RSwap pair API</a> – every pair, its two pools, balances and creation date</li>` +
  `<li><a href="https://api.llama.fi/protocol/rswap" target="_blank" rel="noopener">RSwap on DeFiLlama</a> – the independent TVL series, frozen at 31 August (the JSON; the human page is behind a Cloudflare challenge)</li>` +
  `<li><a href="https://github.com/DefiLlama/DefiLlama-Adapters/blob/main/projects/rswap/index.js" target="_blank" rel="noopener">The DeFiLlama adapter</a> – what that series actually counts</li>` +
  `<li><a href="https://docs.defiplaza.net/radix/overview" target="_blank" rel="noopener">DefiPlaza's CALM algorithm</a> – the pair design RSwap runs on</li>` +
  `<li><a href="https://dashboard.radixdlt.com/component/${DEX}/summary" target="_blank" rel="noopener">The main exchange component</a> – on the Radix Dashboard</li>` +
  `<li><a href="https://dashboard.radixdlt.com/resource/${DCKS}" target="_blank" rel="noopener">DCKS resource</a> – the token quoting most of the book</li>` +
  `</ul>`;

const pages = [{
  tagPath: 'ecosystem',
  slug: 'rswap',
  title: 'RSwap',
  metadata: {
    status: '🟢 Active',
    category: 'Finance',
    website: 'dex.reddicks.meme',
    x: 'x.com/REDDICKS_XRD',
    team: 'Operated by the Reddicks project',
    excerpt: 'The Reddicks-run DEX on Radix, built on DefiPlaza pair contracts; its liquidity quadrupled after CaviarNine left and every Hyperlane leg in its pools reads empty after 31 August 2026.',
  },
  content: [
    { id: uid(), type: 'infobox', blocks: [{ id: uid(), type: 'content', text: INFOBOX }] },
    { id: uid(), type: 'content', text: INTRO },
    { id: uid(), type: 'content', text: HOW },
    { id: uid(), type: 'content', text: LIQUIDITY },
    { id: uid(), type: 'content', text: DRAIN },
    { id: uid(), type: 'content', text: REDDICKS },
    { id: uid(), type: 'content', text: LINKS },
  ],
}];

await insertPages(pages, 'ecosystem', 'Create the RSwap page. Seven pages referenced RSwap with nowhere to link, and one of them linked the DCKS token page under the DEX name. Sourced from the venue pair API, the DeFiLlama adapter and series, DefiPlaza documentation, and the dated Telegram announcements.');
