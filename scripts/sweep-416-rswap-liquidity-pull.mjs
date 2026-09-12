/**
 * sweep 416 — RSwap after the restart.
 *
 * Banked by run 410 from the signal sweep and verified here. At 15:45 UTC on 11 September
 * 2026, four hours after Radix mainnet resumed committing transactions, Gary posted on
 * RSwap's behalf in the main Radix Telegram group (t.me/radix_dlt/1003095). Authorship
 * confirmed through the t.me embed: author "Gary", owner "Radix DLT Official", text verbatim.
 *
 * The ledger check is the point. This page recorded the LSULP/DCKS base pool at
 * 17,533,687.62 LSULP on 1 September. A Gateway read of the pool at state version
 * 557,909,523 on 12 September returns 999,984.712991754875569675, and the venue's own
 * pair API returns the identical figure. That is 94.3% of the deepest position withdrawn.
 *
 * Not dormancy. The same message says the opposite, and it dates itself: "a week or two"
 * from 11 September is checkable from about 25 September 2026.
 */
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG = 'ecosystem';
const SLUG = 'rswap';
const VERSION = '1.1.0';
const SENTINEL = '999,984.712991754875569675';

const SUBS = [
  [
    'and 24-hour volume is zero on all 65 pairs because Radix mainnet is halted</td></tr></tbody></table>',
    'and 24-hour volume is zero on all 65 pairs while Radix mainnet is halted</td></tr>' +
      '<tr><td><strong>Position, 12 September 2026</strong></td><td>Most liquidity withdrawn after the restart; the deepest pool holds 999,984.71 LSULP, down from 17,533,687.62</td></tr></tbody></table>',
  ],
  [
    'Radix mainnet stopped producing rounds at 21:19 UTC on 31 August and no transaction has settled anywhere on the network since. RSwap had said nothing publicly in the main Radix Telegram group in the ten hours after the halt.',
    'Radix mainnet stopped producing rounds at 21:19 UTC on 31 August, and for the ten days that followed no transaction settled anywhere on the network. RSwap said nothing publicly in the main Radix Telegram group in the ten hours after the halt.',
  ],
];

const NEW_SECTION =
  '<h2>After the restart: most of the liquidity is gone</h2>' +
  '<p>Radix mainnet resumed committing user transactions at 11:39 UTC on <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">11 September 2026</a>. Four hours later, at 15:45 UTC, <a href="https://t.me/radix_dlt/1003095" target="_blank" rel="noopener">Gary posted on RSwap\'s behalf</a> in the main Radix Telegram group: &ldquo;Most liquidity has been pulled from RSwap. We are waiting a week or two for everything to stabilize a little more before we commit to adding liquidity back. We aren\'t going anywhere. We just have to ensure prices make sense before putting large liquidity back on the DEX.&rdquo;</p>' +
  '<p>The ledger agrees with the first sentence and puts a size on it. The LSULP/DCKS base pool &ndash; the deepest position on the venue, and the one that made RSwap the second-largest holder of LSULP on Radix &ndash; held <strong>17,533,687.62 LSULP</strong> when this page read it on 1 September. Read from the <a href="https://mainnet.radixdlt.com/state/entity/details" target="_blank" rel="noopener">Radix Gateway</a> at state version 557,909,523 on <strong>12 September 2026</strong>, <a href="https://dashboard.radixdlt.com/pool/pool_rdx1ch7xn38jgrfzmpk6392z3twh9zhh7w8hqgz8s9cvmcj0yhv3xzck8e" target="_blank" rel="noopener">the same pool</a> holds <strong>999,984.712991754875569675</strong>. That is <strong>94.3 per cent</strong> of the position withdrawn in the first day the network could carry a withdrawal, and the venue\'s own <a href="https://dex.reddicks.meme/api/pairs" target="_blank" rel="noopener">pair API</a> returns the identical figure to the last decimal, so on this number the two independent readings do not disagree.</p>' +
  '<p>This page does not read the statement as a departure notice, because it says the opposite in its own words. It is a stated intention to return, and it dates itself: &ldquo;a week or two&rdquo; from 11 September is checkable from about 25 September 2026.</p>';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG, SLUG)) throw new Error(`${TAG}/${SLUG} is LOCKED`);

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
    [TAG, SLUG]
  );
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  let hits = 0;
  for (const b of blocks) {
    if (typeof b.text === 'string') {
      for (const [from, to] of SUBS) {
        if (b.text.includes(from)) { b.text = b.text.split(from).join(to); hits++; }
      }
    }
    if (Array.isArray(b.blocks)) {
      for (const nb of b.blocks) {
        if (typeof nb.text !== 'string') continue;
        for (const [from, to] of SUBS) {
          if (nb.text.includes(from)) { nb.text = nb.text.split(from).join(to); hits++; }
        }
      }
    }
  }
  if (hits !== SUBS.length) throw new Error(`matched ${hits} of ${SUBS.length} find-strings — aborting before any write`);

  // The new section goes after "What the drain took", before "Relationship to Reddicks".
  const at = blocks.findIndex((b) => typeof b.text === 'string' && b.text.includes('<h2>Relationship to Reddicks</h2>'));
  if (at < 0) throw new Error('anchor block not found');
  blocks.splice(at, 0, { id: uid(), type: 'content', text: NEW_SECTION });

  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${VERSION}  (${hits} substitutions, 1 block inserted at index ${at})`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query(
      'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, VERSION, now, page.id]
    );
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        cuid(), page.id, json, page.title, VERSION, 'minor', AUTHOR_ID,
        'Post-restart: RSwap says most of its liquidity has been pulled (t.me/radix_dlt/1003095, 15:45 UTC 11 September, authorship embed-verified as Gary), and a Gateway read of the LSULP/DCKS base pool at state version 557,909,523 puts the withdrawal at 94.3% of the deepest position. Not read as dormancy — the same message states an intention to return, checkable from about 25 September.',
        now,
      ]
    );
    await client.query('COMMIT');
  }
} catch (err) {
  try { await client.query('ROLLBACK'); } catch {}
  console.error('FAILED:', err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
