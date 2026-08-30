/**
 * Run 331 (signal sweep, outside the rotation).
 *
 * /contents/resources/how-to-buy-xrd has carried a live, dated dislocation
 * since 22-23 August 2026: MEXC quoting XRD roughly 12% under every other
 * venue, which the page read as the signature of coins that could not leave,
 * without ever confirming a cause. That was a falsifiable claim, and it has
 * now been tested rather than merely updated.
 *
 * On 29 August 2026 at 19:56 UTC a holder in the project's Telegram channel
 * reported that MEXC had fixed the withdrawal issue (t.me/radix_dlt/999942).
 * Re-reading the same five public order books at 03:13 UTC on 30 August the
 * gap is gone: MEXC $0.0008672 against a $0.0008718 median of the other four,
 * a 0.53% discount, and its 24-hour low is $0.000853 where it sat unmoved at
 * $0.00062630 for the whole episode. The page's reasoning is now closed by a
 * measurement it made in advance.
 *
 * The standing instruction - confirm withdrawals before you buy - is left
 * exactly as it was, because it never depended on the cause.
 */
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/resources';
const SLUG = 'how-to-buy-xrd';
const SENTINEL = 'The gap closed';
const DRY = process.argv.includes('--dry-run');

const replacements = [
  // The listing note said "still quoting about 12% below" in the present tense.
  [`<li><a target="_blank" rel="noopener" href="https://www.mexc.com/exchange/XRD_USDT">MEXC</a> – XRD/USDT, the largest of these books by turnover, and still quoting about 12% below every other venue on 23 August 2026, a day and a half after the gap opened, with XRD withdrawals reportedly suspended — see <strong>How much liquidity is actually there</strong> below</li>`,
   `<li><a target="_blank" rel="noopener" href="https://www.mexc.com/exchange/XRD_USDT">MEXC</a> – XRD/USDT, the largest of these books by turnover. It quoted about 12% below every other venue from 22 to 23 August 2026 with XRD withdrawals reportedly suspended; the gap closed on 29-30 August — see <strong>How much liquidity is actually there</strong> below</li>`],
];

const CLOSED_SECTION = `<h3><strong>The gap closed on the eighth day</strong></h3>
<p>The paragraph above made a claim that could be checked later: if the discount was coins that could not leave, it would close when they could. On <strong>29 August 2026 at 19:56 UTC</strong> a holder in the project's Telegram channel reported that MEXC had fixed the withdrawal problem the previous day (<a href="https://t.me/radix_dlt/999942" target="_blank" rel="noopener">t.me/radix_dlt/999942</a>). That is the same class of source as the original wallet-maintenance account and is no better confirmed &ndash; but this time the order books can be asked directly.</p>
<p>Re-read from the same public endpoints at <strong>03:13 UTC on 30 August 2026</strong>:</p>
<table>
<tr><th>Venue</th><th>Last price</th><th>24h low</th><th>24h turnover</th></tr>
<tr><td>MEXC</td><td>$0.0008672</td><td>$0.000853</td><td>~$58,700</td></tr>
<tr><td>BingX</td><td>$0.0008686</td><td>$0.0008586</td><td>~$55,000</td></tr>
<tr><td>CoinEx</td><td>$0.00087815</td><td>$0.00086501</td><td>~$3,300</td></tr>
<tr><td>KuCoin</td><td>$0.000875</td><td>$0.000829</td><td>~$13,600</td></tr>
<tr><td>Gate.io</td><td>$0.0008608</td><td>$0.0008586</td><td>~$5,400</td></tr>
</table>
<p>MEXC is now <strong>0.53% under</strong> the $0.0008718 median of the other four books, against 12.19% seven days earlier. The number that settles it is not the price but the low: MEXC's 24-hour low had been pinned at <strong>$0.00062630</strong> through every reading of the episode, and it is now <strong>$0.000853</strong>, inside the range every other venue is printing. A book whose floor rejoins the market is a book whose sellers have somewhere else to go.</p>
<p>Two things are worth keeping from the episode. The first is that the cause was never confirmed here and still is not &ndash; MEXC's own currency-status endpoints refuse automated requests, so both the suspension and the fix rest on holder reports, and only the price behaviour is this wiki's own measurement. The second is that the instruction does not change with the outcome: <strong>confirm XRD withdrawals are enabled before you buy, not after</strong>. It held while the gap was open and it will hold the next time one opens.</p>`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${TAG_PATH}/${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied - no write');
    process.exit(0);
  }

  const hits = new Set();
  const apply = (text) => {
    let out = text;
    for (const [from, to] of replacements) {
      if (out.includes(from)) { out = out.split(from).join(to); hits.add(from.slice(0, 40)); }
    }
    return out;
  };
  for (const b of blocks) {
    if (typeof b.text === 'string') b.text = apply(b.text);
    for (const n of b.blocks || []) if (typeof n.text === 'string') n.text = apply(n.text);
  }
  const missed = replacements.filter(([from]) => !hits.has(from.slice(0, 40)));
  if (missed.length) {
    for (const [from] of missed) console.error('   MISS:', JSON.stringify(from.slice(0, 110)));
    throw new Error('aborting rather than writing a partial edit');
  }

  // Append the resolution directly after the liquidity block that opened the finding.
  const anchor = 'A discount you cannot withdraw is not a discount.</p>';
  const idx = blocks.findIndex((b) => typeof b.text === 'string' && b.text.includes(anchor));
  if (idx < 0) throw new Error('liquidity block anchor not found');
  blocks[idx].text = `${blocks[idx].text}\n${CLOSED_SECTION}`;

  const version = '1.8.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  ${JSON.stringify(page.content).length} -> ${JSON.stringify(blocks).length} B`);

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Closes the 22-23 Aug MEXC dislocation this page had left open in the present tense. A holder reported the withdrawal fix on 29 Aug (t.me/radix_dlt/999942); re-reading the same five public order books at 03:13 UTC on 30 Aug, MEXC is 0.53% under the median of the other four against 12.19% seven days earlier, and its 24-hour low has moved off the $0.00062630 it was pinned at for the whole episode to $0.000853. Adds the re-read table and states what is still unconfirmed: the cause rests on holder reports either way, and only the price behaviour is this wiki’s own measurement. The standing instruction is unchanged.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
