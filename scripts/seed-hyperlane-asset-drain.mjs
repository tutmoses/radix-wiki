// scripts/seed-hyperlane-asset-drain.mjs — run 343 (ecosystem rotation)
// Records the 31 August 2026 drain of every Hyperlane-bridged asset on Radix.
// Every figure below was read from the ledger: the 26 transactions deposited to
// account_rdx168lx…3973f29, the manifest of txid_rdx19lzunu3…qd60u5v, the hUSDC
// resource authorities, and the six resource supplies at epoch 339,871.

import { uid, insertPages } from './seed-utils.mjs';

const tx = (id) => `https://dashboard.radixscan.io/transaction/${id}/summary`;
const res = (a) => `https://dashboard.radixdlt.com/resource/${a}`;
const acct = (a) => `https://dashboard.radixdlt.com/account/${a}`;
const comp = (a) => `https://dashboard.radixdlt.com/component/${a}`;
const A = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

const BIG = 'txid_rdx19lzunu3relu436dm9r4mnmvyjx3yzr2723gk7d7kv0tce8g9h4kqd60u5v';
const COLLECTOR = 'account_rdx168lx67kgw2fsd9awudqhmwlhc9gwjw79d84mrx5cayul7gg3973f29';
const FEEACC = 'account_rdx1283x6gv9sxx75q4aypdpra5u0v3e7hh4hk7paskd4egx2nev0ucx9j';
const WARP = 'component_rdx1crvhu42czzpvkh556228sc5xk7uz69yvwcsqn23u5yy65pea0w02l0';
const HUSDC = 'resource_rdx1thxj9m87sn5cc9ehgp9qxp6vzeqxtce90xm5cp33373tclyp4et4gv';
const HUSDT = 'resource_rdx1th4v03gezwgzkuma6p38lnum8ww8t4ds9nvcrkr2p9ft6kxx3kxvhe';
const HETH = 'resource_rdx1th09yvv7tgsrv708ffsgqjjf2mhy84mscmj5jwu4g670fh3e5zgef0';
const HWBTC = 'resource_rdx1t58kkcqdz0mavfz98m98qh9m4jexyl9tacsvlhns6yxs4r6hrm5re5';
const HSOL = 'resource_rdx1t5ljlq97xfcewcdjxsqld89443fchqg96xv8a8k8gdftdycy9haxpx';
const HBNB = 'resource_rdx1t4et4jddp2fdupr00k83ct9jpnkgewply42l5098ztjkfvjfedvjva';

const content = [
  {
    id: uid(),
    type: 'infobox',
    blocks: [{
      id: uid(),
      type: 'content',
      text:
        '<table><tbody>' +
        '<tr><td><strong>Date</strong></td><td>31 August 2026</td></tr>' +
        '<tr><td><strong>Window</strong></td><td>16:02:20 – 16:57:41 UTC</td></tr>' +
        '<tr><td><strong>Network</strong></td><td>Radix mainnet</td></tr>' +
        '<tr><td><strong>Transactions</strong></td><td>26, all committed successfully</td></tr>' +
        '<tr><td><strong>Assets taken</strong></td><td>hUSDC, hUSDT, hETH, hWBTC, hSOL, hBNB – the whole Hyperlane-bridged set</td></tr>' +
        '<tr><td><strong>Face value of the stablecoins</strong></td><td>458,914.89 hUSDC + 72,420.38 hUSDT</td></tr>' +
        '<tr><td><strong>Exit</strong></td><td>Hyperlane warp routes, destination domain 1</td></tr>' +
        '<tr><td><strong>Recall or freeze used</strong></td><td>No. Every asset had <code>recaller</code> and <code>freezer</code> set to <code>deny_all</code> and locked</td></tr>' +
        '<tr><td><strong>Root cause</strong></td><td>Not stated by any party as of 19:30 UTC, 31 August 2026</td></tr>' +
        `<tr><td><strong>Ledger record</strong></td><td>${A(acct(COLLECTOR), 'Collecting account')} · ${A(tx(BIG), 'Largest transaction')}</td></tr>` +
        '</tbody></table>',
    }],
  },
  {
    id: uid(),
    type: 'content',
    text:
      '<p>On 31 August 2026, between 16:02 and 16:58 UTC, twenty-six transactions on Radix mainnet emptied every ' +
      `${A('https://hyperlane.xyz', 'Hyperlane')}-bridged asset held on the network and sent the proceeds out over Hyperlane's own warp routes. ` +
      'The assets came out of user accounts and out of the liquidity pools of Radix dApps alike, in one pass, without a single owner signing anything. ' +
      `Six hours later the remaining supply of ${A(res(HUSDC), 'hUSDC')} on Radix was 1,092.79 tokens, and the other five wrapped assets stood at fractions of one unit.</p>` +
      '<p>The incident followed by less than a day the exploit of ' +
      '<a href="/ecosystem/weft-finance" rel="noopener">Weft Finance</a>, whose attacker also left through a Hyperlane warp route. ' +
      'No party had stated a root cause for the drain at the time of writing, and this page reports what the ledger holds rather than a diagnosis.</p>',
  },
  {
    id: uid(),
    type: 'content',
    text:
      '<h2>What the ledger shows</h2>' +
      `<p>The largest of the twenty-six is ${A(tx(BIG), 'txid_rdx19lzunu3…qd60u5v')}, committed at 16:33:28.554 UTC for a network fee of 8.39 XRD. ` +
      'It is a single manifest and it does three things in order.</p>' +
      '<p>First it publishes a package. The blueprint is named <code>LiquidityTool</code> and it exposes sixty-one functions called <code>run_0</code> through <code>run_60</code>, ' +
      'which is the shape of code written for one transaction rather than for reuse.</p>' +
      '<p>Then it calls all sixty-one, and each call takes one argument: an <code>internal_vault_</code> address. ' +
      'Sixty distinct vaults appear across the calls. An internal vault is the container an account or component holds a resource in, and its address is public. ' +
      'After the calls the worktop holds 442,985.632108 hUSDC drawn from fifty-nine separate accounts and components.</p>' +
      `<p>Last it takes that balance and 380.037752172 XRD into buckets and calls <code>transfer_remote</code> on ${A(comp(WARP), 'the hUSDC warp route')}, ` +
      'passing destination domain <code>1</code> and a twenty-byte recipient address in EVM format. ' +
      `The change goes to ${A(acct(COLLECTOR), 'account_rdx168lx…3973f29')}, which is the only account the manifest names anywhere.</p>` +
      '<p>Two absences in that manifest carry as much as the instructions do. There is no proof, no badge and no owner authorisation of any kind in front of the vault calls. ' +
      'And there is no <code>LOCK_FEE</code> instruction at all: the fee was locked from inside the published blueprint, against a vault the transaction passed to it by address. ' +
      `The XRD for fees came out of ${A(acct(FEEACC), 'account_rdx1283x6…0ucx9j')}, which lost 500 XRD on each of the twenty-six and received nothing back. ` +
      'Whether that account belongs to the attacker or to a third party whose XRD vault was used the same way as the sixty others is not settled by the ledger.</p>',
  },
  {
    id: uid(),
    type: 'content',
    text:
      '<h2>What was taken</h2>' +
      '<p>Summed across all twenty-six transactions, and set against what the same resources report on the ledger at epoch 339,871 (19:09:50 UTC, 31 August 2026):</p>' +
      '<table><tbody>' +
      '<tr><td><strong>Asset</strong></td><td><strong>Taken</strong></td><td><strong>Supply remaining on Radix</strong></td></tr>' +
      `<tr><td>${A(res(HUSDC), 'hUSDC')}</td><td>458,914.885741</td><td>1,092.793964</td></tr>` +
      `<tr><td>${A(res(HUSDT), 'hUSDT')}</td><td>72,420.384476</td><td>0.036292</td></tr>` +
      `<tr><td>${A(res(HETH), 'hETH')}</td><td>61.078006</td><td>0.010278</td></tr>` +
      `<tr><td>${A(res(HWBTC), 'hWBTC')}</td><td>6.348243</td><td>0.005600</td></tr>` +
      `<tr><td>${A(res(HSOL), 'hSOL')}</td><td>536.159806</td><td>0.136338</td></tr>` +
      `<tr><td>${A(res(HBNB), 'hBNB')}</td><td>32.910105</td><td>0.002105</td></tr>` +
      '<tr><td>XRD</td><td>13,000 (fees, 500 per transaction)</td><td>–</td></tr>' +
      '</tbody></table>' +
      '<p>The two stablecoins alone carry a face value of 531,335.27 US dollars. The rest depends on market prices, and the wiki states no total for it. ' +
      'The supply column is the plainer measure of what happened: bridging an asset out of Radix burns it here, so the drain is visible in the supply of each resource, and what is left of five of the six is dust.</p>',
  },
  {
    id: uid(),
    type: 'content',
    text:
      '<h2>The hour</h2>' +
      '<p>The sequence reads as a test followed by a sweep.</p>' +
      '<ul>' +
      '<li><strong>16:02:20 to 16:22:37.</strong> Six transactions, one per asset, each moving a token amount: 0.005 hETH, 0.00035324 hSOL, 0.015 hBNB, 0.00084948 hWBTC, 482.99 hUSDT, 384.81 hUSDC. Each still paid the full 500 XRD bridge fee.</li>' +
      '<li><strong>16:30:08 to 16:57:41.</strong> Twenty transactions carrying the rest. The hUSDC sweep at 16:33 is the largest single one; hUSDT, hWBTC, hETH and hSOL follow in blocks.</li>' +
      '<li><strong>17:17 UTC.</strong> The first public report reaches the main Radix Telegram group, twenty minutes after the last transaction committed.</li>' +
      `<li><strong>18:18 UTC.</strong> ${A('https://t.me/radix_dlt/1000557', 'A message in that group')} states that Hyperlane, the security firm Zellic and others have been contacted, and that parties on the receiving chain are being approached to contain the assets.</li>` +
      '</ul>' +
      '<p>The collecting account has committed no further transaction since 16:57:41, read at ledger state version 557,804,842.</p>',
  },
  {
    id: uid(),
    type: 'content',
    text:
      '<h2>Why the usual controls did not apply</h2>' +
      '<p>A Radix resource can carry authorities that let a named badge holder claw tokens back or halt movement in them. Neither existed here. ' +
      `Read live at 19:08 UTC on 31 August, ${A(res(HUSDC), 'hUSDC')} reports <code>recaller</code> and <code>freezer</code> both set to <code>deny_all</code>, ` +
      'with <code>rules_locked</code> true, so those settings cannot be changed by anyone. ' +
      'The token can be minted and burned only by the badge the bridge holds, which is what a warp route needs in order to work at all.</p>' +
      '<p>The consequence runs both ways. Nobody could have recalled these assets out of user accounts, which is the property holders were told they had. ' +
      'And nobody can recall them back, which is why containment moved to the receiving chain within the hour. ' +
      'The drain was not a recall and not a freeze; on the ledger it is an ordinary withdrawal that no owner authorised.</p>' +
      '<p>XRD itself was not swept. The 13,000 XRD that moved was fee payment, and it came from one vault rather than from the network at large. ' +
      'The scope of the drain is what the attacker could bridge, which is not the same statement as the scope of what the method could reach.</p>',
  },
  {
    id: uid(),
    type: 'content',
    text:
      '<h2>What is unresolved</h2>' +
      '<p>Three questions were open at the time of writing, and each has an answer the ledger cannot supply.</p>' +
      '<p>The first is the cause. A published blueprint took resources out of vaults it had no authority over. ' +
      'That is either a flaw in the warp-route package the six assets share, or a flaw underneath it in the authorisation the Radix Engine applies to a vault reference. ' +
      'The two readings imply very different scopes, and only the code answers it.</p>' +
      '<p>The second is recovery. The assets left the network, so what is left to recover sits on the receiving chain and depends on the parties there.</p>' +
      `<p>The third is who responds. The incident landed in the week the ${A('https://radixdao.org/', 'Radix DAO')} was taking over from the Foundation, ` +
      'with the Governance Framework in its ratification discussion period and no permanent council elected. ' +
      '<a href="/contents/tech/core-concepts/radix-governance" rel="noopener">Radix governance</a> describes the bodies that exist and what each of them can decide.</p>',
  },
  {
    id: uid(),
    type: 'content',
    text:
      '<h2>External links</h2>' +
      '<ul>' +
      `<li>${A(acct(COLLECTOR), 'Collecting account on the Radix Dashboard')} – the twenty-six transactions, newest first</li>` +
      `<li>${A(tx(BIG), 'The 16:33 hUSDC transaction on RadixScan')} – manifest, balance changes and affected entities</li>` +
      `<li>${A(res(HUSDC), 'hUSDC resource')} – authorities and current supply</li>` +
      `<li>${A('https://hyperlane.xyz', 'Hyperlane')} – the interchain messaging protocol whose warp routes issue the six assets</li>` +
      '</ul>',
  },
];

const pages = [{
  tagPath: 'contents/history',
  slug: 'hyperlane-asset-drain-2026',
  title: 'Hyperlane Asset Drain (August 2026)',
  metadata: {
    date: '2026-08-31',
    excerpt: 'On 31 August 2026 twenty-six transactions emptied every Hyperlane-bridged asset on Radix and sent the proceeds out over the bridge.',
  },
  content,
}];

// Voice guard: no em dash, no non-breaking space anywhere in the published HTML.
const html = JSON.stringify(content);
for (const [name, cp] of [['em dash', 0x2014], ['nbsp', 0x00a0]]) {
  if ([...html].some((c) => c.codePointAt(0) === cp)) throw new Error(`content contains a ${name}`);
}

if (process.argv.includes('--dry-run')) {
  console.log(`[dry] contents/history/hyperlane-asset-drain-2026 – ${content.length} blocks, ${html.length} bytes`);
  process.exit(0);
}

await insertPages(pages, 'contents/history', 'Records the 31 August 2026 drain of every Hyperlane-bridged asset on Radix: 26 transactions read from the ledger, the manifest of the largest, the amounts taken against remaining supply, and the resource authorities that show it was not a recall.');
