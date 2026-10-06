// Sweep 544: /ecosystem/dogecubex called itself "Babylon-era trading infrastructure", but every artefact is
// Olympia: swaps were transfers to a pool account with a message, the UI repo (DogeCube-io/dogecubex-ui) last
// changed 28 Aug 2023, a month before Babylon, and no DogeCube validator exists in the Babylon set (registered
// or not, read via the Gateway 6 Oct 2026) while dogecube.io still lists an rv1 address. The DGC token did
// migrate (8,000,000,000 fixed, mint/burn deny_all). Prose rewritten in the past tense; the duplicate
// "Additional Cost" and unsourced "Community Engagement" sections dropped; metadata.telegram removed because
// t.me/DOGECUBE now opens a channel created 28 Nov 2024 whose only post is a "verify you're human" portal.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'ecosystem';
const SLUG = 'dogecubex';
const SENTINEL = 'DogeCube-io/dogecubex-ui/commits';
const DRY = process.argv.includes('--dry-run');
const DGC = 'resource_rdx1t4qfgjm35dkwdrpzl3d8pc053uw9v4pj5wfek0ffuzsp73evye6wu6';

const INFOBOX = `<table> <tr><td><strong>Project</strong></td><td>DogeCubeX</td></tr> <tr><td><strong>Type</strong></td><td>Operator-run token swap service (described by its operator as a cDEX)</td></tr> <tr><td><strong>Network</strong></td><td>Radix <a href="/contents/tech/releases/radix-mainnet-olympia" class="link">Olympia</a> mainnet</td></tr> <tr><td><strong>Operator</strong></td><td>The <a href="/ecosystem/dogecube" class="link">DogeCube</a> team</td></tr> <tr><td><strong>Status</strong></td><td>🟠 Dormant – not carried over to Babylon</td></tr> <tr><td><strong>Source</strong></td><td><a href="https://github.com/DogeCube-io/dogecubex-ui" class="link" target="_blank" rel="noopener">DogeCube-io/dogecubex-ui</a></td></tr> </table>`;

const MAIN = `<p><strong>DogeCubeX</strong> was a token swap service on the Radix network, run by the team behind the <a href="/ecosystem/dogecube" class="link">DogeCube</a> memecoin and described by them as a centralised decentralised exchange (cDEX). It ran on the <a href="/contents/tech/releases/radix-mainnet-olympia" class="link">Olympia</a> mainnet. A user sent tokens to a pool account, and the operator's service sent the swapped tokens back to the user's wallet, usually within about five seconds. Prices followed the constant-product formula of <a target="_blank" rel="noopener" class="link" href="https://uniswap.org">Uniswap</a> v2, so the rate depended on the order size and the liquidity in the pool, and a message attached to the transfer could set refund conditions in case the price moved.</p><h2>Fees and limits</h2><p>Each swap carried three charges: a 0.5% pool fee paid to liquidity providers, a 0.5% exchange fee for the operator, and a 0.1 XRD transfer fee covering the network fee on the return transfer. A swap that failed on price was refunded less the transfer fee. One that failed through the user's error, such as an encrypted message, a token not in the pool or an amount over the limit, cost a 0.5 XRD refund fee instead.</p><p>Orders ran from 1 to 500 XRD, with higher limits for stakers on the DogeCube validator node. Larger amounts had to be split across several transactions.</p><h2>Listed tokens</h2><p>The pools listed tokens from other Olympia-era Radix projects. <a href="/ecosystem/singularityx" class="link">SingularityX</a>, for example, put a DogeCubeX listing on its roadmap for the third quarter of 2022.</p>`;

const STATUS = `<h2>Status</h2><p>DogeCubeX did not carry over to <a href="/contents/tech/releases/radix-mainnet-babylon" class="link">Babylon</a>, the mainnet upgrade of 28 September 2023. Its interface repository, <a href="https://github.com/DogeCube-io/dogecubex-ui/commits" class="link" target="_blank" rel="noopener">DogeCube-io/dogecubex-ui</a>, was last changed on 28 August 2023, a month before the upgrade, and its domain, dogecubex.live, no longer resolves.</p><p>The validator node that set the higher order limits is gone too. Read through the Gateway on 6 October 2026, no DogeCube validator appears among the registered or unregistered nodes listed on the <a href="https://dashboard.radixdlt.com/network-staking" class="link" target="_blank" rel="noopener">Radix Dashboard</a>, while <a href="https://www.dogecube.io" class="link" target="_blank" rel="noopener">dogecube.io</a> still gives an Olympia-format <code>rv1</code> staking address. The DogeCube token itself did migrate: <a href="https://dashboard.radixdlt.com/resource/${DGC}" class="link" target="_blank" rel="noopener">Doge³ (DGC)</a> exists on Babylon with a fixed supply of 8,000,000,000 and its mint and burn rules locked to deny all.</p>`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query('SELECT id, title, version, content, metadata FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied — no write');
    process.exit(0);
  }
  const info = blocks.find((b) => b.id === '238b4a59-39d6-458e-954c-91f8bfa9bf1e');
  const main = blocks.find((b) => b.id === 'block-dogecubex-1');
  const status = blocks.find((b) => b.id === '1edc7c37-8655-4389-b913-ecfa96445f00');
  if (!info?.blocks?.[0] || !main || !status) throw new Error('block layout changed');
  info.blocks[0].text = INFOBOX;
  main.text = MAIN;
  status.text = STATUS;
  const metadata = { ...page.metadata };
  delete metadata.telegram;
  const version = '2.3.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}; metadata keys ${Object.keys(metadata).join(',')}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, metadata=$2, version=$3, updated_at=$4, last_verified_at=$4 WHERE id=$5', [json, JSON.stringify(metadata), version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
        'Sweep 544: DogeCubeX was Olympia infrastructure, not Babylon-era. Rewritten in the past tense with a Status section sourced to the dogecubex-ui commit history (last change 28 Aug 2023), the Babylon validator set read on 6 Oct 2026 (no DogeCube node) and the DGC resource on the Radix Dashboard. Dropped the duplicate Additional Cost section and the unsourced Community Engagement section; removed the Telegram link, which now opens an unrelated channel created 28 Nov 2024.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
