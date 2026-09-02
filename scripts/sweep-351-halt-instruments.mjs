// Run 351, ecosystem rotation. The halt's third calendar day, read from the ecosystem side
// rather than the Gateway side. The Gateway fails closed — every read endpoint HTTP 500 with a
// self-reported 107,377-second sync delay — but the dApp APIs stacked on top of it fail OPEN:
// Ociswap quotes an XRD market cap identical to thirty-six decimal places at 1h, 24h and now,
// and Astrolescent still prices the six drained hAssets, hUSDC at 0.7467 and hUSDT at 0.4470,
// for tokens whose remaining supply on Radix is the residue in this page's own table.
// Measured directly at 03:04–03:12 UTC on 2 September 2026.
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'contents/history';
const SLUG = 'hyperlane-asset-drain-2026';
const SENTINEL = 'id="day-three-instruments"';
const DRY = process.argv.includes('--dry-run');

const SECTION = `<h2 id="day-three-instruments">Day three: the instruments that did not notice</h2>` +
  `<p>Re-read at <strong>03:04:16 UTC on 2 September 2026</strong>, the <a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">Gateway status endpoint</a> returns the same ledger for the seventh consecutive reading &mdash; state version 557,840,622, epoch 339,896, round 102, proposer round timestamp 21:19:06.179 UTC &mdash; <strong>twenty-nine hours and forty-five minutes</strong> without a committed round. The read endpoints state the gap themselves: <code>/state/entity/details</code>, <code>/state/validators/list</code>, <code>/stream/transactions</code> and <code>/transaction/construction</code> all answer HTTP 500 with <code>current_sync_delay_seconds</code> 107,377 against a <code>max_allowed_sync_delay_seconds</code> of 720, in the words &ldquo;it is currently 1 day, 5 hours, 49 minutes, 37 seconds behind&rdquo;.</p>` +
  `<p>One layer above that, the ecosystem's own read surfaces are answering normally, and what they are answering with is the halt. <a href="https://api.ociswap.com/tokens" target="_blank" rel="noopener">Ociswap's token API</a> returns HTTP 200, and XRD's circulating market capitalisation reads 7,945,385.587233559518230284332481276342396505 US dollars at the 1-hour window, at the 24-hour window and at <code>now</code> &mdash; the same figure to the last of its thirty-six decimal places. Only the 7-day window differs, at 11,811,840.45. A twenty-four-hour period with nothing in it looks, to an aggregator, exactly like a very quiet market.</p>` +
  `<p><a href="https://api.astrolescent.com/prices" target="_blank" rel="noopener">Astrolescent's price feed</a> returns 876 tokens, ninety-nine of them reporting a twenty-four-hour volume of exactly zero, and it still quotes the assets the drain removed. hUSDC reads <strong>0.7467</strong> US dollars and hUSDT <strong>0.4470</strong> &mdash; dollar stablecoins priced a quarter and a half below par &mdash; alongside hETH at 1,295.09, hWBTC at 58,302.64 and hSOL at 57.74. Those are the last prices the pools produced before the network stopped, held for a day and a quarter and served as current, for tokens whose remaining supply on Radix is the residue in the table above: 1,092.79 hUSDC and 0.036292 hUSDT. Nothing in this layer is wrong, exactly. It is the halt, cached.</p>` +
  `<p>The frontends divide on the same line. Static shells serve: <code>ociswap.com</code>, <code>astrolescent.com</code>, <code>app.weft.finance</code>, <code>surge.trade</code>, <code>defiplaza.net</code>, <code>dex.reddicks.meme</code>, <code>radquest.io</code>, <code>radixscan.io</code> and <code>radixplanet.com</code> all returned 200 through their own redirects. Pages that need a live read do not: an <code>astrolescent.com/token/&lt;resource&gt;</code> page answers HTTP 500 and <code>stats.defiplaza.net</code> times out after twenty seconds. <code>app.caviarnine.com</code> refuses connections, which belongs to <a href="/ecosystem/caviarnine" rel="noopener">CaviarNine</a>'s own wind-down rather than to the halt.</p>` +
  `<p>Nothing official has been added since the previous reading. The <a href="https://t.me/RadixAccountabilityCouncil/936" target="_blank" rel="noopener">Council's four-step account of the fix</a> at 12:16 UTC on 1 September is still its last word, fifteen hours later; <a href="https://github.com/radixdlt/babylon-node/releases" target="_blank" rel="noopener">babylon-node</a>'s newest release remains <code>v1.3.0.5</code> of 1 June 2026 and its default branch's newest commit <code>12919a01</code> of 12 March 2025; the default branch of <a href="https://github.com/radixdlt/radixdlt-scrypto" target="_blank" rel="noopener">radixdlt-scrypto</a> still ends at <code>858c70f1</code> on 27 March 2026; <a href="https://radixdao.org/notices.json" target="_blank" rel="noopener">the DAO's notice feed</a> still ends on 29 August; and <a href="https://www.radixdlt.com/blog" target="_blank" rel="noopener">the Foundation's blog</a> carries no post about the incident. A patch for a live vulnerability is the last thing anyone would push to a public branch before it ships, so the absence is not evidence of inaction &mdash; but none of the places a reader can check has moved.</p>`;

const STATUS_OLD = `Still halted when re-read at 19:04 UTC, 1 September, twenty-one hours and forty-five minutes after the last round`;
const STATUS_NEW = `Still halted when re-read at 03:04 UTC, 2 September, twenty-nine hours and forty-five minutes after the last round`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  const at = blocks.findIndex((b) => (b.text || '').includes('id="standing-decision"'));
  if (at < 0) throw new Error('anchor section not found');
  blocks.splice(at + 1, 0, { id: uid(), type: 'content', text: SECTION });

  const row = blocks[0]?.blocks?.[0];
  if (!row || !row.text.includes(STATUS_OLD)) throw new Error('infobox network-status row not matched');
  row.text = row.text.replace(STATUS_OLD, STATUS_NEW);

  const version = '2.6.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  blocks ${page.content.length} -> ${blocks.length}, section at ${at + 1}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       "Day three, read from the ecosystem side: the Gateway fails closed at 107,377 seconds behind while the dApp APIs above it fail open. Ociswap quotes an XRD market cap identical to 36 decimal places at 1h, 24h and now; Astrolescent still prices the six drained hAssets, hUSDC 0.7467 and hUSDT 0.4470, against a remaining supply of 1,092.79 and 0.036292. Frontend census, and the official channels re-checked as unmoved. Infobox network-status re-dated.", now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
