// sweep 441 - ecosystem rotation, the next slice of the staleness queue after
// run 438: rdx-works (verified 3 August), hydraswap and radix-kingdoms (6 August).
//
// rdx-works: Companies House re-read 16 September 2026. Nothing filed since the
//   strike-off was discontinued on 30 May; the 2025 accounts are still overdue;
//   registered office still 7 Bell Yard. rdx.works and radixfoundation.org still
//   refuse the TLS handshake. Two dated sentences carried forward.
// hydraswap: $HYDR re-read at epoch 341331 (state version 558418248), supply
//   965,199,999.0019. The 621,367 burned since 6 August is seven transactions from
//   one account, which also made the 1,000,000 burn on 2 August.
// radix-kingdoms: KGLD re-read at the same epoch, 21,112,916.65, a further 600,900.70
//   below 6 August. The 100 most recent transactions touching KGLD fall between 13
//   and 16 September, 48 on 15 September. Authorities unchanged. Four typos fixed.
//
//   node scripts/sweep-441-ecosystem-reledger.mjs --dry-run

import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, withClient } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const DASH = 'https://dashboard.radixdlt.com';
const ext = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const HALT = '<a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">network halt</a>';
const BURNER = 'account_rdx12yvhjq3j3xjnrjap789gra47eh8p4av5ygx23rgch74sdndr0d2qdu';

const EDITS = [
  {
    slug: 'rdx-works',
    version: '3.4.3',
    sentinel: 'Read again on 16 September 2026',
    swaps: [
      ['the next fell due on 31 March 2026.</p>',
       'the next fell due on 31 March 2026. Read again on 16 September 2026, those accounts are five and a half months late, the registered office is unchanged, and nothing has been filed since the strike-off was discontinued.</p>'],
      ['<p>As of 2026-07-30 the RDX Works website no longer serves:',
       '<p>As of 2026-07-30, and again on 16 September 2026, the RDX Works website does not serve:'],
    ],
    message: 'Companies House re-read 16 September 2026: no filing since the strike-off was discontinued on 30 May, the accounts to 31 March 2025 still overdue, the registered office still 7 Bell Yard. rdx.works and radixfoundation.org still refuse the TLS handshake. Dated both readings.',
  },
  {
    slug: 'hydraswap',
    version: '1.5.0',
    sentinel: '965,199,999',
    swaps: [
      ['— 965,821,366 supply, minting permanently denied, burning open to every holder (read on-ledger 6 August 2026, epoch 332526, state version 546295971)',
       '965,199,999 supply, minting permanently denied, burning open to every holder (read on-ledger 16 September 2026, epoch 341331, state version 558418248)'],
      [/It does: 966\.8 million on 26 July 2026 and <strong>965,821,366<\/strong> on 6 August, roughly a million tokens burned in eleven days\. Both the authorities and the live total are readable on the <a[^>]*>Radix Dashboard<\/a> \(epoch 332526, state version 546295971\)\.<\/p>/,
       `It does: 966.8 million on 26 July 2026, 965,821,366 on 6 August and <strong>965,199,999</strong> on 16 September (epoch 341331, state version 558418248). Almost all of that is one account. ${ext(`${DASH}/account/${BURNER}`, 'account_rdx12yvhjq…qdu')} made the ${ext(`${DASH}/transaction/txid_rdx1me5vlesvqyfca6vd7d7hkwn6yhcz3mz9nlxflneqfzzttfgy4nyql6cz59`, '1,000,000 burn on 2 August')}, and the 621,367 burned since 6 August is seven transactions from the same account: 100,000 HYDR on 9, 16, 23 and 30 August and on 12 and ${ext(`${DASH}/transaction/txid_rdx1kywdgnrrdzfk0zlhwz7278vmlk45r3lzmh2ak2qzn02vuday6wxqgmm5nz`, '14 September')}, and 21,367 on 14 August. The two-week gap after 30 August is the ${HALT}. Both the authorities and the live total are readable on the ${ext(`${DASH}/resource/resource_rdx1t4kc2yjdcqprwu70tahua3p8uwvjej9q3rktpxdr8p5pmcp4almd6r`, 'Radix Dashboard')}.</p>`],
    ],
    message: 'Re-read $HYDR at epoch 341331, 16 September 2026: 965,199,999 supply, down 621,367 since 6 August. Every burn since then, and the 1,000,000 burn on 2 August, came from one account, traced through /stream/transactions balance changes; the weekly 100,000 burns paused through the network halt.',
  },
  {
    slug: 'radix-kingdoms',
    version: '2.2.0',
    sentinel: '21,112,916.65',
    swaps: [
      ['Players minting a Kingdoms obtain a ', 'Players who mint a kingdom receive an '],
      ['>NFTs</a> that grants', '>NFT</a> that grants'],
      ['grants ownership of a kingdom component; andd is needed', 'grants ownership of a kingdom component and is needed'],
      ['with a total supply of 21,713,817.35 as of 6 August 2026 (see below)', 'with a total supply of 21,112,916.65 as of 16 September 2026 (see below)'],
      ['so the oracle acount does', 'so the oracle account does'],
      ['performed by the orcale,', 'performed by the oracle,'],
      ['<h2>On-Ledger Reading (6 August 2026)</h2>', '<h2>On-Ledger Readings (August and September 2026)</h2>'],
      ['<p>The <a href="/developers/scrypto/03-authorization-and-badges"',
       `<p>Read again on 16 September 2026 at epoch 341331, five days after the ${HALT} ended, supply is <strong>21,112,916.65 KGLD</strong>, a further 600,900.70 below the August reading. The game is being played through the restart: the 100 most recent transactions touching KGLD all fall between 13 and 16 September, 48 of them on 15 September. The authorities below are unchanged.</p>\n<p>The <a href="/developers/scrypto/03-authorization-and-badges"`],
    ],
    message: 'Re-read KGLD at epoch 341331, 16 September 2026: 21,112,916.65 supply, 600,900.70 below 6 August, with 100 transactions touching it between 13 and 16 September, so play resumed after the network halt. Authorities unchanged. Fixed four typos (andd, orcale, acount, "a Kingdoms ... NFTs").',
  },
];

// Apply a swap to whichever block (or nested infobox block) holds it, exactly once.
function swapOnce(blocks, [from, to]) {
  let hits = 0;
  const visit = (list) => list.map((b) => {
    let next = b;
    if (typeof b.text === 'string') {
      const has = from instanceof RegExp ? from.test(b.text) : b.text.includes(from);
      if (has) { hits++; next = { ...b, text: b.text.replace(from, to) }; }
    }
    if (Array.isArray(b.blocks)) next = { ...next, blocks: visit(b.blocks) };
    return next;
  });
  const out = visit(blocks);
  if (hits !== 1) throw new Error(`expected 1 match, got ${hits}: ${String(from).slice(0, 60)}`);
  return out;
}

await withClient(async (client) => {
  for (const e of EDITS) {
    if (isLockedPage('ecosystem', e.slug)) throw new Error(`${e.slug} is LOCKED`);
    const { rows } = await client.query(
      "SELECT id, title, version, content FROM pages WHERE tag_path = 'ecosystem' AND slug = $1", [e.slug]);
    if (!rows.length) throw new Error(`${e.slug} not found`);
    const page = rows[0];
    if (JSON.stringify(page.content).includes(e.sentinel)) {
      console.log(`  ${e.slug}: already applied - no write`);
      continue;
    }
    let blocks = JSON.parse(JSON.stringify(page.content));
    for (const s of e.swaps) blocks = swapOnce(blocks, s);
    const json = JSON.stringify(blocks);
    if (json.includes('\u00a0')) throw new Error(`${e.slug}: U+00A0 in output`);
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${e.version}  (${e.swaps.length} swaps)`);
    if (DRY) continue;

    const now = new Date().toISOString();
    const type = e.version.endsWith('.0') ? 'minor' : 'patch';
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, e.version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, e.version, type, AUTHOR_ID, e.message, now]);
    await client.query('COMMIT');
    console.log('    written and stamped');
  }
});
