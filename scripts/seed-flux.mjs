// scripts/seed-flux.mjs : the Flux borrowing protocol and its $fUSD stablecoin.
//
// Design facts come from the ILIS DAO documentation (docs.ilikeitstable.com).
// Every number in "Scale on ledger" was read from mainnet on 11 September 2026 at
// epoch 340,001, state version 557,864,266, about nine hours after the network
// resumed from the August halt.

import { uid, insertPages } from './seed-utils.mjs';

const FUSD = 'resource_rdx1t49wa75gve8ehvejr760g3pgvkawsgsgq0u3kh7vevzk0g0cnsmscq';

const infobox = `<table><tbody>
<tr><th colspan="2">Flux</th></tr>
<tr><td><strong>Type</strong></td><td>Overcollateralised borrowing protocol</td></tr>
<tr><td><strong>Stablecoin</strong></td><td>$fUSD, pegged 1:1 to the US dollar</td></tr>
<tr><td><strong>Collateral</strong></td><td>$XRD and $LSULP</td></tr>
<tr><td><strong>Maximum loan-to-value</strong></td><td>66.67% for both collateral types</td></tr>
<tr><td><strong>Minimum loan</strong></td><td>50 $fUSD</td></tr>
<tr><td><strong>Interest rate</strong></td><td>Set by each borrower</td></tr>
<tr><td><strong>Governance</strong></td><td>ILIS DAO (I Like It Stable DAO LLC, Marshall Islands)</td></tr>
<tr><td><strong>Oracle</strong></td><td>Morpher, pull-based</td></tr>
<tr><td><strong>Launched</strong></td><td>31 May 2025</td></tr>
<tr><td><strong>Licence</strong></td><td>MIT</td></tr>
</tbody></table>`;

const lead = `<p><strong>Flux</strong> is a borrowing protocol on Radix that issues <strong>$fUSD</strong>, a stablecoin pegged one for one to the United States dollar. A borrower locks collateral in Flux, mints $fUSD against it, and sets the interest rate on the loan themselves. Two collateral types are accepted: <a href="/contents/tech/core-protocols/xrd-token" rel="noopener">$XRD</a>, the native token of Radix, and $LSULP, the liquidity token of <a href="/ecosystem/caviarnine" rel="noopener">CaviarNine</a>'s LSU Pool, which holds <a href="/contents/tech/core-concepts/liquid-stake-units" rel="noopener">liquid stake units</a> from a spread of validators. The protocol is governed by the ILIS DAO and its source is published under the MIT licence.</p>`;

const origins = `<h2>Origins</h2>
<p>Flux is the second protocol built by the <a href="https://docs.ilikeitstable.com/introduction/protocol-overview" target="_blank" rel="noopener">ILIS DAO</a>, a non-profit incorporated in the Marshall Islands as I Like It Stable DAO LLC. Its documentation names one founder, <a href="https://docs.ilikeitstable.com/ilis-dao/founders" target="_blank" rel="noopener">a Dutch developer who goes by Octopus</a>, and says nothing further about who works on it. The DAO's first protocol is the <a href="/ecosystem/stabilis" rel="noopener">STAB Protocol</a>, which issues a stable asset called $STAB and deliberately lets its internal price drift rather than holding a fixed peg.</p>
<p>The documentation calls Flux the <a href="https://docs.ilikeitstable.com/introduction/protocol-overview/flux" target="_blank" rel="noopener">"spiritual successor"</a> to the STAB Protocol and credits <a href="https://www.liquity.org/" target="_blank" rel="noopener">Liquity V2</a> on Ethereum as the design it is drawn from. Four things change against the older protocol: borrowers set their own interest rates, where the STAB Protocol used a control loop to set one rate for everyone; $fUSD holds a rigid dollar peg; the redemption system is reworked for a tighter peg; and prices arrive from a pull oracle, which the caller supplies with every transaction, rather than a push oracle writing prices to the ledger on its own schedule.</p>
<p>Flux went live on Radix mainnet on <strong>31 May 2025</strong>. The transaction that created the $fUSD resource and instantiated the protocol's main component committed at state version 299,034,033, and the front end at <a href="https://flux.ilikeitstable.com" target="_blank" rel="noopener">flux.ilikeitstable.com</a> still carries a banner describing Flux as a beta.</p>`;

const fusd = `<h2>$fUSD</h2>
<p>$fUSD is a native Radix fungible resource (<code>resource_rdx1t49&hellip;g0cnsmscq</code>) with 18 decimal places and no fixed supply. It exists only where someone has borrowed it, so the total in existence is also the protocol's entire outstanding loan book.</p>
<p>Its authorities were read from the ledger on 11 September 2026. Minting and burning are gated behind the protocol's own controller badge, so nobody can create or destroy $fUSD outside the loan mechanics. Freezing and recall are set to <code>deny_all</code> and that setting is locked, so no holder's balance can be frozen or clawed back. Withdraw and deposit are open, so the token transfers freely. The rule set as a whole is <strong>not</strong> locked: the badge holder can still change who may mint and burn, which is the technical form the DAO's governance over the token takes.</p>
<p>The peg rests on two mechanisms rather than on a reserve. Redemption sets a floor: anyone holding $fUSD can always exchange it for collateral at a dollar a coin, so a price below a dollar is an arbitrage. Borrower-set interest rates supply the other half, because a borrower who wants to avoid being redeemed against raises the rate they pay, and a higher rate makes holding $fUSD more attractive.</p>`;

const borrowing = `<h2>Borrowing</h2>
<p>Each loan is an NFT called a <strong>Flux Generator</strong>, which the borrower holds in their own account. Because the loan is a token rather than an entry in a table keyed by address, one account can hold several loans at different risk settings, and a loan can be transferred or sold to someone else.</p>
<p>The <a href="https://docs.ilikeitstable.com/flux/technical-info/system-parameters" target="_blank" rel="noopener">published parameters</a> are the same for both collateral types. The maximum loan-to-value ratio is 66.67%, so a loan is liquidated once its debt passes two thirds of the value of its collateral. The minimum loan is 50 $fUSD. Interest compounds every minute and is added to the debt rather than billed separately, and there is no repayment schedule: a loan stays open until the borrower closes it or it is liquidated.</p>
<p>Opening a loan costs seven days of the borrower's chosen interest, charged upfront, which makes very short loans unattractive. The same charge applies to a borrower who changes their rate less than seven days after setting it. That cooldown exists to stop a borrower dropping their rate, riding out a redemption, and putting it back.</p>
<p>A liquidated borrower pays a penalty of 10% of the debt out of their collateral and keeps whatever is left. The liquidation itself is absorbed by a Flux Reservoir rather than by an auction, and the person who submits the transaction is reimbursed with 1% of the debt value in collateral. Each collateral type runs its own market, its own interest rates and its own reservoir, so a failure in one collateral does not reach borrowers in the other.</p>`;

const redemptions = `<h2>Redemptions</h2>
<p>A redemption is the mechanism that holds the floor under the peg. Anyone with $fUSD can send it to the protocol and receive collateral in return, valued at a dollar per coin, less a redemption fee the protocol <a href="https://docs.ilikeitstable.com/flux/technical-info/system-parameters" target="_blank" rel="noopener">varies between 0.5% and 5%</a>. When $fUSD trades below a dollar by more than that fee, redeeming it is profitable, and the redemption burns the $fUSD it takes in.</p>
<p>The collateral <a href="https://docs.ilikeitstable.com/flux/using-flux/redeem" target="_blank" rel="noopener">comes out of open loans</a>, starting with the loan paying the lowest interest rate and, where two loans pay the same rate, the one with the higher loan-to-value ratio. A redeemed borrower is not penalised: their debt falls by the same dollar amount as the collateral that leaves, and the redemption fee stays in their loan. What they lose is exposure to the collateral, and the rate they set is what decides their place in the queue.</p>`;

const reservoirs = `<h2>Flux Reservoirs and the interest split</h2>
<p>A <strong>Flux Reservoir</strong> is a pool of deposited $fUSD that stands ready to absorb liquidations. When a loan is liquidated, the reservoir's $fUSD pays off the debt and the reservoir receives the collateral, which depositors can then buy back at 99% of the oracle price. There is one reservoir per collateral market, no lock-up, and no deposit fee.</p>
<p>Interest paid by borrowers is split three ways. The <a href="https://docs.ilikeitstable.com/flux/using-flux/earn" target="_blank" rel="noopener">documentation states the split</a> as 65% to the reservoirs, 25% to liquidity incentives and 10% to buying and burning $ILIS, the ILIS DAO's governance token. Those three proportions, and the 1% buy-back discount, are stored as parameters on the protocol's stability-pool component and read back from the ledger unchanged.</p>
<p>The liquidity share is paid out as weekly airdrops to people providing $fUSD liquidity on two venues: 80% to the $fUSD/$xUSDC pool on CaviarNine, where only liquidity priced between 0.95 and 1.05 earns rewards, and 20% to the $fUSD/$XRD pool on <a href="/ecosystem/ociswap" rel="noopener">Ociswap</a>.</p>`;

const scale = `<h2>Scale on ledger</h2>
<p>Flux is fully built and barely used. The figures below were read from Radix mainnet on <strong>11 September 2026</strong> at epoch 340,001, state version 557,864,266, roughly nine hours after the network resumed from the <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">ten-day halt</a> that began on 31 August.</p>
<table><tbody>
<tr><th>Reading</th><th>Value</th></tr>
<tr><td>$fUSD in existence</td><td>5,608.56</td></tr>
<tr><td>Open Flux Generators</td><td>3, all collateralised in $XRD</td></tr>
<tr><td>Flux Generators minted since launch</td><td>49, of which 46 are burned</td></tr>
<tr><td>Collateral held by the protocol</td><td>1,770,509 $XRD and no $LSULP</td></tr>
<tr><td>$fUSD in the $LSULP reservoir</td><td>1,505.74</td></tr>
<tr><td>$fUSD in the $XRD reservoir</td><td>163.34</td></tr>
<tr><td>CaviarNine $fUSD/$xUSDC pool</td><td>525.61 $fUSD and 147.95 $xUSDC</td></tr>
</tbody></table>
<p>Because $fUSD is minted only against collateral, the first row is the whole loan book. The three open loans carry interest rates of 0.1%, 0% and 6%, and one of them holds 1,656,279 of the 1,770,509 $XRD. The $LSULP market holds the larger reservoir and no collateral, so nothing is borrowed against $LSULP today.</p>
<p>Two readings are easy to take wrongly. The debt recorded on a Flux Generator is denominated in pool units rather than in $fUSD, and the documentation warns that raw loan data read this way cannot be treated as a coin amount. And the quoted market price of $fUSD carries little weight: the venues quoting it hold a few hundred tokens between them, which is thin enough that a single trade moves the number.</p>`;

const risks = `<h2>Risks</h2>
<p>The <a href="https://docs.ilikeitstable.com/flux/dangers" target="_blank" rel="noopener">project's own risk page</a> lists five: a bug in the smart contracts; liquidation when a loan's ratio passes the limit; manipulation of the oracle; a depeg that makes repaying or liquidating unworkable; and thin liquidity, which stops reservoir buy-backs from clearing. It also states plainly that $fUSD depends on $XRD and $LSULP, and that no mechanism guarantees overcollateralisation if a collateral asset collapses suddenly.</p>
<p>One mechanism appears on the ledger and not in the documentation. The stability-pool component carries a "panic mode" with vaults for a designated centralised stablecoin, set at the time of reading to $xUSDC, the wrapped US dollar coin bridged onto Radix by <a href="/ecosystem/instabridge" rel="noopener">Instabridge</a>. Panic mode was inactive when read on 11 September 2026, and no published page explains what activates it or what it does. It sits alongside the protocol's claim that $fUSD is backed only by decentralised assets, and the two want reconciling before either is relied on.</p>
<p>Prices reach Flux through <a href="https://www.morpher.com/radix/docs" target="_blank" rel="noopener">Morpher's pull oracle</a>, which means every transaction needing a collateral price carries a signed price message supplied by the caller. Flux runs an API that hands these messages out, and a user can subscribe to Morpher directly instead.</p>`;

const links = `<h2>External Links</h2>
<ul>
<li><a href="https://flux.ilikeitstable.com" target="_blank" rel="noopener">Flux &ndash; official app</a></li>
<li><a href="https://docs.ilikeitstable.com/flux/using-flux/fusd" target="_blank" rel="noopener">Flux USD (fUSD) &ndash; ILIS DAO documentation</a></li>
<li><a href="https://docs.ilikeitstable.com/flux/technical-info/components-and-manifests" target="_blank" rel="noopener">Flux components and manifests &ndash; on-ledger addresses</a></li>
<li><a href="https://github.com/Stabilis-Labs/flux-protocol" target="_blank" rel="noopener">Stabilis-Labs/flux-protocol &ndash; source code (MIT)</a></li>
<li><a href="https://dashboard.radixdlt.com/resource/resource_rdx1t49wa75gve8ehvejr760g3pgvkawsgsgq0u3kh7vevzk0g0cnsmscq" target="_blank" rel="noopener">$fUSD &ndash; Radix Dashboard (resource)</a></li>
<li><a href="https://flux.ilikeitstable.com/stats" target="_blank" rel="noopener">Flux &ndash; live protocol statistics</a></li>
<li><a href="https://t.me/ilisdao" target="_blank" rel="noopener">ILIS DAO &ndash; Telegram</a></li>
</ul>`;

const pages = [
  {
    tagPath: 'ecosystem',
    slug: 'flux',
    title: 'Flux',
    metadata: {
      status: '🟢 Active',
      category: 'Stablecoin',
      founded: '2025-05-31',
      website: 'flux.ilikeitstable.com',
      github: 'github.com/Stabilis-Labs/flux-protocol',
      telegram: 't.me/ilisdao',
      team: 'Octopus',
      assets: FUSD,
      quality: '🥉 C-class',
      excerpt: "The ILIS DAO's borrowing protocol on Radix, issuing the overcollateralised stablecoin $fUSD against $XRD and $LSULP at borrower-set interest rates.",
    },
    content: [
      { id: uid(), type: 'infobox', blocks: [{ id: uid(), type: 'content', text: infobox }] },
      { id: uid(), type: 'content', text: lead },
      { id: uid(), type: 'content', text: origins },
      { id: uid(), type: 'content', text: fusd },
      { id: uid(), type: 'content', text: borrowing },
      { id: uid(), type: 'content', text: redemptions },
      { id: uid(), type: 'content', text: reservoirs },
      { id: uid(), type: 'content', text: scale },
      { id: uid(), type: 'content', text: risks },
      { id: uid(), type: 'content', text: links },
    ],
  },
];

await insertPages(pages, 'ecosystem', 'Initial page: Flux and $fUSD, with design from the ILIS DAO documentation and every figure read from mainnet at state version 557,864,266.');
