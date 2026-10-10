// Sweep 566: /ecosystem/flux v1.0.0 said fUSD "exists only where someone has borrowed it", so the
// 5,608.56 in existence was the whole loan book. It is not. A second component, FluxAddition
// (component_rdx1cp570u943d2km09fw5zxppwa3794wynp0gpfjecqs7g80r4knextx0), mints fUSD against deposited
// hUSDC at usd_per_fusd 1.005 and redeems it back (mint_with_usd / redeem_with_fusd). Read live at
// state version 562,201,387 on 10 Oct: its usd_tokens store holds one entry, hUSDC, accepted, with
// fusd_minted 4,774.616915 (x 1.005 = 4,798.49 hUSDC, the exact figure the Foundation's refund code
// restores to this component: timanrebel/radix-incentives tools/husdc-recovery/PROTOCOL_REQUESTS.md).
// So about 834 fUSD is borrowed and the rest was swapped in. fUSD supply re-read at state version
// 562,201,273: 5,608.564528, unchanged since 11 Sep.
import { isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ecosystem';
const SLUG = 'flux';
const SENTINEL = 'id="husdc-reserve"';
const ADDITION = `<a href="https://dashboard.radixdlt.com/component/component_rdx1cp570u943d2km09fw5zxppwa3794wynp0gpfjecqs7g80r4knextx0" target="_blank" rel="noopener">FluxAddition</a>`;
const REQUESTS = `https://github.com/timanrebel/radix-incentives/blob/main/tools/husdc-recovery/PROTOCOL_REQUESTS.md`;

const EDITS = [
  [
    `It exists only where someone has borrowed it, so the total in existence is also the protocol's entire outstanding loan book.</p>`,
    `It is created in two ways: a borrower mints it against collateral, or anyone deposits a dollar stablecoin in a second component, ${ADDITION}, and receives one fUSD for every 1.005 dollars deposited, which can be redeemed the same way. The only stablecoin FluxAddition has accepted is hUSDC, the USDC bridged onto Radix by <a href="/ecosystem/hyperlane" rel="noopener">Hyperlane</a>.</p>`,
  ],
  [
    `Because $fUSD is minted only against collateral, the first row is the whole loan book.`,
    `The first row is not the loan book: FluxAddition records 4,775 fUSD minted against hUSDC, so the three open loans account for about 834.`,
  ],
  [
    `want reconciling before either is relied on.</p>`,
    `want reconciling before either is relied on.</p><p id="husdc-reserve">The hUSDC behind FluxAddition's fUSD, 4,798 of it, was taken in the <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">drain of 31 August 2026</a>. The Foundation's refund calculation of 9 October <a href="${REQUESTS}" target="_blank" rel="noopener">returns all of it to the FluxAddition component</a> rather than to the four accounts that deposited it, because the fUSD they received is transferable and whoever holds it now has the claim on the reserve. Nothing is paid until the Foundation recovers the stuck collateral from Hyperlane. Re-read on 10 October at state version 562,201,273, the supply of fUSD had not changed since 11 September.</p>`,
  ],
];

await withClient(async (client) => {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) { console.log('  already applied – no write'); return; }

  for (const [from, to] of EDITS) {
    const hits = blocks.filter((b) => b.text?.includes(from));
    if (hits.length !== 1) throw new Error(`matched ${hits.length} blocks for: ${from.slice(0, 60)}`);
    hits[0].text = hits[0].text.replace(from, to);
  }

  const version = await writeRevision(client, page, blocks, {
    change: 'minor',
    message: 'Correct the claim that fUSD exists only as loans: FluxAddition (component_rdx1cp570u...knextx0) mints fUSD against hUSDC at 1.005 USD each, 4,775 fUSD outstanding, so the three loans are about 834. Record that the 4,798 hUSDC reserve was taken on 31 Aug and that the 9 Oct refund calculation restores it to the component (timanrebel/radix-incentives PROTOCOL_REQUESTS.md). fUSD supply re-read unchanged at state version 562,201,273.',
    verified: true,
    dry: DRY,
  });
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
});
