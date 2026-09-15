// sweep 437 – /ecosystem/radixcharts (v4.0.0, sweep 434 at 10:20 UTC 15 September) said Radix Charts V2
// "charges a 2.5% fee with no change pending" and that the two reversed metadata entries were still on
// the validator. Both were true at sweep 434's 11:07 UTC read. The owner-badge account changed both
// that afternoon. Radix Gateway, epoch 341,156 (state version 558,333,614, 20:31 UTC 15 September 2026):
//
//   - 13:45:36 UTC, txid_rdx12na44wyj..., epoch 341,075: proof of owner badge [830c67cb...] from
//     account_rdx12xt5wjz7...; REMOVE_METADATA "Radix Charts V2" and "Radix Charts Validator node - now
//     maintained by Cronos"; SET_METADATA icon_url and info_url -> jerseyjon.github.io/radix-validators,
//     name "Radix Charts V2", description "Radix Charts V2".
//   - 13:46:45 UTC, txid_rdx132afvtza..., epoch 341,075: same proof; update_fee 0.15.
//   - details.state: validator_fee_factor 0.025, validator_fee_change_request { new_fee_factor 0.15,
//     epoch_effective 345,107 } (341,075 + 4,032). Epochs have run 300 s since the 11 September restart
//     (339,984 at 18:50 UTC 11 Sept to 341,075 at 13:46 UTC 15 Sept), so 345,107 falls on 29 September.
//   - Stake vault 23,660,288 XRD (23.7m, unchanged). Cronos stake vault 7.89 XRD.
//   - jerseyjon.github.io/radix-validators (200; repo created 14:05 UTC 15 Sept) lists Radix Charts V2 and
//     DoItForDan (validator_rdx1swtu7kg5..., fee 0.05, request 0.15 at epoch 345,108) and gives hosting
//     costs up in 2026 and a lower XRD price as the reason for 15%.
//
// No other page quotes this validator's fee: the DB matches for Radix Charts V2 / the address / RadixCharts
// + validator are radix-ecosystem-funding, genkipool and radixscan (RadixCharts named, no fee) and the
// maintenance log's dated run-434 entry.
//
// Run:  node scripts/sweep-437-radixcharts-fee-rise.mjs [--dry-run]

import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const A = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

const TAG_PATH = 'ecosystem';
const SLUG = 'radixcharts';
const VERSION = '4.1.0';
const BLOCK_ID = '01819630-dcac-44e3-81c8-c126fdb2699e';

const DASH = 'https://dashboard.radixdlt.com';
const FEE_TX = `${DASH}/transaction/txid_rdx132afvtzawpsx6pnq7hxl2glhp92lqrcn2xkfng5acc8ccqyhw0yqjr27ua`;
const META_TX = `${DASH}/transaction/txid_rdx12na44wyj86gmz9au3jr70walygqtzurn98kh3x8hqs4fhn03cpfq8j89nx`;
const JJ = 'https://jerseyjon.github.io/radix-validators/';
const SENTINEL = 'txid_rdx132afvtzawpsx6pnq7hxl2glhp92lqrcn2xkfng5acc8ccqyhw0yqjr27ua';

const MESSAGE = 'The account holding the Radix Charts V2 owner badge requested a 15% fee at 13:46 UTC on 15 September, up from 2.5%, effective at epoch 345,107, around 29 September. A minute earlier it removed the two reversed metadata entries, set the description to "Radix Charts V2" and pointed the info link at jerseyjon.github.io/radix-validators. The section said no fee change was pending and the entries were still there, both true at the 11:07 UTC read. Radix Gateway at epoch 341,156 (20:31 UTC 15 September): fee 0.025, change request 0.15 at epoch 345,107, stake 23.7m XRD.';

const swap = (text, from, to, what) => {
  if (!text.includes(from)) throw new Error(`${what} not found`);
  return text.replace(from, to);
};

function apply(block) {
  const lines = block.text.split('\n');
  if (lines.length !== 5 || lines[0] !== '<h2>Validator under a new owner</h2>') {
    throw new Error(`ledger block shape changed: ${lines.length} lines`);
  }

  lines[1] = swap(lines[1], ' It charges a 2.5% fee with no change pending.', '', 'fee sentence');

  let meta = lines[3];
  meta = swap(meta, '</a> with the key and value reversed. One entry is keyed', '</a> with the key and value reversed. One entry was keyed', 'first entry verb');
  meta = swap(meta, ' and holds the template placeholder', ' and held the template placeholder', 'first entry value verb');
  meta = swap(meta, 'the other is keyed "Radix Charts V2" and holds <code>', 'the other was keyed "Radix Charts V2" and held <code>', 'second entry verbs');
  meta = swap(meta,
    'Wallets and explorers read the entry keyed <code>description</code>, which was never changed and still tells delegators that staking supports the further development of RadixCharts.',
    'Wallets and explorers read the entry keyed <code>description</code>, which went on telling delegators until 15 September that staking supported the further development of RadixCharts.',
    'description sentence');
  lines[3] = meta;

  lines.push(
    `<p>On 15 September, in two transactions a minute apart, the account holding the badge ${A(META_TX, 'removed both reversed entries')}, set the description to "Radix Charts V2" and pointed the validator’s info link at ${A(JJ, 'a page published by the GitHub user jerseyjon')}, then ${A(FEE_TX, 'requested a rise in the fee')} from 2.5% to 15%. The fee is the share of staking rewards a validator keeps before the rest goes to its delegators. Radix holds back a fee increase for 4,032 epochs, about two weeks, so that delegators can move their stake before it applies, and this one takes effect at epoch 345,107, around 29 September 2026. The jerseyjon page lists Radix Charts V2 and a second validator, DoItForDan, which also has a rise to 15% pending, and explains both rises by hosting costs that went up during 2026 while the XRD price fell.</p>`,
  );
  block.text = lines.join('\n');
}

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
    console.log('  radixcharts: already applied – no write');
    process.exit(0);
  }
  const block = blocks.find((b) => b.id === BLOCK_ID);
  if (!block) throw new Error('radixcharts ledger block missing');
  const before = block.text.split('\n');
  apply(block);

  const json = JSON.stringify(blocks);
  if ([0x2014, 0xa0].some((c) => json.includes(String.fromCharCode(c)))) throw new Error('em dash or non-breaking space in content');

  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${VERSION}`);
  const after = block.text.split('\n');
  for (let i = 0; i < Math.max(before.length, after.length); i++) {
    if (before[i] === after[i]) continue;
    if (before[i] !== undefined) console.log(`\n- ${before[i]}`);
    if (after[i] !== undefined) console.log(`+ ${after[i]}`);
  }

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
