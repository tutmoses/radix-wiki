// sweep 450 – /ecosystem/weft-finance, "Protocol status". The section still described the market of
// 11 August: $301K on DeFiLlama, "one of the two largest deployments" on Radix, and 70 pool transactions
// a week as proof the deposits were in use. The 30 August exploit left both main pools lent out.
//
// Radix Gateway, pinned at_ledger_state 2026-09-17T17:40:00Z (epoch 341,698, state version 558,595,028):
//   Lending Pool V2 resource_pools KV (internal_keyvaluestore_rdx1kzjr763caq96j0kv883vy8gnf3jvrrp7dfm9zr5n0akryvzsxvyujc)
//     XRD    deposit 49,394,277.88  loan 47,716,877.19  (96.60%)  vault 1,779,772.42  interest_rate 0
//     LSULP  deposit 49,206,147.31  loan 49,202,904.42  (99.99%)  vault 4,452.00      interest_rate 0
//   Weftie #1138 (resource_rdx1nt22yfvhuuhxww7jnnml5ec3yt5pkxh0qlghm6f0hz46z2wfk80s9r), loan units / loan unit_ratio:
//     LSULP 47,202,009.98 / 0.993697 = 47,501,428.94 (96.54% of LSULP deposits)
//     XRD   11,877,595.35 / 0.899383 = 13,206,380.83 (26.74% of XRD deposits)
//     only collateral 0.000000000000016501 HUG; Default PriceFeed prices HUG at 0.0000000001 XRD.
//   Same KV at 2026-08-30T17:00Z: XRD 56.59m / 39.97m (70.64%), LSULP 52.81m / 1.92m (3.63%).
//   At 2026-08-31T03:15Z: XRD rate 10.17, LSULP 10.00. At the 11 Sep restart both 0 (set 20:08 and 20:51
//   UTC on 31 August); still 0 now.
//   Pool-touching transactions since 11:35 UTC 11 September (45): XRD repaid 1,600,421 + 505,000 +
//   503,000 + 251,084 + 871,000 = 3,730,505; XRD withdrawn 1,347,686 + 51,838 + 1,000,500 + 528,887 less
//   the 1,000,500 deposited on 13 September = 1,928,411 net. Market component: 31 transactions, 9 of them
//   `liquidate`, all on 17 September from 13:54 UTC; 3 `create_cdp`.
//   Market loan services: Borrow enabled only for XRD (and Global); LSULP disabled+locked since 31 Aug.
//   WEFT resource: total_supply 99,999,000 (minted 100,000,000, burned 1,000); minter and
//   minter_updater DenyAll; burner AllowAll, burner_updater DenyAll.
// docs.weft.finance/configuration/lending (200): UtilizationLimit 95%; XRD curve 100% to 1000% in the
//   90%-100% "Max Utilization" phase.
// DeFiLlama, 17 September: api.llama.fi/protocol/weft-finance latest $24,663 (13:13 UTC); Weft V2 $22,523,
//   V1 $2,140; peak $14,062,592 on 29 March 2025; Radix chain $383,138. Radix protocols by parent, CEX
//   excluded: CaviarNine $157.7K, Ociswap $58.2K, JustLock $56.2K, DefiPlaza $55.6K, Weft $24.7K. Category
//   Lending: Root Finance $1,051, SRWA Lending $182 (Flux, $1,127, is CDP). XRD (coins.llama.fi) $0.000903 on 11 Aug, $0.000713 on 17 Sep.
// Telegram t.me/WeftFinance/32904-32906 (author "Atoumbre | Weft", read in run 449).
//
// Also: the 16 September statement moves here from the validator section, which keeps only the
// validator half of it; tickers in that section gain their cashtags; the infobox Status and TVL rows.
//
//   node scripts/sweep-450-weft-protocol-status.mjs --dry-run

import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, assertLinkShapes, withClient } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const TAG = 'ecosystem';
const SLUG = 'weft-finance';
const VERSION = '4.12.0';
const SENTINEL = 'Owed by #1138';
const EMDASH = String.fromCharCode(0x2014);
const NBSP = String.fromCharCode(0xa0);

const ext = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const int = (href, text) => `<a href="${href}" rel="noopener">${text}</a>`;
const LLAMA = 'https://defillama.com/protocol/weft-finance';
const MARKET = 'https://dashboard.radixdlt.com/component/component_rdx1cpy6putj5p7937clqgcgutza7k53zpha039n9u5hkk0ahh4stdmq4w';
const POOL = 'https://dashboard.radixdlt.com/component/component_rdx1czmr02yl4da709ceftnm9dnmag7rthu0tu78wmtsn5us9j02d9d0xn';
const WEFTIE = 'https://dashboard.radixdlt.com/nft/resource_rdx1nt22yfvhuuhxww7jnnml5ec3yt5pkxh0qlghm6f0hz46z2wfk80s9r%3A%231138%23';
const STATEMENT = 'https://t.me/WeftFinance/32906';

const STATUS =
  '<h2>Protocol status</h2>'
  + `<p>Weft V2 is still running on Radix mainnet. Since the network ${int('/contents/history/hyperlane-asset-drain-2026', 'restarted on 11 September 2026')} after a ten-day halt, borrowers have repaid 3.73m $XRD of loans and lenders have withdrawn a net 1.93m $XRD, and on 17 September the ${ext(MARKET, 'lending market')} ran nine liquidations, its first since the halt. `
  + 'Anyone can still open a position and repay a loan, and $XRD is the only asset the market will lend.</p>'
  + `<p>Lenders can take out very little. On 30 August an attacker used a price-feed error to borrow everything the market would lend, and the $XRD and $LSULP ${ext(POOL, 'pools')} it drew on are still almost entirely lent. `
  + `Read from the ${ext('https://docs.radixdlt.com/docs/network-gateway', 'Radix Gateway')} at 17:40 UTC on 17 September:</p>`
  + '<table><thead><tr><th>Pool</th><th>Deposited</th><th>Lent out</th><th>Lent before the exploit</th><th>In the pool</th><th>Owed by #1138</th></tr></thead><tbody>'
  + '<tr><td>$XRD</td><td>49.4m</td><td>47.7m (97%)</td><td>71%</td><td>1.8m</td><td>13.2m</td></tr>'
  + '<tr><td>$LSULP</td><td>49.2m</td><td>49.2m (99.99%)</td><td>4%</td><td>4,452</td><td>47.5m</td></tr>'
  + '</tbody></table>'
  + `<p>${ext(WEFTIE, 'Weftie #1138')} is the position the attacker opened. Its debt is 97% of everything deposited in the $LSULP pool and 27% of the $XRD pool. `
  + `Its only collateral is 0.0000000000000165 ${int('/ecosystem/hug', '$HUG')}, a token the price feed has valued at 0.0000000001 $XRD since 31 August, so liquidating it would recover nothing.</p>`
  + `<p>Weft’s ${ext('https://docs.weft.finance/configuration/lending', 'configuration page')} caps lending at 95% of a pool’s deposits, so the $XRD pool cannot make a new loan until repayments or deposits bring it back under that line. `
  + 'The same page sets the $XRD interest rate at 100% to 1,000% a year once a pool is more than 90% lent, and at 03:15 UTC on 31 August the $XRD pool’s rate read 1,017%. '
  + 'By that evening the $XRD and $LSULP rates had been set to zero, and on 17 September they still were. Weft’s 30 August statement had promised two interest-free weeks.</p>'
  + `<p>In dollars the protocol is a twelfth of its August size. ${ext(LLAMA, 'DeFiLlama')} counts $25K in Weft V1 and V2 together on 17 September, against $301K on 11 August and a peak of $14.06M on 29 March 2025; the price of $XRD fell by a fifth over the same period. `
  + `The $25K is 6% of the ${ext('https://defillama.com/chain/Radix', '$383K DeFiLlama counts across Radix DeFi')}, down from 28% in August. `
  + `On the same count Weft is still the largest lending market on Radix, where the next, ${int('/ecosystem/root-finance', 'Root Finance')}, holds about $1K, but it now ranks fifth among the network’s deployments, behind ${int('/ecosystem/caviarnine', 'CaviarNine')}, ${int('/ecosystem/ociswap', 'Ociswap')}, JustLock and ${int('/ecosystem/defiplaza', 'DefiPlaza')}.</p>`
  + `<p>The <strong>$WEFT</strong> token’s supply is fixed on-ledger. The ${ext('https://dashboard.radixdlt.com/resource/resource_rdx1tk3fxrz75ghllrqhyq8e574rkf4lsq2x5a0vegxwlh3defv225cth3', 'resource')} holds 99,999,000 $WEFT, unchanged since it was first read here in August. `
  + 'Its minter rule is <code>deny_all</code> and cannot be changed, and its burner rule is <code>allow_all</code>, so the supply can only fall.</p>'
  + `<p>On 16 September Weft’s team posted for the first time since the restart. In ${ext(STATEMENT, 'Weft’s Telegram group')}, co-founder Atoumbré Kouassi wrote that the team had taken some days off, had not abandoned the project and was discussing its next move internally, and that it would share the details on Friday 18 September.</p>`;

const INFOBOX_SWAPS = [
  ['<td><strong>Status</strong></td><td>🟢 Active – V2 live on Radix mainnet</td>',
   '<td><strong>Status</strong></td><td>🟢 Active – V2 live on Radix mainnet; its XRD and LSULP pools almost fully lent since the 30 Aug 2026 exploit</td>'],
  [`<td><strong>TVL (11 Aug 2026)</strong></td><td>≈ $301K (V2 + V1); peak ≈ $14.06M on 29 Mar 2025 – ${ext(LLAMA, 'DeFiLlama')}</td>`,
   `<td><strong>TVL (17 Sep 2026)</strong></td><td>≈ $25K (V2 + V1), from $301K on 11 Aug 2026; peak ≈ $14.06M on 29 Mar 2025 – ${ext(LLAMA, 'DeFiLlama')}</td>`],
];

const VALIDATOR_SWAPS = [
  [`Weft’s team posted on 16 September for the first time since the restart. In ${ext(STATEMENT, 'Weft’s Telegram group')} at 13:16 UTC, co-founder Atoumbré Kouassi wrote that the team had taken some days off, had not abandoned the project, and plans to restart the validator. The message came two days after a member ${ext('https://t.me/WeftFinance/32896', 'asked in the same group')}`,
   `Kouassi’s ${ext(STATEMENT, '16 September message')}, described under Protocol status above, also says the team plans to restart the validator. It came two days after a member ${ext('https://t.me/WeftFinance/32896', 'asked in Weft’s Telegram group')}`],
  [' Kouassi said the team would share details of its next move on Friday 18 September.</p>', '</p>'],
  ['186.2m XRD of', '186.2m $XRD of'],
  ['a little more XRD every epoch', 'a little more $XRD every epoch'],
  ['redeemed for 1.174307 XRD at', 'redeemed for 1.174307 $XRD at'],
  ['to 1.227503 XRD.', 'to 1.227503 $XRD.'],
  ['unstaked 9m XRD from', 'unstaked 9m $XRD from'],
  ['a further 151,000 XRD in', 'a further 151,000 $XRD in'],
  ['stakes the XRD with', 'stakes the $XRD with'],
];

const MESSAGE =
  'Protocol status rewritten from the 17 September 2026 ledger. It still described 11 August: $301K on DeFiLlama, one of the two largest '
  + 'deployments on Radix, and 70 pool transactions a week. Radix Gateway at 17:40 UTC (epoch 341,698): the XRD pool is 96.6% lent '
  + '(49.39m deposited, 47.72m lent, 1.78m in the vault) and the LSULP pool 99.99% (49.21m, 49.20m, 4,452), against 70.6% and 3.6% on '
  + '30 August; the exploit position, Weftie #1138, owes 47.50m LSULP and 13.21m XRD against 0.0000000000000165 HUG priced at '
  + '0.0000000001 XRD. XRD is the only asset with Borrow enabled, the pool is over the 95% UtilizationLimit in docs.weft.finance/configuration/lending, '
  + 'and both rates have read zero since 31 August. Since the 11 September restart borrowers repaid 3.73m XRD, lenders withdrew 1.93m net, '
  + 'and nine liquidations ran on 17 September. DeFiLlama: $24.7K (17 Sep) of $383K on Radix; fifth by protocol behind CaviarNine, Ociswap, '
  + 'JustLock and DefiPlaza; still the largest lender (next, Root Finance, $1.05K). WEFT supply unchanged at 99,999,000. The 16 September '
  + 'team statement (t.me/WeftFinance/32906) moves here from the validator section, which keeps its validator half; cashtags added there. '
  + 'Infobox Status and TVL rows updated.';

function swapOnce(text, [from, to], where) {
  const n = text.split(from).length - 1;
  if (n !== 1) throw new Error(`${where}: expected 1 match, got ${n}: ${from.slice(0, 70)}`);
  return text.replace(from, () => to);
}

for (const [, to] of [...INFOBOX_SWAPS, ...VALIDATOR_SWAPS, ['', STATUS]])
  if (to.includes(EMDASH) || to.includes(NBSP) || to.includes('&nbsp;')) throw new Error('new text carries an em dash or non-breaking space');

await withClient(async (client) => {
  if (isLockedPage(TAG, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const before = JSON.stringify(page.content);
  if (before.includes(SENTINEL)) {
    console.log('  already applied - no write');
    return;
  }
  if (page.version !== '4.11.0') throw new Error(`page is at v${page.version}, not the 4.11.0 this edit was written against; re-read first`);

  const blocks = JSON.parse(before);

  const lead = blocks.find((b) => b.id === 'block-weft-finance-1');
  if (!lead) throw new Error('lead block missing');
  const start = lead.text.indexOf('<h2>Protocol status</h2>');
  const end = lead.text.indexOf('<h2><strong>History</strong></h2>');
  if (start < 0 || end < start) throw new Error('Protocol status bounds not found');
  const old = lead.text.slice(start, end);
  if (!old.includes('70 transactions in the seven days to 11 August 2026') || !old.includes('one of the two largest deployments'))
    throw new Error('Protocol status no longer matches the 11 August text; re-read before editing');
  lead.text = lead.text.slice(0, start) + STATUS + '\n' + lead.text.slice(end);
  if (/\$\$|\\\(|\\\[/.test(lead.text)) throw new Error('lead block would trigger KaTeX, and its $ amounts would render as maths');

  const box = blocks[0]?.type === 'infobox' ? blocks[0].blocks?.[0] : null;
  if (!box?.text?.includes('<th colspan="2">Weft Finance</th>')) throw new Error('infobox table missing');
  for (const s of INFOBOX_SWAPS) box.text = swapOnce(box.text, s, 'infobox');

  const val = blocks.find((b) => b.id === 'e248f39c-72f7-448e-9178-ec1f7189227e');
  if (!val?.text?.includes('t.me/WeftFinance/32906')) throw new Error('validator block is not the run 449 text');
  for (const s of VALIDATOR_SWAPS) val.text = swapOnce(val.text, s, 'validator');
  if (/ XRD\b/.test(val.text)) throw new Error('validator block still has a bare XRD');

  assertLinkShapes(blocks, SLUG);
  const json = JSON.stringify(blocks);
  if (json.includes(EMDASH) || json.includes(NBSP)) throw new Error('em dash or U+00A0 in output');
  if (!json.includes(SENTINEL)) throw new Error('sentinel missing after edit');
  if ((json.match(/Friday 18 September/g) ?? []).length !== 1) throw new Error('the Friday date should appear once');

  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${VERSION}  (${json.length - before.length} chars)`);
  if (DRY) {
    console.log(`\n--- old\n${old}\n--- new\n${STATUS.replace(/<\/(p|table)>/g, '</$1>\n')}\n--- infobox\n${INFOBOX_SWAPS.map((s) => s[1]).join('\n')}\n--- validator\n${val.text.replace(/<\/p>/g, '</p>\n')}`);
    return;
  }

  const now = new Date().toISOString();
  await client.query('BEGIN');
  await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, VERSION, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, VERSION, 'minor', AUTHOR_ID, MESSAGE, now]);
  await client.query('COMMIT');
  console.log('  written');
});
