// sweep 447 – ecosystem rotation, the verification-age head after run 445.
//
// stakingcoins: re-read from the Gateway at epoch 341,619 (11:05 UTC 17 September 2026). The
//   validator is registered and accepting stake but made none of its proposals in the preceding
//   day (0%), 44.72% over the week and 92.04% over the month. 63 of the 64 validators above it by
//   stake recorded at least 98% over the same day; the exception was WEFT. Stake 15,355,297.71 ->
//   12,598,800.79 XRD since 10 August, rank 61 of 188 -> 65 of 187. Fee still 10% charged, 2%
//   stored. Em dashes converted.
// dexian-protocol: KaiYuan Epoch re-read at the same epoch: unchanged at 3,757,840 XRD, 1% fee, 0%
//   uptime over the day and month, rank 84 of 187. Its website field now names goxrd.com, which
//   serves a "website has been stopped" placeholder over plain HTTP and fails TLS. dexian.io is
//   still NXDOMAIN. The "Security" section claimed third-party audits, published code and
//   multi-factor authentication with no source for any of it; removed. Em dashes converted.
// world-cup-badge-arena: component re-read: the last committed transaction is still card #1009
//   on 19 July 2026, and the site still says the reveal arrives "in v2". Dated sentence updated.
//
//   node scripts/sweep-447-ecosystem-stale-head.mjs --dry-run

import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, withClient } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG = 'ecosystem';
const ext = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const int = (href, text) => `<a href="${href}" rel="noopener">${text}</a>`;
const GATEWAY = ext('https://mainnet.radixdlt.com/state/validators/list', 'Radix Gateway');
const EMDASH = String.fromCharCode(0x2014);
const NBSP = String.fromCharCode(0xa0);

const EDITS = [
  {
    slug: 'stakingcoins',
    version: '2.3.0',
    sentinel: 'Missed proposals (September 2026)',
    dashes: true,
    swaps: [
      ['<td>🟢 Active (registered)</td>',
       '<td>🟢 Active (registered; no proposals in the 24 hours to 17 Sep 2026)</td>'],
      ['<td>15,355,297.71 XRD (rank 61 of 188 registered, 10 Aug 2026)</td>',
       '<td>12,598,800.79 XRD (rank 65 of 187 registered, 17 Sep 2026)</td>'],
      ['<td>99.97% (49,626 proposals made, 14 missed over 30 days)</td>',
       '<td>0% over the past day, 44.72% over the past week, 92.04% over the past month (17 Sep 2026)</td>'],
      ['As of 10 August 2026 the <a',
       'As of 17 September 2026 the <a'],
      ['is registered on the Radix mainnet with 15,355,297.71&nbsp;XRD staked and a 99.97% 30-day proposal record.',
       'is registered on the Radix mainnet with 12,598,800.79&nbsp;XRD staked, but it has stopped proposing; see <strong>Missed proposals</strong> below.'],
      ['<h2>External Links</h2>',
       `<h2>Missed proposals (September 2026)</h2><p>Read from the ${GATEWAY} at <strong>epoch 341,619</strong> (11:05 UTC, 17 September 2026), the validator is still registered and still accepts delegated stake, but it made <strong>none</strong> of the proposals due from it in the preceding 24 hours. Its record is 44.72% over the past week and 92.04% over the past month. Over the same day, 63 of the 64 validators above it by stake recorded at least 98%; the exception was WEFT. The network ${int('/contents/history/hyperlane-asset-drain-2026', 'restarted on 11 September 2026')} after a halt of about ten and a half days, so the weekly figure covers roughly six days of running ledger.</p><p>Its stake is now <strong>12,598,800.79&nbsp;XRD</strong>, 2,756,497&nbsp;XRD (18%) less than on 10 August, and it ranks 65th of 187 registered validators. The fee it charges is unchanged at 10%, and the stored factor still reads 2%. The operator site at radixdlt.stakingcoins.eu answered normally on the same day, which says nothing about the node itself.</p><h2>External Links</h2>`],
    ],
    message: 'Re-read at epoch 341,619 (17 September 2026): the validator is registered but made no proposals in the preceding 24 hours (44.72% over the week, 92.04% over the month), while 63 of the 64 validators above it recorded at least 98%. Stake 15.36m -> 12.60m XRD since 10 August, rank 61 -> 65. Infobox updated; new dated section; em dashes converted.',
  },
  {
    slug: 'dexian-protocol',
    version: '3.5.0',
    sentinel: 'epoch 341,619',
    dashes: true,
    swaps: [
      ['<code>dexian.io</code> no longer resolves (NXDOMAIN, checked 6 August 2026)',
       '<code>dexian.io</code> no longer resolves (NXDOMAIN, checked 17 September 2026)'],
      ['still registered, ~3.76M XRD staked, 1% fee, <strong>0% uptime</strong> over the trailing week and month (read on-ledger 6 August 2026, epoch 332526, state version 546295971)',
       'still registered and accepting stake, 3,757,840 XRD staked (rank 84 of 187, unchanged since August), 1% fee, <strong>0% uptime</strong> over the trailing day and month; its website field now names goxrd.com, which serves a hosting provider\'s "website has been stopped" placeholder (read on-ledger 17 September 2026, epoch 341,619)'],
    ],
    cut: '<h2>Security</h2>',
    message: 'KaiYuan Epoch re-read at epoch 341,619 (17 September 2026): unchanged at 3,757,840 XRD, 1% fee, 0% uptime, rank 84 of 187; its website field now names goxrd.com, a stopped-site placeholder. dexian.io still NXDOMAIN. Removed the Security section, which asserted third-party audits, public code and multi-factor authentication without a source for any of it. Em dashes converted.',
  },
  {
    slug: 'world-cup-badge-arena',
    version: '1.1.2',
    change: 'patch',
    sentinel: 'Re-read on 17 September 2026',
    swaps: [
      ['<td>19 July 2026</td>', '<td>19 July 2026 (re-read 17 September 2026)</td>'],
      ['As of 7 August 2026 the site still describes final artwork and ranking as arriving "in v2 after results are complete", and no transaction has touched the component in the nineteen days since the final.',
       'Re-read on 17 September 2026, the site still says final card artwork and ranking "arrive in v2 after results are complete", and the component\'s most recent committed transaction is still the mint of card #1009 on 19 July, two months earlier.'],
    ],
    message: 'Re-read 17 September 2026: the component\'s last committed transaction is still card #1009 on 19 July, and the site still promises the reveal in v2. Dated sentence and infobox row updated.',
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
  if (hits !== 1) throw new Error(`expected 1 match, got ${hits}: ${from.slice(0, 60)}`);
  return out;
}

const undash = (list) => list.map((b) => ({
  ...b,
  ...(typeof b.text === 'string' ? { text: b.text.replaceAll(` ${EMDASH} `, ' – ').replaceAll(EMDASH, ' – ') } : {}),
  ...(Array.isArray(b.blocks) ? { blocks: undash(b.blocks) } : {}),
}));

await withClient(async (client) => {
  for (const e of EDITS) {
    if (isLockedPage(TAG, e.slug)) throw new Error(`${e.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG, e.slug]);
    if (!rows.length) throw new Error(`${e.slug} not found`);
    const page = rows[0];
    if (JSON.stringify(page.content).includes(e.sentinel)) {
      console.log(`  ${e.slug}: already applied - no write`);
      continue;
    }
    let blocks = JSON.parse(JSON.stringify(page.content));
    for (const s of e.swaps) blocks = swapOnce(blocks, s);
    if (e.dashes) blocks = undash(blocks);
    if (e.cut) {
      const hits = blocks.filter((b) => b.text?.includes(e.cut));
      if (hits.length !== 1) throw new Error(`${e.slug}: expected 1 block containing cut marker, got ${hits.length}`);
      hits[0].text = hits[0].text.slice(0, hits[0].text.indexOf(e.cut));
    }
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
