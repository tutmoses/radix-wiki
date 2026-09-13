// sweep 424 (contents/resources): three validators unregistered after the 11 September 2026 restart.
// Blockshard's page still said its joint node with RadixUID was registered and paying delegators
// (read 17 August); the operational-status index named only the August census of unregistered nodes.
// Sources: radixscan radix_get_transaction on the three unregister txids and radix_get_validator
// live reads at epoch 340,515 (13 September 2026, 15:06 UTC).
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const TX_BS = 'txid_rdx12qg9p4fplz7lsm4875jppk56jepvwjshdjkm4ml4zvhr7hcwut4qtxejxs';
const TX_VS = 'txid_rdx10jm7xctrtpjwfn7gfcxvn2kqvjnc7avfm722afj2ntq3c9mh6vrslru7wz';
const TX_FC = 'txid_rdx136ytvtv7tpljypxrurqtyyr9vl9gaxdh3k03ujth2tpk0j3kf6fqa4nfmu';
const VAL_BS = 'validator_rdx1svudtxxkegaeg6ks0qgjujfp8g80de2f63ygvfqug6zv987e99jk3q';
const VAL_VS = 'validator_rdx1sw57m6dhcz8u92cr8l4sljw6acqgcen2xeqy2ad4dxd4vzgg793w09';
const VAL_FC = 'validator_rdx1svwaxe5frfrcd8t9s38zdwv067860w02xth9jr4pd6cpkd38vln0vx';
const tx = (id) => `<a href="https://dashboard.radixdlt.com/transaction/${id}" target="_blank" rel="noopener">${id.slice(0, 16)}…</a>`;
const val = (id, name) => `<a href="https://dashboard.radixdlt.com/network-staking/${id}" target="_blank" rel="noopener">${name}</a>`;

const EDITS = [
  {
    tagPath: 'ecosystem',
    slug: 'blockshard',
    version: '3.2.0',
    sentinel: TX_BS,
    message: 'The joint Blockshard and RadixUID validator unregistered at 07:17:49 UTC on 13 September 2026 (' + TX_BS + '). Read live at epoch 340,515: registered false, uptime 0, 13,999,244.68 XRD still delegated, fee 1%. Infobox row, intro and the August reading re-tensed; new subsection with the transaction.',
    replacements: [
      ['— registered, 12,252,454.55 XRD staked, 1% fee (read on-ledger 17 August 2026, epoch 335,694)',
        '– unregistered since 13 September 2026, 13,999,244.68 XRD still delegated, 1% fee (read on-ledger 13 September 2026, epoch 340,515)'],
      ['Web3 staking and validator provider that operates a validator node on the',
        'Web3 staking and validator provider that ran a validator node on the'],
      ['On Radix, Blockshard operates a validator node that secures the network under its',
        'On Radix, Blockshard ran a validator node, until it unregistered in September 2026, that secured the network under its'],
      ['so this joint node is the part of that collaboration still running.',
        'so this joint node was the part of that collaboration still running, until it unregistered as well (below).'],
      ['the validator is <strong>registered</strong> and sitting inside the active set',
        'the validator was <strong>registered</strong> and sat inside the active set'],
      ['so delegators here are being paid.', 'so delegators were being paid.'],
      ['<h2>External links</h2>',
        `<h3>Unregistered after the restart</h3>\n<p>The node left the validator set two days after mainnet restarted on 11 September 2026. At 07:17:49 UTC on 13 September its owner badge was used to call <code>unregister</code> on the validator, in ${tx(TX_BS)}. Read at epoch 340,515 (state version 558,049,585, 15:06 UTC the same day), the validator reports <strong>registered: false</strong> and 0% uptime, while <strong>13,999,244.68 XRD</strong> is still delegated to it – more than the 12.25 million it held in August. Only registered validators can enter the active set, so that stake earns no emissions until the node registers again or delegators move it. The fee stays at 1% and the node still accepts delegated stake, which means a new delegation would be accepted and would earn nothing.</p>\n<p>It was one of three validators to unregister in the first two days after the restart, together holding about 38.2 million XRD; the other two are listed on <a href="/contents/resources/radix-ecosystem-operational-status" rel="noopener">Radix Ecosystem Operational Status</a>.</p>\n<h2>External links</h2>`],
    ],
    verify: true,
  },
  {
    tagPath: 'contents/resources',
    slug: 'radix-ecosystem-operational-status',
    version: '1.21.0',
    sentinel: 'Vunterslaush',
    message: 'Three validators unregistered after the 11 September 2026 restart, holding 38.2M XRD at epoch 340,515: Vunterslaush Staking (' + TX_VS + '), Fundamento Cripto (' + TX_FC + ') and the Blockshard/RadixUID node (' + TX_BS + '). Added to the validator-registration bullet, with why Blockshard stays listed as operational.',
    replacements: [
      ['<a href="/ecosystem/radixuid" rel="noopener">RadixUID</a>.</li>',
        `<a href="/ecosystem/radixuid" rel="noopener">RadixUID</a>. Three more unregistered in the first two days after the <strong>11 September 2026 restart</strong>, holding 38.2 million XRD between them when read at epoch 340,515 on 13 September: ${val(VAL_VS, 'Vunterslaush Staking')} (10,286,938.79 XRD, ${tx(TX_VS)}, 12:44 UTC on 11 September), ${val(VAL_FC, 'Fundamento Cripto')} (13,881,727.02 XRD, ${tx(TX_FC)}, 13:46 UTC the same day) and ${val(VAL_BS, 'the joint Blockshard and RadixUID node')} (13,999,244.68 XRD, ${tx(TX_BS)}, 07:17 UTC on 13 September). All three still accept delegated stake. <a href="/ecosystem/blockshard" rel="noopener">Blockshard</a> stays listed as operational below because its status field describes a company that runs validators on several other networks; its page records the deregistration.</li>`],
    ],
    verify: false,
  },
];

for (const e of EDITS) for (const [a, b] of e.replacements) {
  if (/ /.test(a + b)) throw new Error(`U+00A0 in a find/replace string for ${e.slug}`);
}

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  for (const e of EDITS) {
    if (isLockedPage(e.tagPath, e.slug)) throw new Error(`${e.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [e.tagPath, e.slug]);
    if (!rows.length) throw new Error(`${e.slug}: page not found`);
    const page = rows[0];
    const blocks = JSON.parse(JSON.stringify(page.content));
    const texts = [];
    const walk = (bs) => bs.forEach((b) => { if (typeof b.text === 'string') texts.push(b); if (b.blocks) walk(b.blocks); });
    walk(blocks);
    if (texts.some((b) => b.text.includes(e.sentinel))) {
      console.log(`  ${e.slug}: already applied, no write`);
      continue;
    }
    for (const [find, repl] of e.replacements) {
      const hits = texts.filter((b) => b.text.includes(find));
      if (hits.length !== 1) throw new Error(`${e.slug}: "${find.slice(0, 60)}" matched ${hits.length} blocks`);
      hits[0].text = hits[0].text.replace(find, repl);
    }
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${e.version}  (${e.replacements.length} replacements)`);
    if (DRY) continue;
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query(
      `UPDATE pages SET content=$1, version=$2, updated_at=$3${e.verify ? ', last_verified_at=$3' : ''} WHERE id=$4`,
      [json, e.version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, e.version, 'minor', AUTHOR_ID, e.message, now]);
    await client.query('COMMIT');
  }
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  throw err;
} finally {
  client.release();
  await pool.end();
}
