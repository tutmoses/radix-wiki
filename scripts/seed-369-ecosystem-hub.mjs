/**
 * Run 369 (ecosystem rotation) — the /ecosystem category has no hub article.
 *
 * /ecosystem is the wiki's largest category (150 project pages) and its second most-visited
 * content path (165 visitors / 30d, Plausible, 5 September 2026), and it renders as a bare card
 * grid with no head. A category's own article is a page row at the empty slug, the same slot the
 * homepage occupies, so this creates one: what the directory holds, measured; how a status is
 * decided, pointing at the operational-status index rather than restating it; and what the
 * directory cannot tell you while mainnet is halted.
 *
 * Every figure here was read from the pages table on 2026-09-05, and the same read rebuilt the
 * operational-status index in scripts/sweep-369-ecosystem-index-rebuild.mjs.
 */
import { uid, insertPages } from './seed-utils.mjs';

const content = [
  { id: uid(), type: 'infobox', blocks: [{ id: uid(), type: 'content', text:
    '<table><tbody>'
    + '<tr><th colspan="2">Radix Ecosystem</th></tr>'
    + '<tr><td><strong>Scope</strong></td><td>Projects built on, or serving, <a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix</a></td></tr>'
    + '<tr><td><strong>Pages in this directory</strong></td><td>150 (read 5 September 2026)</td></tr>'
    + '<tr><td><strong>Running</strong></td><td>59</td></tr>'
    + '<tr><td><strong>Testnet, pre-launch or in development</strong></td><td>8</td></tr>'
    + '<tr><td><strong>Dormant</strong></td><td>48</td></tr>'
    + '<tr><td><strong>Closed or departed</strong></td><td>35</td></tr>'
    + '<tr><td><strong>Largest categories</strong></td><td>Finance (38), Staking (23), Infrastructure (17)</td></tr>'
    + '<tr><td><strong>Status index</strong></td><td><a href="/contents/resources/radix-ecosystem-operational-status" rel="noopener">Radix Ecosystem Operational Status</a></td></tr>'
    + '<tr><td><strong>Network</strong></td><td>Mainnet halted since 21:19&nbsp;UTC, 31 August 2026</td></tr>'
    + '</tbody></table>' }] },

  { id: uid(), type: 'content', text:
    '<h2>Introduction</h2>'
    + '<p>This section is a directory of the projects that have been built on <a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix</a> or built to serve it &mdash; exchanges and lending markets, validators, wallets, games, tooling, tokens, and the organizations behind them. Each entry is a page with the same shape: a facts table carrying the project&rsquo;s status, category, founding date and links, then an account of what it does and what has happened to it, with every claim linked to its source.</p>'
    + '<p>It is a curated record rather than a census. A project earns a page here by being notable enough to write about, and it keeps that page after it stops &mdash; which is the point. The question the directory is built to answer is not &ldquo;what can I use today&rdquo; but &ldquo;who is still here&rdquo;, and that question cannot be answered by a list that quietly deletes the projects that left.</p>' },

  { id: uid(), type: 'content', text:
    '<h2>What the directory holds</h2>'
    + '<p>Read on 5 September 2026, the directory carries <strong>150 project pages</strong>. Fifty-nine are marked as running. Eight are on testnet, pre-launch or still being built. <strong>Forty-eight are dormant and thirty-five are closed or departed</strong> &mdash; so eighty-three of the hundred and fifty, more than half of everything tracked here, are pages about something that has stopped.</p>'
    + '<p>That ratio measures the record, not a survival rate. The directory keeps its dead, and it has been growing partly by writing up projects that ended years ago, so the proportion tells you how thoroughly the ecosystem&rsquo;s history has been documented as much as it tells you how the ecosystem is faring. What it does settle is that anyone reading a Radix project list assembled from live websites alone is reading a much shorter and much more cheerful list than this one.</p>'
    + '<p>By category, the directory is weighted heavily toward finance and the network&rsquo;s own infrastructure: Finance 38, Staking 23, Infrastructure 17, Gaming 14, Token 13, Media 13, NFT Platform 10, DAO Platform 6, Education 5, Launchpad 3, then Oracle, Studio and Stablecoin at 2 each and DeSci and Healthcare at 1. Of the 112 pages that record a founding year, the heaviest cohorts are 2023 (25), 2021 (23) and 2022 (23), tapering to 9 in 2025 and 5 so far in 2026.</p>' },

  { id: uid(), type: 'content', text:
    '<h2>How a status is decided</h2>'
    + '<p>The <code>status</code> field on each project page is the authority, and it records whether the <em>people</em> behind a project are still operating it &mdash; not whether its contracts would still respond, and not whether its website answers. A domain outlives the project on it, so a landing page returning HTTP&nbsp;200 proves almost nothing; the fullest illustration, along with the validator-registration and on-ledger-supply checks that do prove something, is set out on the <a href="/contents/resources/radix-ecosystem-operational-status" rel="noopener">operational-status index</a>, which groups all 150 pages by status and is generated from those fields.</p>'
    + '<p>Two of those checks are unavailable at present. Validator registration and token supply are both read through the <a href="/contents/tech/core-protocols/radix-gateway-api" rel="noopener">Radix Gateway</a>, and while mainnet is halted the Gateway refuses to serve state it believes is stale, so it answers <code>NotSyncedUpError</code> rather than an old figure. Where a status here is older than the halt, it has not been re-confirmed against the ledger since.</p>' },

  { id: uid(), type: 'content', text:
    '<h2>The network these projects run on has stopped</h2>'
    + '<p>Radix mainnet stopped producing rounds at <strong>21:19:06&nbsp;UTC on 31 August 2026</strong> and has not restarted. Validators holding more than two thirds of stake broke liveness deliberately, hours after <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">every Hyperlane-bridged asset on the network was drained</a> through a flaw in the Radix Engine. Read at 07:03&nbsp;UTC on 5 September, the <a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">Gateway status endpoint</a> still returns the same last committed ledger &mdash; state version 557,840,622, epoch 339,896, round 102 &mdash; one hundred and five hours later, and the <a href="https://t.me/RadixAccountabilityCouncil/971" target="_blank" rel="noopener">Radix Accountability Council&rsquo;s update of 4 September</a> gives no restart date.</p>'
    + '<p>So the answer to &ldquo;can this project settle a transaction today&rdquo; is currently no, and it is the same no for all 150 of them. The statuses in this directory have deliberately not been rewritten for it: replacing 150 project-level judgements with one network-level fact would lose the first without adding the second.</p>' },

  { id: uid(), type: 'content', text:
    '<h2>Where to start</h2>'
    + '<p>The cards below can be filtered by status, category and founding date, and sorted; by default they list most recently updated first. Among the entries most often consulted are the money markets and exchanges &mdash; <a href="/ecosystem/ociswap" rel="noopener">Ociswap</a>, <a href="/ecosystem/weft-finance" rel="noopener">Weft Finance</a>, <a href="/ecosystem/caviarnine" rel="noopener">CaviarNine</a> and <a href="/ecosystem/surge" rel="noopener">Surge</a> &mdash; the bridge at the centre of the August drain, <a href="/ecosystem/hyperlane" rel="noopener">Hyperlane</a>, and the <a href="/ecosystem/radix-foundation" rel="noopener">Radix Foundation</a> itself.</p>'
    + '<p>Three pages outside this section carry the context the directory assumes: <a href="/contents/resources/radix-ecosystem-operational-status" rel="noopener">Radix Ecosystem Operational Status</a> groups every entry by whether it is still running, <a href="/contents/history/radix-ecosystem-funding" rel="noopener">Radix Ecosystem Funding</a> records the grant and treasury programmes that paid for a good deal of what is listed here, and <a href="/contents/tech/releases/radix-mainnet-xian" rel="noopener">Radix Mainnet (Xi&rsquo;an)</a> is the upgrade that will require the projects still standing to migrate.</p>' },
];

await insertPages(
  [{ tagPath: 'ecosystem', slug: '', title: 'Radix Ecosystem',
     metadata: { excerpt: 'The 150 Radix projects this wiki tracks: what the directory holds, how each status is judged, and what it cannot tell you while mainnet is halted.' },
     content }],
  'ecosystem',
  'Hub article for the Ecosystem category, which had none. The wiki’s largest category (150 pages) and second most-visited content path rendered as a bare card grid. Composition measured from the pages table on 5 September 2026: 59 running, 8 building, 48 dormant, 35 closed or departed.',
);
