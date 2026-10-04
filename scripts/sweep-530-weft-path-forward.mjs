// Sweep 530: /ecosystem/weft-finance, 4 Oct 2026. The page stopped at Kouassi's 16 Sep promise of
// details "this Friday". They came on 24 Sep as "Path Forward for Weft" on the announcement channel
// (t.me/WeftFinanceFeed/87, forwarded to the group as t.me/WeftFinance/32954): restart the validator,
// lock operations into one-way compensation pools (LSULP and XRD lending positions first), raise the
// validator fee to 50% for compensation. Kouassi's 32960 adds the hAsset options. Re-read 4 Oct: the
// lending market still takes repayments and liquidations (last tx 02:30 UTC 4 Oct), the validator made
// no proposals in the week to 03:06 UTC (radixscan uptime 0%, 184.6m XRD stake), DeFiLlama $14,645
// for Weft on 3 Oct against $296,331 for Radix. The ledger fee fields are not quoted (1 Oct rule).
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const TAG = 'ecosystem', SLUG = 'weft-finance', VERSION = '4.14.0';
const ext = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const SENTINEL = 'WeftFinanceFeed/87';

const OLD_TVL = '<tr><td><strong>TVL (17 Sep 2026)</strong></td><td>≈ $25K (V2 + V1), from $301K on 11 Aug 2026;';
const NEW_TVL = '<tr><td><strong>TVL (3 Oct 2026)</strong></td><td>≈ $15K (V2 + V1), from $25K on 17 Sep and $301K on 11 Aug 2026;';

const ANCHOR = '<h2><strong>History</strong></h2>';
const ADDITION =
  `<h3>Path forward (24 September 2026)</h3>` +
  `<p>The details came six days late. On 24 September Weft posted ${ext('https://t.me/WeftFinanceFeed/87', '“Path Forward for Weft”')} on its announcement channel, framed as a proposal for community feedback rather than a decision. It would:</p>` +
  `<ul><li>restart the Weft validator;</li>` +
  `<li>lock Weft’s operations and create compensation pools, into which eligible liquidity positions are staked, starting with $LSULP positions and $XRD lending positions;</li>` +
  `<li>make that commitment one-way: a position placed in a compensation pool stays there;</li>` +
  `<li>raise the Weft validator’s fee to 50%, with the extra revenue going to compensation.</li></ul>` +
  `<p>Positions in bridged hAssets wait on the outcome of the Foundation’s attempt to recover funds from the <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">Hyperlane asset drain</a>. Kouassi ${ext('https://t.me/WeftFinance/32960', 'added in the group')} that the hAssets could go into one pool paid pro rata or into separate pools, and that if only hUSDC is recovered the team would have to choose between returning it to w2-hUSDC holders or to all w2 holders.</p>` +
  `<p>None of it had happened by 4 October. The ${ext('https://dashboard.radixdlt.com/component/component_rdx1cpy6putj5p7937clqgcgutza7k53zpha039n9u5hkk0ahh4stdmq4w', 'lending market')} was still taking repayments and running liquidations in the early hours of that day, and the ${ext('https://dashboard.radixdlt.com/network-staking/validator_rdx1sd6n65sx0thvfzfp6x0jp4qgwxtudpx575wpwqespdlva2wldul9xk', 'Weft validator')} had made no proposals in the week to 03:06 UTC, with 184.6m $XRD still delegated to it (186.2m on 17 September). ${ext('https://defillama.com/protocol/weft-finance', 'DeFiLlama')} counted $15K in Weft V1 and V2 on 3 October, against $296K across Radix DeFi.</p>\n`;

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query('SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) { console.log('  already applied, no write'); process.exit(0); }

  const box = blocks[0]?.blocks?.[0];
  if (!box?.text.includes(OLD_TVL)) throw new Error('TVL row not found');
  box.text = box.text.replace(OLD_TVL, NEW_TVL);

  const body = blocks.find((b) => typeof b.text === 'string' && b.text.includes(ANCHOR));
  if (!body) throw new Error('History anchor not found');
  body.text = body.text.replace(ANCHOR, ADDITION + ANCHOR);

  const json = JSON.stringify(blocks);
  if (!json.includes(SENTINEL) || !json.includes('TVL (3 Oct 2026)')) throw new Error('edit did not land in memory');
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${VERSION}  (+${json.length - JSON.stringify(page.content).length} chars)`);
  if (!DRY) {
    const now = new Date().toISOString();
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, VERSION, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, VERSION, 'minor', AUTHOR_ID,
        'Sweep 530: Protocol status gains "Path forward (24 September 2026)": the team\'s compensation-pool proposal from t.me/WeftFinanceFeed/87 (restart the validator, lock operations into one-way compensation pools for LSULP and XRD lending positions first, raise the validator fee to 50% for compensation) and Kouassi\'s hAsset options (t.me/WeftFinance/32960). Re-read 4 Oct: not yet implemented; lending market still active, validator made no proposals in the week to 03:06 UTC, 184.6m XRD delegated. Infobox TVL re-dated to DeFiLlama 3 Oct: ~$15K (from $25K on 17 Sep).',
        now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
