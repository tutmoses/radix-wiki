// Sweep 479: Bullring has settled no auction since 24 March 2026.
// Read on 24 September 2026 (epoch 343,683): the BullringFeeCollection component
// component_rdx1cqwqdt...6gfdht still stands at 108 auctions and 4,924.2609 XRD,
// its newest transaction the 24 March settlement. The ClaimableProfileNFTSystem
// component_rdx1cp73vn...qypsqg (address from the bullring.auction bundle) has
// minted 135 profiles, the newest (#135) on 12 August 2026 and five since
// 23 March. The ShardSpace group's listing bot last posted a listing on
// 18 July 2026 (t.me/ShardSpace/5224). bullring.auction answers 200.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ecosystem';
const SLUG = 'bullring';
const SENTINEL = 'Activity on ledger (24 September 2026)';

const FEE = 'component_rdx1cqwqdtcv3pakggnyzguzweuc9drytqe3snkrse87h8jckjcz6gfdht';
const PROFILES = 'component_rdx1cp73vnvv8kxjw3gstherm3zd9pusmd726lams6f36qu6r438qypsqg';

const SECTION = `<h2>${SENTINEL}</h2>
<p>Bullring charges a fee on every settled auction and collects it through a component of its own, a <code>BullringFeeCollection</code> instance at <a href="https://dashboard.radixdlt.com/component/${FEE}" target="_blank" rel="noopener"><code>${FEE}</code></a>, gated by the same Bullring admin badge the platform's <a href="/developers/frontend/04-dapp-definition-and-verification" rel="noopener">dApp definition</a> account holds. Its stored state is public, and it is the closest thing the platform has to a published set of books.</p>
<table><tbody>
<tr><th>Field</th><th>20 August 2026</th><th>24 September 2026</th></tr>
<tr><td><code>fee_rate</code></td><td>0.03</td><td>0.03</td></tr>
<tr><td><code>auction_count</code></td><td>108</td><td>108</td></tr>
<tr><td><code>total_collected</code></td><td>4,924.2609 XRD</td><td>4,924.2609 XRD</td></tr>
</tbody></table>
<p>The fee is three percent of the settled price, so those figures give the volume that passed through the platform: about <strong>164,100 XRD</strong> of auctions settled since the <a href="https://t.me/ShardSpace/4272" target="_blank" rel="noopener">18 November 2025 launch</a>, across 108 sales, averaging about 1,520 XRD each. The individual settlements are legible in the same place: a <code>DELIVERNFTs</code> NFT at 110 XRD paying a 3.3 XRD fee, a bundle of 55 at 5,500 XRD paying 165 XRD.</p>
<p>The last fee reached this component on 24 March 2026, and nothing had settled through it by 24 September, six months later. The <a href="/ecosystem/atomix" rel="noopener">Atomix</a> dApp definition account's last on-ledger activity falls in the same week, on 23 March 2026.</p>
<p>A second component shows who can bid. Bidding needs a Bullring Profile NFT, and the <code>ClaimableProfileNFTSystem</code> at <a href="https://dashboard.radixdlt.com/component/${PROFILES}" target="_blank" rel="noopener"><code>${PROFILES}</code></a> had minted 135 of them by 24 September 2026. Five were minted after 23 March, the newest on 12 August. Its 31 stored level thresholds, from 0 to 10m points, are the 30 levels the points system advertises.</p>
<p>Sellers kept listing after the sales stopped. The ShardSpace group's listing bot posted Bullring auctions on <a href="https://t.me/ShardSpace/5175" target="_blank" rel="noopener">9 April</a>, <a href="https://t.me/ShardSpace/5208" target="_blank" rel="noopener">20 June</a> and <a href="https://t.me/ShardSpace/5224" target="_blank" rel="noopener">18 July 2026</a>, and none of them settled. When the main Radix Telegram asked on 20 August 2026 <a href="https://t.me/radix_dlt/998843" target="_blank" rel="noopener">whether any NFT marketplace was left for secondary trading</a>, a second member replied that <a href="https://t.me/radix_dlt/998847" target="_blank" rel="noopener">Bullring showed no active listings</a>.</p>
<p>This page reads 🟠 Dormant from 24 September 2026. bullring.auction still answers, the contracts remain on ledger and Avaunt has announced no wind-down, so the next settled auction would return it to Active.</p>`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content, metadata FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied, no write');
    process.exit(0);
  }
  const hits = blocks.filter((b) => b.type === 'content' && b.text?.startsWith('<h2>Activity on ledger (20 August 2026)</h2>'));
  if (hits.length !== 1) throw new Error(`expected 1 activity block, got ${hits.length}`);
  hits[0].text = SECTION;
  const metadata = { ...page.metadata, status: '🟠 Dormant' };

  const version = '1.2.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  status ${page.metadata.status} -> ${metadata.status}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, metadata=$2, version=$3, updated_at=$4, last_verified_at=$4 WHERE id=$5',
      [json, JSON.stringify(metadata), version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
        'Bullring on-ledger re-read, 24 September 2026: fee component still at 108 auctions with no settlement since 24 March; profile NFT count (135, newest 12 August) and the unsettled July listings added; status to Dormant.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
