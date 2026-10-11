// Run 572 (ecosystem rotation): DEFIPLAZA. The Status section's last moving-ledger reading was
// 27 August; this adds the October reading, a month after the restart, before the Team section.
import { isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ecosystem';
const SLUG = 'defiplaza';
const SENTINEL = 'id="october-2026"';

const SECTION = `<h2 id="october-2026">October 2026</h2><p>Read on 11 October 2026, a month after the network restarted, DeFiPlaza's <a href="https://defiplaza.net/api/pairs" target="_blank" rel="noopener">pairs endpoint</a> lists the same 156 pairs holding about $40,400, with 33 above $100 and 9 above $1,000. <a href="https://api.llama.fi/protocol/defiplaza" target="_blank" rel="noopener">DefiLlama</a> puts the Radix deployment at about $13,300 and the Ethereum one at $9,200, so the two sources still disagree, now by a factor of three.</p><p>Neither figure reflects liquidity leaving. The base pool of the $XRD/DFP2 pair holds 7.91m $XRD on the <a href="https://mainnet.radixdlt.com/state/entity/details" target="_blank" rel="noopener">ledger</a> (state version 562,452,851), up from 7.53m at the halt. The dollar values fell because $XRD did, from about $0.001 in mid-August to $0.0003 (<a href="https://www.coingecko.com/en/coins/radix" target="_blank" rel="noopener">CoinGecko</a>).</p><p>Trading has resumed at a smaller scale. DefiLlama's <a href="https://api.llama.fi/summary/dexs/defiplaza" target="_blank" rel="noopener">volume series</a> records about $21,800 on Radix in the 30 days to 11 October and nothing on Ethereum. The pairs endpoint's own volume field reads zero on every pair, as it did during the halt.</p>`;

await withClient(async (client) => {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied – no write');
    return;
  }

  const body = blocks[1];
  if (body.text.split('<h2>Team</h2>').length !== 2) throw new Error('Team heading not found exactly once');
  body.text = body.text.replace('<h2>Team</h2>', `${SECTION}<h2>Team</h2>`);

  const version = await writeRevision(client, page, blocks, {
    change: 'minor',
    message: 'October 2026 reading, a month after the restart: pairs endpoint 156 pairs at ~$40,400, DefiLlama Radix ~$13,300 and Ethereum ~$9,200. XRD/DFP2 base pool 7.91m XRD on the ledger at state version 562,452,851, up from 7.53m at the halt, so the fall is the XRD price (~$0.001 to ~$0.0003). DefiLlama Radix volume ~$21,800 over 30 days; endpoint volume field still zero.',
    verified: true,
    dry: DRY,
  });
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
});
