// Sweep 405 — /contents/resources/radix-ecosystem-operational-status
// Adds what the 67% threshold actually triggers: the enactment epoch, the user
// transaction moratorium and the order they fire in, read from babylon-node's own
// mainnet protocol config and corroborated in the Radix Developers group on 11 Sep.
// Also corrects the base the run-403 paragraph attributed the adoption percentage to.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/resources';
const SLUG = 'radix-ecosystem-operational-status';
const SENTINEL = 'halt-restart-sequence';
const DRY = process.argv.includes('--dry-run');

const WRONG_BASE = 'of the 4,663,021,341&nbsp;XRD held by the 94 validators the explorer reports a version for, across 28 of them';
const RIGHT_BASE = 'of the 4,663,021,341&nbsp;XRD of stake in the active validator set, across 28 validators';

const ADDITION = `<p id="${SENTINEL}"><strong>What the threshold triggers is already written into the node software, and it does not go to a vote.</strong> babylon-node v1.4.0.0 carries the switch in <a href="https://github.com/radixdlt/babylon-node/blob/main/core-rust/state-manager/src/protocol/protocol_configs/mainnet_protocol_config.rs" target="_blank" rel="noopener">its mainnet protocol config</a>: Eagle Ray is set to enact at the start of epoch 339,898 unconditionally, which makes it the only mainnet protocol update in Radix's history that does not wait for validators to signal readiness. Readiness is counted in completed epochs, and a halted network completes none, so a readiness vote could not have been used here. The same file declares a user transaction moratorium covering epoch 339,897 &ndash; an epoch range during which user transactions are refused. The two entries give the restart its order: once validators holding more than two thirds of active stake are online and running v1.4.0.0, consensus can certify rounds again and resumes inside epoch 339,897; that epoch produces rounds but accepts no user transactions; and at the start of epoch 339,898 the fork enacts and the moratorium ends together, so wallets, dApps and exchanges see transactions accepted again on the patched engine rather than at the moment liveness returns. Two node operators set out that sequence in the <a href="https://t.me/RadixDevelopers/66388" target="_blank" rel="noopener">Radix Developers group on 11 September</a>, one reading it from the code and <a href="https://t.me/RadixDevelopers/66385" target="_blank" rel="noopener">Daffy confirming</a> that the quorum for the fork is the same two thirds and that there will be no announcement before liveness returns, because the moment cannot be predicted. Read at <strong>07:07&nbsp;UTC on 11 September</strong>, <a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">gateway-status</a> returns state version 557,840,622 at epoch 339,896, round 102, two hundred and forty-nine hours and forty-seven minutes without a committed round, and <a href="https://validators.stakesafe.net" target="_blank" rel="noopener">the adoption tracker</a> reads 1,455,804,324&nbsp;XRD on v1.4.0.0, 31.22% against the 67% the restart needs.</p>`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  if (/\u00A0/.test(ADDITION + WRONG_BASE)) throw new Error('literal U+00A0 in script strings');

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (blocks.some((b) => b.text?.includes(SENTINEL))) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  const i = blocks.findIndex((b) => b.text?.includes('halt-restart-threshold'));
  if (i < 0) throw new Error('halt block not found');

  const before = blocks[i].text;
  if (!before.includes(WRONG_BASE)) throw new Error('base-correction target string not found');
  blocks[i].text = before.replace(WRONG_BASE, RIGHT_BASE) + ADDITION;

  const version = '1.17.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  block ${i}: ${before.length} -> ${blocks[i].text.length} chars`);
  console.log(`  base corrected: ${before.includes(WRONG_BASE)} -> ${blocks[i].text.includes(RIGHT_BASE)}`);

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
       'Add the restart sequence the 67% threshold triggers: unconditional enactment at epoch 339,898 and the user transaction moratorium at 339,897, read from babylon-node mainnet_protocol_config.rs and corroborated in the Radix Developers group on 11 September. Correct the base the adoption percentage is computed on.', now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
