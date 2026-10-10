// Sweep 566: /ecosystem/hyperlane had not moved since the 12 September restart edit. Since then the
// trapped-USDC question has run through temperature check #7 and governance proposal #3 (closed 4 Oct,
// 95% for reimbursing the original hUSDC holders), Hyperlane agreed on 8 Oct to help release the stuck
// collateral (t.me/radix_dlt/1007057), the Foundation published the refund breakdown on 9 Oct, and
// it has said it will not reopen the routes until the assets are secured (t.me/RadixAnnouncements/2781).
// The six supplies were re-read live at state version 562,200,977 (15:07 UTC 10 Oct): unchanged.
// The full account lives on the drain page; this page gets the state of the routes and one pointer.
import { isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ecosystem';
const SLUG = 'hyperlane';
const SENTINEL = 'id="routes-closed"';

const INFOBOX_FROM = `and none has minted or burned since; Radix mainnet was halted from 21:19 UTC that day until 11 September 2026</td>`;
const INFOBOX_TO = `and none has minted or burned since. Radix mainnet was halted from 21:19 UTC that day until 11 September 2026. The routes stay closed until the Foundation recovers the stuck hUSDC collateral</td>`;

const DRAIN_FROM = `Nothing has been minted or burned through a Radix warp route since the network came back.</p>`;
const DRAIN_TO = `${DRAIN_FROM}<p id="routes-closed">The routes have stayed closed since. The Foundation <a href="https://t.me/RadixAnnouncements/2781" target="_blank" rel="noopener">will not reopen them</a> until it has secured about 443k USDC of collateral, which the attacker's last bridge-out burned on Radix but never collected on the other side. Radix governance decided on 4 October, in <a href="https://consultation.mountain-top.live/proposal/3" target="_blank" rel="noopener">proposal #3</a>, to return that collateral to the accounts that held hUSDC before the theft, and on 8 October Hyperlane <a href="https://t.me/radix_dlt/1007057" target="_blank" rel="noopener">agreed to help release it</a>. Until the refund is paid, Astrolescent carries XRD to and from ETH through RocketX instead, limited to around 500 US dollars a trade. Re-read at state version 562,200,977 on 10 October, all six supplies are where the drain left them. The vote, the refund list and the code that computes it are on <a href="/contents/history/hyperlane-asset-drain-2026#the-trapped-usdc" rel="noopener">the drain page</a>.</p>`;

await withClient(async (client) => {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) { console.log('  already applied – no write'); return; }

  const flat = blocks.flatMap((b) => [b, ...(b.blocks ?? [])]);
  for (const [from, to] of [[INFOBOX_FROM, INFOBOX_TO], [DRAIN_FROM, DRAIN_TO]]) {
    const hits = flat.filter((b) => b.text?.includes(from));
    if (hits.length !== 1) throw new Error(`matched ${hits.length} blocks for: ${from.slice(0, 60)}`);
    hits[0].text = hits[0].text.replace(from, to);
  }

  const version = await writeRevision(client, page, blocks, {
    change: 'minor',
    message: 'Since the restart: the routes stay closed until the stuck hUSDC collateral is recovered (t.me/RadixAnnouncements/2781); governance proposal #3 chose reimbursement of the original hUSDC holders on 4 Oct; Hyperlane agreed to help release the collateral on 8 Oct (t.me/radix_dlt/1007057); RocketX carries XRD-ETH on Astrolescent meanwhile. Six supplies re-read unchanged at state version 562,200,977.',
    verified: true,
    dry: DRY,
  });
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
});
