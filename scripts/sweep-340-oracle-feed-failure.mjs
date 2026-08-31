import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'developers/scrypto';
const SLUG = '08-oracle-integration';
const SENTINEL = 'When a feed is fresh and wrong';
const DRY = process.argv.includes('--dry-run');

const FEED = 'https://dashboard.radixdlt.com/component/component_rdx1czdvvanvdy6495phfgz8uv6n2semp2cpexcg6vvty6uaycc82adgyv';
const BREAK_TX = 'https://dashboard.radixdlt.com/transaction/txid_rdx17mgxz8dlmyzrrtppec9fer4lqfyl38j40skdql9f3xfyw2wvk88qfalnwp';
const BORROW_TX = 'https://dashboard.radixdlt.com/transaction/txid_rdx12lsyuggs587xt7m9uxjedtkdtz0lcnzh85g2w4x6wwdq3cuyhccs8ls3kc';
const FLOOR_TX = 'https://dashboard.radixdlt.com/transaction/txid_rdx1hdpwt9hxclh80xlylgru6mxmmnpevrqu7q82fc92sfk30ywlp53sjrjmm5';

const OLD_MITIGATION =
  'Use multiple independent relayers with a median/aggregation mechanism to reduce trust assumptions.</p>';
const NEW_MITIGATION =
  'Use multiple independent relayers with a median/aggregation mechanism to reduce trust assumptions. ' +
  'A staleness check alone is not enough: a feed can be rewritten on schedule and still carry a value that is wrong ' +
  'by orders of magnitude, which is what happened to the largest money market on Radix in August 2026 ' +
  '(<a href="#when-a-feed-is-fresh-and-wrong" rel="noopener">below</a>).</p>';

const NEW_SECTION = `<h2 id="when-a-feed-is-fresh-and-wrong">${SENTINEL}</h2>
<p>Both patterns above treat the danger as data going out of date. It is worth reading one production failure closely, because the mitigation recommended above &ndash; a timestamp and a staleness threshold &ndash; would not have caught it. On 30 August 2026 the largest lending market on Radix was drained by a feed that was neither stale nor unsigned. It was being rewritten every ten minutes, exactly as designed, with a number that had been wrong by roughly seven orders of magnitude for two days.</p>
<h3>What the ledger records</h3>
<p><a href="/ecosystem/weft-finance" rel="noopener">Weft Finance</a> reads collateral values from a single push oracle it registers as "Default PriceFeed" (<a href="${FEED}" target="_blank" rel="noopener">component</a>). A relayer account calls <code>update_prices</code> on it with a map of twenty assets, on a ten-minute cadence, authorised by one non-fungible badge; three of those badges exist and the resource carries no on-ledger metadata, so nothing on the ledger says whose price authority this is.</p>
<p>At <strong>12:35:17 UTC on 28 August 2026</strong>, in one of those routine calls (<a href="${BREAK_TX}" target="_blank" rel="noopener">transaction</a>, state version 556,254,628), the entry for <a href="/ecosystem/hug" rel="noopener">HUG</a> went from <code>0.000131085370299542</code> XRD, a figure the feed had carried unchanged for at least four weeks, to <code>1289.783156723014634465</code> &ndash; the band the same feed uses for dollar stablecoins. It stayed in that band for the next 53 hours, drifting a little on each cycle, and <strong>324 further transactions</strong> touched the component before the <a href="${BORROW_TX}" target="_blank" rel="noopener">borrow</a> at 18:02:58 on 30 August drew about 71 million XRD of debt against 539,703 HUG the same transaction had bought for 70.6 XRD. The last write before that borrow put HUG at 1,330.41 XRD.</p>
<h3>Why a staleness check does not help</h3>
<p>Every one of those 324 writes carried a current timestamp, and most carried a value that differed from the one before it. A consumer rejecting anything older than five minutes would have accepted all of them. The price was live; what it meant was wrong. Freshness describes when a value was written and says nothing about whether it is true, so a staleness guard is necessary and never sufficient.</p>
<h3>Checks that address the actual failure</h3>
<ul>
<li><strong>Cap the move per update.</strong> HUG changed by a factor of about ten million between two consecutive writes ten minutes apart. A per-asset deviation cap turns that into a rejected update rather than a priced position.</li>
<li><strong>Bound each asset to a plausible band</strong> and halt the market for it outside that band, rather than continuing to lend against a number no one has looked at.</li>
<li><strong>Cross-check against a venue you can read on-ledger.</strong> HUG's real price was available inside the attacking transaction itself, on the <a href="/ecosystem/ociswap" rel="noopener">Ociswap</a> pool that sold it. A component that compares a feed against on-ledger pool state is comparing two independent sources rather than trusting one.</li>
<li><strong>Price against depth, not quantity.</strong> On the cached figure the collateral scanned as roughly 718 million XRD; the entire HUG market held about a thousand dollars of pooled liquidity. A borrow larger than the market for the collateral is a liquidation that cannot clear.</li>
<li><strong>Keep an off switch that does not need a redeploy</strong> &ndash; a per-asset disable the protocol can reach without shipping new code.</li>
</ul>
<h3>What the operator did next</h3>
<p>The remedy was not to price the affected assets correctly. From <strong>00:15:54 UTC on 31 August 2026</strong> the same ten-minute call floors ten native Radix tokens at <code>0.0000000001</code> XRD apiece &ndash; WEFT itself, HUG, EARLY, OCI, ASTRL, DFP2, CAVIAR, SRG, FLOOP and MOX &ndash; while the ten wrapped and bridged assets in the same map keep real quotes. Read at <a href="${FLOOR_TX}" target="_blank" rel="noopener">07:05:59 UTC</a> the floor was still being rewritten on every cycle. Pricing an asset at effectively zero withdraws it from collateral service through the oracle, without touching the component; it is the off switch of the previous point, reached by the only lever the operator had left.</p>`;

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
  if (blocks.some((b) => (b.text || '').includes(SENTINEL))) {
    console.log('  already applied - no write');
    process.exit(0);
  }

  const push = blocks.find((b) => (b.text || '').includes(OLD_MITIGATION));
  if (!push) throw new Error('mitigation paragraph not found');
  push.text = push.text.replace(OLD_MITIGATION, NEW_MITIGATION);

  const nextIdx = blocks.findIndex((b) => (b.text || '').includes('<h2>Next Steps</h2>'));
  if (nextIdx < 0) throw new Error('Next Steps block not found');
  blocks.splice(nextIdx, 0, { id: uid(), type: 'content', text: NEW_SECTION });

  const version = '2.3.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  blocks ${page.content.length} -> ${blocks.length}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query(
      'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Adds a worked production failure: Weft Finance’s push oracle rewrote a wrong HUG price 324 times over 53 hours before the 30 August 2026 borrow, so the article’s own staleness mitigation would not have caught it. Ledger-sourced (break tx at 12:35:17 UTC 28 Aug, state version 556,254,628; floor from 00:15:54 UTC 31 Aug).',
       now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
