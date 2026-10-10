// Run 568 (ecosystem rotation): Stabilis's loan book is almost entirely hUSDC-backed, and the
// exploit emptied that vault. Corrects the collateral bullets and replaces the 1 Aug scale section.
import { uid, isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ecosystem';
const SLUG = 'stabilis';
const SENTINEL = 'id="stabilis-husdc"';

const COMPONENT = 'https://dashboard.radixdlt.com/component/component_rdx1cq70cjajtvllgk9z9wm9l8v6w8hsgtlw530cdgpraxprn4yevg89kf';
const STAB = 'https://dashboard.radixdlt.com/resource/resource_rdx1t40lchq8k38eu4ztgve5svdpt0uxqmkvpy4a2ghnjcxjtdxttj9uam';
const RECOVERY = 'https://github.com/timanrebel/radix-incentives/blob/main/tools/husdc-recovery/PROTOCOL_REQUESTS.md';
const OCISWAP = 'https://ociswap.com/resource_rdx1t40lchq8k38eu4ztgve5svdpt0uxqmkvpy4a2ghnjcxjtdxttj9uam';
const a = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

const OLD_BULLETS = [
  '<li>A Minimum Collateralization Ratio (MCR) of 150% for all collateral types.</li>',
  '<li>Currently, only XRD (the native token of Radix) is accepted as collateral.</li>',
];
const NEW_BULLETS = [
  '<li>A Minimum Collateralization Ratio (MCR) of 150% for XRD and LSULP, and 100% for hUSDC.</li>',
  `<li>${a(COMPONENT, 'The Stabilis component accepts three collaterals')}: XRD, LSULP (the CaviarNine LSU pool token) and hUSDC.</li>`,
];

const SCALE = `<h2 id="stabilis-husdc">Scale on Ledger and the hUSDC Loans (as of 10 October 2026)</h2>
<p>Read from mainnet at epoch 348,387 on 10 October 2026, the ${a(STAB, 'STAB resource')} has a total supply of 2,642 STAB, against 2,666 on 1 August. STAB is minted only when a borrower opens a loan, so that supply is the protocol's whole loan book.</p>
<p>Almost all of it is borrowed against hUSDC, the USDC copy brought to Radix over the Hyperlane bridge. The ${a(COMPONENT, 'Stabilis component')} records 2,641 STAB minted against 3,015 hUSDC in 12 open loans, 1.5 STAB against LSULP and none against XRD. Its hUSDC vault has held nothing since the transaction that drained it in the <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">Hyperlane asset drain</a>, so those loans now rest on collateral the component no longer holds.</p>
<p>The ${a(RECOVERY, 'recovery plan for the drain')} counts the 3,015 hUSDC in its payout. It pays them to the two accounts that held the 12 loan positions immediately before the exploit, rather than back into the Stabilis component.</p>
<p>On ${a(OCISWAP, 'Ociswap')}, where STAB has been listed since October 2024, it trades around 0.45 dollars against the internal price of 1.14 that the interest-rate controller works from, in a pool holding about 13 dollars with no trades in the last day. The ILIS DAO has not published what happens to the 12 loans once the recovery pays out.</p>`;

await withClient(async (client) => {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (blocks.some((b) => b.text?.includes(SENTINEL))) {
    console.log('  already applied – no write');
    return;
  }

  const main = blocks.find((b) => b.text?.includes(OLD_BULLETS[1]));
  if (!main) throw new Error('collateral bullet not found');
  OLD_BULLETS.forEach((old, i) => {
    if (!main.text.includes(old)) throw new Error(`bullet ${i} not found`);
    main.text = main.text.replace(old, NEW_BULLETS[i]);
  });

  const scaleIdx = blocks.findIndex((b) => b.text?.startsWith('<h2>Scale on Ledger (as of 1 August 2026)</h2>'));
  if (scaleIdx < 0) throw new Error('1 Aug scale block not found');
  blocks[scaleIdx] = { id: uid(), type: 'content', text: SCALE };

  const version = await writeRevision(client, page, blocks, {
    change: 'minor',
    message: 'Collateral: the component accepts XRD and LSULP at 150% and hUSDC at 100%, not XRD alone. Replaced the 1 Aug scale section: 2,641 of 2,642 STAB is minted against 3,015 hUSDC in 12 loans, whose vault the Hyperlane drain emptied; the recovery plan pays it to the two loan holders. Read on-ledger at epoch 348,387, Ociswap API 10 Oct.',
    verified: true,
    dry: DRY,
  });
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
});
