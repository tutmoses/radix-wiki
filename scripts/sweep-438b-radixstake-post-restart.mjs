// sweep 438b - /ecosystem/radixstake (v3.0.1, last verified 7 August 2026) carried three figures the
// 4-11 September halt made wrong. The infobox gave "Stake 107,947,277.39 XRD (rank 12 of 188,
// 7 Aug 2026)" and "Uptime 100% (trailing month)", a trailing month that now contains a seven-day
// network stop, and the On-ledger status section read in the present tense off the same August
// reading. Radix Gateway, 15 September 2026, state versions 558,349,336 to 558,349,408, epoch 341,188:
//
//   - /statistics/validators/uptime, no window: 11,835,516 proposals made, 333 missed, 308,099
//     epochs active. With from_ledger_state epoch 339,987 (the restart epoch): 10,793 made,
//     0 missed, 1,200 epochs.
//   - /state/entity/details on the validator: is_registered true, validator_fee_factor 0.0149,
//     validator_fee_change_request { new_fee_factor 0.149, epoch_effective 288573 }. The list
//     endpoint's effective_fee_factor.current is 0.149, so the page's fee section is right and is
//     left alone.
//   - stake_xrd_vault internal_vault_rdx1tq86ejtf... holds 107,699,180.272754 XRD. 107,947,277.39
//     minus that is 248,097.12.
//   - /state/validators/list paged in full: 287 validator entities, 186 with state.is_registered
//     true, down from the 188 the August reading recorded. Sorted by stake vault balance RadixStake
//     is 12th of the 186; the top 100 (the active set) hold 4,611,742,226 XRD and
//     active_in_epoch.stake_percentage is 2.3353645.
//
// The seven em dashes in this page's existing prose are left alone: converting the corpus is the
// standing FLAG FOR A HUMAN opened at run 292, not a sweep edit.
//
// Run:  node scripts/sweep-438b-radixstake-post-restart.mjs [--dry-run]

import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');

const TAG_PATH = 'ecosystem';
const SLUG = 'radixstake';
const VERSION = '3.1.0';
const INFOBOX_ID = '28a1c82f-17ae-48ca-9d42-b337b07ad692';
const BLOCK_ID = '7433123a-24ac-493c-87da-fbc67a626f91';
const SENTINEL = '10,793 proposals';

const MESSAGE =
  'Three figures the 4 to 11 September halt made wrong, re-read from the Radix Gateway at epoch 341,188 on 15 September 2026. The infobox gave uptime as "100% (trailing month)" over a trailing month containing a seven-day network stop, and a stake of 107,947,277.39 XRD at rank 12 of 188 dated 7 August; the On-ledger status section read that August reading in the present tense. The node has made 10,793 proposals and missed none over the 1,200 epochs since the restart, and holds 107,699,180 XRD, twelfth of the 186 registered validators, two fewer than in August, and 2.3% of the active set. The 14.9% fee was re-checked against effective_fee_factor and is unchanged.';

const EDITS = [
  ['infobox stake row',
    '<tr><th>Stake</th><td>107,947,277.39 XRD (rank 12 of 188, 7 Aug 2026)</td></tr>',
    '<tr><th>Stake</th><td>107,699,180 XRD (rank 12 of 186 registered validators, 2.3% of the active set, 15 September 2026)</td></tr>'],
  ['infobox uptime row',
    '<tr><th>Uptime</th><td>100% (trailing month)</td></tr>',
    '<tr><th>Uptime</th><td>10,793 proposals made and none missed since the 11 September 2026 restart</td></tr>'],
];

const NEW_PARA = '<p>Re-read at epoch 341,188 on 15 September 2026, four days after the network restarted following the <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">Hyperlane asset drain</a>, the node is still registered and holds <strong>107,699,180 XRD</strong>, 248,097 less than in August. It is twelfth of the 186 validators now registered on Radix, two fewer than the 188 of August, and holds 2.3% of the 4.61bn XRD staked to the hundred validators in the active set, the ones that run consensus. The Gateway uptime statistics give <strong>10,793 proposals made and none missed</strong> over the 1,200 epochs since the restart, and 11,835,516 made against 333 missed over the node’s whole life.</p>';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${TAG_PATH}/${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error(`${TAG_PATH}/${SLUG} not found`);
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  radixstake: already applied - no write');
    process.exit(0);
  }

  const box = blocks.find((b) => b.id === INFOBOX_ID);
  if (!box || box.type !== 'infobox') throw new Error('infobox missing');
  const body = blocks.find((b) => b.id === BLOCK_ID);
  if (!body) throw new Error('body block missing');

  const swap = (holder, key, [what, from, to]) => {
    if (!holder[key].includes(from)) throw new Error(`${what} not found`);
    holder[key] = holder[key].replace(from, to);
    console.log(`\n- ${from}\n+ ${to}`);
  };

  for (const e of EDITS) swap(box.blocks[0], 'text', e);

  const lines = body.text.split('\n');
  if (lines.length !== 4) throw new Error(`body shape changed: ${lines.length} lines`);
  if (!lines[0].endsWith('<h2>On-ledger status (August 2026)</h2>')) throw new Error('status heading not at line 0 tail');

  const tense = [
    ['status heading', '<h2>On-ledger status (August 2026)</h2>', '<h2>On-ledger status</h2>'],
    ['august reading tense',
      'is <strong>registered</strong>, accepts delegated stake, holds <strong>107,947,277.39&nbsp;XRD</strong>',
      'was <strong>registered</strong>, accepted delegated stake, held <strong>107,947,277.39&nbsp;XRD</strong>'],
    ['august closing sentence', ' The operation is running.', ''],
  ];
  const holder = { l0: lines[0], l1: lines[1] };
  swap(holder, 'l0', tense[0]);
  swap(holder, 'l1', tense[1]);
  swap(holder, 'l1', tense[2]);
  lines[0] = holder.l0;
  lines[1] = holder.l1;
  lines.splice(2, 0, NEW_PARA);
  console.log(`\n+ ${NEW_PARA}`);
  body.text = lines.join('\n');

  const added = [EDITS[0][2], EDITS[1][2], tense[0][2], tense[1][2], NEW_PARA].join('');
  if ([0x2014, 0xa0].some((c) => added.includes(String.fromCharCode(c)))) throw new Error('em dash or non-breaking space in new content');

  const json = JSON.stringify(blocks);
  console.log(`\n  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${VERSION}`);

  if (!DRY) {
    const now = new Date().toISOString();
    await client.query('BEGIN');
    await client.query(
      'UPDATE pages SET content = $1, version = $2, updated_at = $3 WHERE id = $4',
      [json, VERSION, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, VERSION, 'minor', AUTHOR_ID, MESSAGE, now]);
    await client.query('COMMIT');
    console.log('\n  written');
  }
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  throw err;
} finally {
  client.release();
  await pool.end();
}
