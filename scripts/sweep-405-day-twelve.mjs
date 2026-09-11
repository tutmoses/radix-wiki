// Sweep 405 — /contents/history/hyperlane-asset-drain-2026
// Day twelve of the halt: the restart sequence written into babylon-node v1.4.0.0, and
// the per-validator reading of how far adoption is from the threshold that triggers it.
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/history';
const SLUG = 'hyperlane-asset-drain-2026';
const SENTINEL = 'sweep405-day-twelve';
const DRY = process.argv.includes('--dry-run');

const HTML = `<h2 id="${SENTINEL}">Day twelve: the restart gets its sequence, and the largest validators are still dark</h2>
<p>Read at <strong>07:07&nbsp;UTC on 11 September 2026</strong>, <a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">the Gateway status endpoint</a> returns the ledger it has returned since the stop: state version 557,840,622 at epoch 339,896, round 102, two hundred and forty-nine hours and forty-seven minutes without a committed round.</p>
<p>What the network does when it comes back is fixed in the node software rather than left to a decision on the day. babylon-node v1.4.0.0 sets Eagle Ray to enact at the start of epoch 339,898 unconditionally in <a href="https://github.com/radixdlt/babylon-node/blob/main/core-rust/state-manager/src/protocol/protocol_configs/mainnet_protocol_config.rs" target="_blank" rel="noopener">its mainnet protocol config</a> &ndash; the only mainnet protocol update in Radix's history that does not wait for the validator set to signal readiness &ndash; and declares a user transaction moratorium covering epoch 339,897, an epoch range during which user transactions are refused. The order that follows: once validators holding more than two thirds of active stake are online and running v1.4.0.0, consensus can certify rounds again and resumes inside epoch 339,897; that epoch produces rounds and accepts no user transactions; at the start of epoch 339,898 the fork enacts and the moratorium lifts together, and transactions are accepted again on the patched engine. Two node operators set that sequence out in the <a href="https://t.me/RadixDevelopers/66388" target="_blank" rel="noopener">Radix Developers group</a> this morning, one reading it from the code and <a href="https://t.me/RadixDevelopers/66385" target="_blank" rel="noopener">Daffy confirming</a> that the quorum for the fork is the same two thirds and that no announcement will precede it, because the moment cannot be predicted.</p>
<p>The threshold is closer than it was and it is not close. Read from <a href="/ecosystem/stakesafe" rel="noopener">StakeSafe</a>'s <a href="https://validators.stakesafe.net" target="_blank" rel="noopener">adoption dashboard</a> at <strong>07:12&nbsp;UTC</strong>, 1,455,804,324&nbsp;XRD is running v1.4.0.0, <strong>31.22%</strong> of active validator-set stake, against 27.03% the previous evening; stake with a node online rose from 32.58% to 37.45% over the same hours, so operators are coming back online faster than they are coming back upgraded. The twelve largest validators account for 2,073,397,316&nbsp;XRD between them, all twelve read a v1.3 version and all twelve read offline, and their stake exceeds the 1,668,419,975&nbsp;XRD that still separates adoption from the threshold. One caveat on that column: the explorer reports the version a node last advertised, so an offline validator shows the release it was running when it stopped. The table says the explorer has not seen those twelve on Eagle Ray, not that their operators have not installed it.</p>`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  if (/\u00A0/.test(HTML)) throw new Error('literal U+00A0 in script string');

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (blocks.some((b) => b.text?.includes(SENTINEL))) {
    console.log('  already applied - no write');
    process.exit(0);
  }

  const i = blocks.findIndex((b) => b.text?.includes('<h2') && b.text.includes('What is unresolved'));
  if (i < 0) throw new Error('"What is unresolved" block not found');
  blocks.splice(i, 0, { id: uid(), type: 'content', text: HTML });

  const version = '2.26.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  inserted at index ${i} (before "What is unresolved"), ${HTML.length} chars; blocks ${page.content.length} -> ${blocks.length}`);

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
       'Day twelve: the restart sequence written into babylon-node v1.4.0.0 (unconditional enactment at epoch 339,898, user transaction moratorium at 339,897), corroborated in the Radix Developers group, and the per-validator reading showing the twelve largest validators hold more than the remaining shortfall.', now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
