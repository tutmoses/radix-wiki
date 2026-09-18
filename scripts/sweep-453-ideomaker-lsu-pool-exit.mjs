// sweep 453 – ecosystem rotation, the verification-age head after run 450.
//
// ideomaker: Ideomaker Europe's stake fell from 22,292,726.83 XRD (epoch 334,878, 14 August) to
//   14,066,400.40 XRD (epoch 341,907, 18 September 2026), rank 47 of 187 -> 60 of 186. Pinned
//   reads of the stake vault date the fall to 14-21 August (-7.16m) and 28 August-1 September
//   (-1.10m). The Gateway transaction stream for the validator shows eight transactions carrying
//   it, all one manifest: XRD swapped for LSULP in CaviarNine's Hyper Stake LSULP/XRD pool
//   (pool_rdx1chmckjpr...), LSULP redeemed from the LSU Pool component (component_rdx1cppy08xg...)
//   for this validator's stake units, those units unstaked in the same transaction. Six sending
//   accounts; claims 21-23 August. The LSU Pool holds 6,691,580.78 of the 11,498,966.02 units in
//   existence (58%), against 6,122,450.11 of 18,294,157.08 (33%) on 14 August. Uptime since the
//   last reading: 34,617 proposals made, 7 missed, active in all 7,029 epochs. Effective fee 0.10,
//   stored 0.02, unchanged. ideomaker.com still carries the 6 August 2021 Webflow stamp.
// genkipool: links the console's claim-package-royalties page (announced in RadixDevelopers,
//   17 September) from the existing "royalty claiming" entry.
//
//   node scripts/sweep-453-ideomaker-lsu-pool-exit.mjs --dry-run

import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, withClient } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG = 'ecosystem';
const ext = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const int = (href, text) => `<a href="${href}" rel="noopener">${text}</a>`;
const GATEWAY = ext('https://docs.radixdlt.com/docs/network-gateway', 'Radix Gateway');
const EMDASH = String.fromCharCode(0x2014);
const NBSP = String.fromCharCode(0xa0);
const TX = 'txid_rdx10k00zlr48pqklv7p7r4crdalp6petkw8cm54gz2cehfay90e805qrh8cac';

const IDEO_NEW = `The node is not neglected.</p>`
  + `<h3>The stake that left in August 2026</h3>`
  + `<p>Read from the ${GATEWAY} at <strong>epoch 341,907</strong> on 18 September 2026, Ideomaker Europe holds <strong>14,066,400&nbsp;XRD</strong>, 8.2m less than on 14 August, and ranks <strong>60th of the 186 registered validators</strong> rather than 47th of 187. It has stayed in the active set for all 7,029 epochs since the last reading, proposing 34,617 times and missing 7, and it still charges 10% against a stored field of 2%.</p>`
  + `<p>Almost all of the 8.2m left by one route, in eight transactions: seven on 14 and 15 August carrying 7.15m&nbsp;XRD, and one of 1.1m on 30 August. Each ran the same manifest (${ext(`https://dashboard.radixdlt.com/transaction/${TX}`, 'the largest, 3m XRD on 14 August')}): the sender swapped XRD for LSULP in ${int('/ecosystem/caviarnine', 'CaviarNine')}'s Hyper Stake LSULP/XRD pool; redeemed that LSULP from CaviarNine's ${ext('https://docs.caviarnine.com/products-floop/lsu-pool/lsu-pool-overview', 'LSU Pool')}, asking for Ideomaker Europe's stake units in particular; and unstaked those units in the same transaction. Six accounts sent them, and the XRD was claimed from 21 to 23 August, once the unstaking delay had passed.</p>`
  + `<p>The LSU Pool holds stake units from many validators, and LSULP is the token it issues against them. It now holds <strong>6.69m of the 11.5m</strong> Ideomaker Europe stake units in existence, 58% of the validator's stake, up from 6.12m of 18.29m (33%) on 14 August. Holders have been depositing Ideomaker units into the pool while these transactions took them out, so more than half of the stake behind this validator now sits in one CaviarNine component rather than with individual delegators.</p>`;

const EDITS = [
  {
    slug: 'ideomaker',
    version: '3.1.0',
    sentinel: 'The stake that left in August 2026',
    swaps: [
      ['The node is not neglected.</p>', IDEO_NEW],
      ['inside the Radix mainnet active set with <strong>22.3&nbsp;million XRD</strong> of delegated stake',
        'inside the Radix mainnet active set with <strong>14.1m&nbsp;XRD</strong> of delegated stake (18 September 2026)'],
      ['against a real balance of 22.3 million.', 'against a real balance of 14.1m.'],
      ['and the checks below were made on 14 August 2026.', 'and the checks below were made on 14 August 2026 and repeated on 18 September.'],
    ],
    message: 'Re-read 18 September 2026 at epoch 341,907. Stake 22,292,726.83 -> 14,066,400.40 XRD since 14 August, rank 47 of 187 -> 60 of 186. New section traces the fall: eight transactions (seven on 14-15 August, 7.15m; one of 1.1m on 30 August) each swapped XRD for LSULP in the Hyper Stake LSULP/XRD pool, redeemed it from the CaviarNine LSU Pool for Ideomaker Europe stake units and unstaked them. The LSU Pool now holds 6.69m of 11.5m units (58%, from 33%). 34,617 proposals made, 7 missed since the last reading; fee 10% charged, 2% stored. ideomaker.com unchanged since August 2021.',
  },
  {
    slug: 'genkipool',
    version: '1.3.3',
    change: 'patch',
    sentinel: 'console/claim-package-royalties',
    swaps: [
      ['a wallet playground, royalty claiming, an address book',
        `a wallet playground, ${ext('https://radix-community.genkipool.com/en/console/claim-package-royalties', 'royalty claiming')} for Scrypto packages, an address book`],
    ],
    message: 'Links the console tool for claiming package royalties, announced in Radix Developers on 17 September 2026.',
  },
];

function swapOnce(blocks, [from, to]) {
  let hits = 0;
  const visit = (list) => list.map((b) => {
    let next = b;
    if (typeof b.text === 'string' && b.text.includes(from)) { hits++; next = { ...b, text: b.text.replace(from, to) }; }
    if (Array.isArray(b.blocks)) next = { ...next, blocks: visit(b.blocks) };
    return next;
  });
  const out = visit(blocks);
  if (hits !== 1) throw new Error(`expected 1 match, got ${hits}: ${from.slice(0, 70)}`);
  return out;
}

await withClient(async (client) => {
  for (const e of EDITS) {
    if (isLockedPage(TAG, e.slug)) throw new Error(`${e.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG, e.slug]);
    if (!rows.length) throw new Error(`${e.slug} not found`);
    const page = rows[0];
    if (JSON.stringify(page.content).includes(e.sentinel)) {
      console.log(`  ${e.slug}: already applied – no write`);
      continue;
    }
    let blocks = JSON.parse(JSON.stringify(page.content));
    for (const s of e.swaps) blocks = swapOnce(blocks, s);
    const json = JSON.stringify(blocks);
    if (json.includes(NBSP) || json.includes(EMDASH)) throw new Error(`${e.slug}: U+00A0 or an em dash in output`);
    if (!json.includes(e.sentinel)) throw new Error(`${e.slug}: sentinel missing after edits`);
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${e.version}  (${json.length - JSON.stringify(page.content).length} chars)`);
    if (DRY) continue;

    const now = new Date().toISOString();
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, e.version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, e.version, e.change ?? 'minor', AUTHOR_ID, e.message, now]);
    await client.query('COMMIT');
    console.log('    written and stamped');
  }
});
