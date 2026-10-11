// Run 570 (ecosystem rotation): RSwap said on 11 Sep it would add liquidity back in "a week or two".
// Read a month on, the deepest pool is down a further 99%; records the position and an infobox row.
import { isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ecosystem';
const SLUG = 'rswap';
const SENTINEL = 'id="rswap-october"';

const POOL = 'https://dashboard.radixdlt.com/pool/pool_rdx1ch7xn38jgrfzmpk6392z3twh9zhh7w8hqgz8s9cvmcj0yhv3xzck8e';
const GATEWAY = 'https://mainnet.radixdlt.com/state/entity/details';
const API = 'https://dex.reddicks.meme/api/pairs';
const STATEMENT = 'https://t.me/radix_dlt/1003095';
const a = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

const ANCHOR = 'is checkable from about 25 September 2026.</p>';
const SECTION = `<h3 id="rswap-october">One month on</h3><p>The liquidity has not come back. Read from the ${a(GATEWAY, 'Radix Gateway')} on 11 October 2026, ${a(POOL, 'the LSULP/DCKS base pool')} holds 6,847 LSULP, against 999,985 on 12 September, and the pair's two pools together hold 25,635 LSULP and 5.35m DCKS. The venue's ${a(API, 'pair API')} returns the same 25,635 and reports no trading volume in the preceding 24 hours on any of the 65 pairs. The pool is still in use: the most recent transaction touching it committed on 10 October. RSwap has not said in the main Radix Telegram group when it will add liquidity back since its ${a(STATEMENT, '11 September statement')}.</p>`;

const ROW_ANCHOR = 'down from 17,533,687.62</td></tr>';
const ROW = '<tr><td><strong>Position, 11 October 2026</strong></td><td>Liquidity not added back; the deepest pool holds 6,847 LSULP and no pair traded in the preceding 24 hours</td></tr>';

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

  const restart = blocks.find((b) => b.text?.includes(ANCHOR));
  if (!restart) throw new Error('after-restart anchor not found');
  restart.text = restart.text.replace(ANCHOR, ANCHOR + SECTION);

  const ib = blocks[0]?.blocks?.[0];
  if (!ib?.text?.includes(ROW_ANCHOR)) throw new Error('infobox row anchor not found');
  ib.text = ib.text.replace(ROW_ANCHOR, ROW_ANCHOR + ROW);

  const version = await writeRevision(client, page, blocks, {
    change: 'minor',
    message: 'One month on: RSwap has not added liquidity back after its 11 Sep "a week or two" statement. LSULP/DCKS base pool 6,847 LSULP (999,985 on 12 Sep), pair total 25,635 LSULP and 5.35m DCKS, zero 24h volume on all 65 pairs; Gateway at state version 562,370,404 and dex.reddicks.meme/api/pairs, 11 Oct 2026. Infobox position row added.',
    verified: true,
    dry: DRY,
  });
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
});
