// Sweep 339 – HUG: the page never mentioned that it was the collateral in the
// largest exploit on Radix, and it had never been freshness-stamped.
//
// /ecosystem/hug had last_verified_at NULL and content dated 30 July 2026. On
// 30 August a dormant memecoin with about $1,258 of pooled liquidity was
// carried at roughly $1.07 in Weft's price feed and released 71 million XRD of
// debt. Readers arriving from /ecosystem/weft-finance land here.
//
// Read at epoch 339,680, 31 Aug 2026 03:17 UTC (Gateway) and from the Ociswap
// public API at the same hour:
//   * supply 100,000,000,000 HUG, divisibility 18 — unchanged.
//   * market 0.00012752730451 XRD / $0.00000010549691; pooled TVL ~$1,258;
//     24h volume $11.50.
//   * Weft's Default PriceFeed has carried HUG at 0.0000000001 XRD since the
//     00:15:00 UTC batch on 31 August.
//   * HUG's collateral Add service at Weft: enabled=false, locked=true since
//     6 June 2025 08:40:27 UTC (state version 303,390,813); FlashOperation
//     enabled throughout.
//
//   node scripts/sweep-339-hug-collateral.mjs --dry-run
//   node scripts/sweep-339-hug-collateral.mjs

import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ecosystem';
const SLUG = 'hug';
const SENTINEL = 'Collateral in the Weft exploit';
const VERSION = '3.3.0';

const TX = 'txid_rdx12lsyuggs587xt7m9uxjedtkdtz0lcnzh85g2w4x6wwdq3cuyhccs8ls3kc';
const FEED = 'component_rdx1czdvvanvdy6495phfgz8uv6n2semp2cpexcg6vvty6uaycc82adgyv';
const RES = 'resource_rdx1t5kmyj54jt85malva7fxdrnpvgfgs623yt7ywdaval25vrdlmnwe97';

const SECTION =
  `<h2>${SENTINEL}</h2>` +
  `<p>On <strong>30 August 2026</strong> HUG was the collateral in the largest exploit yet recorded on Radix. At 18:02:58&nbsp;UTC a <a href="https://dashboard.radixdlt.com/transaction/${TX}" target="_blank" rel="noopener">single transaction</a> bought <strong>539,703.17&nbsp;HUG</strong> for <strong>70.6&nbsp;XRD</strong> on <a href="/ecosystem/ociswap" rel="noopener">Ociswap</a>, posted it as collateral at <a href="/ecosystem/weft-finance" rel="noopener">Weft Finance</a>, and borrowed <strong>47,280,000&nbsp;LSULP</strong> and <strong>13,100,500&nbsp;XRD</strong> against it. Weft&rsquo;s price feed carried HUG at <strong>1,330.41&nbsp;XRD</strong> a token at that moment, about ten million times the rate the same transaction had just paid, so the borrow cleared the protocol&rsquo;s health check on arithmetic that was correct and an input that was not.</p>` +
  `<p>The token itself did nothing. HUG has been a listed collateral resource on Weft since November 2024, and its <code>Add</code> collateral service there was switched off and locked on <strong>6 June 2025</strong> &ndash; 451 days before the exploit &ndash; while the neighbouring <code>FlashOperation</code> service stayed open, which is the route the transaction used. The full reading is on the <a href="/ecosystem/weft-finance" rel="noopener">Weft Finance</a> page.</p>` +
  `<p>Since the <strong>00:15:00&nbsp;UTC batch on 31 August</strong>, Weft&rsquo;s <a href="https://dashboard.radixdlt.com/component/${FEED}" target="_blank" rel="noopener">Default PriceFeed</a> has published HUG at <strong>0.0000000001&nbsp;XRD</strong>, alongside nine other Radix-native tokens.</p>` +
  `<p>The scale of the mispricing is easiest to see against the token&rsquo;s real market. Read from the <a href="https://api.ociswap.com/tokens/${RES}" target="_blank" rel="noopener">Ociswap API</a> at 03:17&nbsp;UTC on 31 August 2026, HUG traded at <strong>0.00012752730451&nbsp;XRD</strong> ($0.000000105), with about <strong>$1,258</strong> of pooled liquidity across its Ociswap pools and <strong>$11.50</strong> of volume in the preceding 24 hours. Its on-ledger facts are unchanged: a fixed supply of <a href="https://dashboard.radixdlt.com/resource/${RES}" target="_blank" rel="noopener">100,000,000,000&nbsp;HUG</a> at divisibility 18, read at mainnet epoch&nbsp;339,680.</p>`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${TAG_PATH}/${SLUG} is LOCKED`);
  if (/\u00A0/.test(SENTINEL)) throw new Error('sentinel carries U+00A0');

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
    [TAG_PATH, SLUG],
  );
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied – no write');
    process.exit(0);
  }

  const infoboxAt = blocks.findIndex((b) => b.type === 'infobox');
  if (infoboxAt < 0) throw new Error('infobox not found');
  // The exploit section goes after the prose block, before the infobox tail.
  blocks.splice(infoboxAt, 0, { id: uid(), type: 'content', text: SECTION });

  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${VERSION}  (+1 block, ${SECTION.length} chars)`);

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, VERSION, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, VERSION, 'minor', AUTHOR_ID,
       'Record that HUG was the collateral in the 30 August 2026 Weft exploit, with the transaction, the 1,330.41 XRD feed price against a 0.000127 XRD market, the Add/FlashOperation split, and Weft’s 0.0000000001 XRD floor from 00:15 UTC on 31 August. Market and supply re-read at epoch 339,680. First freshness stamp on this page.',
       now],
    );
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
