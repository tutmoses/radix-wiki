// Sweep 559: the per-account breakdown of the ~443k hUSDC held by the stuck bridge transfer,
// published 9 Oct 2026 with the code that computes it. Sources: Timan's post in Radix DLT
// Official at 11:04 UTC 9 Oct (t.me/radix_dlt/1007112), the account-husdc sheet it links, and
// tools/husdc-recovery in timanrebel/radix-incentives (README, reconciliation.json).
import { isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'contents/history';
const SLUG = 'hyperlane-asset-drain-2026';
const SENTINEL = 'gp3-breakdown';
const POST = 'https://t.me/radix_dlt/1007112';
const SHEET = 'https://docs.google.com/spreadsheets/d/1QT7qrwQ38ud8MwVUyRHM-6CY7YBr5dD5_jo9jrTUue4/edit?usp=sharing';
const CODE = 'https://github.com/timanrebel/radix-incentives/tree/main/tools/husdc-recovery';
const RECON = 'https://github.com/timanrebel/radix-incentives/blob/main/output/husdc-recovery/reconciliation.json';

const EDITS = [
  // infobox Recovery row
  ['Not yet recovered; on 8 October <a href="https://t.me/radix_dlt/1007057" target="_blank" rel="noopener">Hyperlane agreed to help release it</a></td>',
   `Not yet recovered; on 8 October <a href="https://t.me/radix_dlt/1007057" target="_blank" rel="noopener">Hyperlane agreed to help release it</a>, and on 9 October the Foundation published <a href="${SHEET}" target="_blank" rel="noopener">the 79 accounts due 360,851 hUSDC</a></td>`],
  // after the Hyperlane paragraph
  ['are not part of the refund.</p>',
   `are not part of the refund.</p><p id="${SENTINEL}">He published it at 11:04&nbsp;UTC on 9 October: <a href="${SHEET}" target="_blank" rel="noopener">a sheet of every account due a refund</a>, and <a href="${CODE}" target="_blank" rel="noopener">the code that produced it</a>, adapted from the Radix Incentives campaign's, which anyone can rerun against the public Gateway <a href="${POST}" target="_blank" rel="noopener">and is asked to check</a>. The code reads the ledger at state version 557,756,613, the last before the theft, and traces the 442,986 hUSDC burned in the stuck transfer to the 59 accounts and components it was taken from. 360,851 hUSDC goes to 79 accounts, each paid for what it held in its own wallet plus its share of what it had in pools, <a href="/ecosystem/caviarnine" rel="noopener">CaviarNine</a> liquidity positions, order-book orders and <a href="/ecosystem/stabilis" rel="noopener">Stabilis</a> loans. 4,798 hUSDC goes back into the reserve of <a href="/ecosystem/flux" rel="noopener">Flux</a> rather than to the four people who deposited it, because they were given fUSD in exchange, which they could pass on, and whoever holds that fUSD now has the claim on the reserve. The 76,318 hUSDC that sat in XHSWAP is held back for that project, and 1,017 hUSDC that came out of <a href="/ecosystem/weft-finance" rel="noopener">Weft</a> could not be traced to any account. The code's <a href="${RECON}" target="_blank" rel="noopener">own reconciliation</a> marks the result ready to pay but not fully reconciled, since those last two sums are not assigned to accounts. Nothing is paid until the collateral reaches a wallet the Foundation controls and is reissued as hUSDC.</p>`],
  // What is unresolved
  ['but on 8 October <a href="#gp3-hyperlane">Hyperlane agreed to help</a>.',
   `but on 8 October <a href="#gp3-hyperlane">Hyperlane agreed to help</a>, and on 9 October the Foundation published <a href="#${SENTINEL}">which accounts it will pay</a>.`],
];

const swap = (b, from, to) => {
  let n = 0;
  if (b.text?.includes(from)) { b.text = b.text.replace(from, to); n++; }
  for (const c of b.blocks ?? []) n += swap(c, from, to);
  return n;
};

await withClient(async (client) => {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) { console.log('  already applied – no write'); return; }
  for (const [from, to] of EDITS) {
    const n = blocks.reduce((s, b) => s + swap(b, from, to), 0);
    if (n !== 1) throw new Error(`edit matched ${n} times: ${from.slice(0, 60)}`);
  }
  const version = await writeRevision(client, page, blocks, {
    change: 'minor',
    message: 'GP3 recovery breakdown published 11:04 UTC 9 Oct (t.me/radix_dlt/1007112): 79 accounts due 360,851 hUSDC at snapshot 557,756,613, 4,798 restored to the Flux reserve, 76,318 XHSWAP held back, 1,017 Weft unattributed; code at timanrebel/radix-incentives tools/husdc-recovery. New paragraph p#gp3-breakdown, infobox Recovery row, What is unresolved sentence.',
    verified: true, dry: DRY,
  });
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
});
