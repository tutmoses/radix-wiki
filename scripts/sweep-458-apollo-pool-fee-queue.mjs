// sweep 458 – contents/history rotation. The fee queue's first landing, and one dead domain.
//
// validator-subsidy-sunset: the five pending increases the page listed at epoch 341,571 are now four.
//   Apollo Pool (validator_rdx1s0txh4cx4nd7eh5nsxyt7h7njja5galwj602x57e9r2dszv6h2aahj) went from 20%
//   to 100% at epoch 342,116, 04:29 UTC on 19 September 2026. Stake vault
//   internal_vault_rdx1tzc9d7uev8gzlr0vzeerjnu62fvh0ns23j0907rx7epvva5kw5kv9x read pinned:
//   11,323,359.28 XRD at 342,116 and 11,324,911.32 XRD at 342,339 (23:05 UTC), so nothing has left
//   in the first nineteen hours. Rank 68 of 186 registered. Stored validator_fee_factor still 0.2
//   against an effective_fee_factor of 1, the same split the page already documents for the others.
//   The change request is present at epoch 336,101 (18 August), the oldest epoch the Gateway serves
//   state for, so it stood at least 6,015 epochs, across the halt, before taking effect.
//   Its on-ledger info_url, https://www.ApolloPool.io, no longer belongs to the operator: Wayback
//   holds the node's own site from June 2021 to 16 April 2025 (last full capture 17 March 2025,
//   title "Apollo Pool | Validator Node | RadixDLT"), the .io registry record read 19 September 2026
//   gives a registration date of 23 August 2026 on Cloudflare nameservers, and apex and www both
//   answer HTTP 301 to an unrelated lottery site, which is not named here per VOICE.md.
//   Queue re-read across the whole register at epoch 342,339: four requests, no new ones since 17 Sep.
// radix-wiki-hackathon-1: the link audit's one genuine death in this category. The 2024 track-runner
//   credit linked https://radixcharts.com, which stopped resolving on 19 September 2026 (run 455,
//   Verisign RDAP clientHold). Repointed to this wiki's own /ecosystem/radixcharts, which records
//   the closure.
//
//   node scripts/sweep-458-apollo-pool-fee-queue.mjs --dry-run

import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, withClient } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG = 'contents/history';
const ext = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const int = (href, text) => `<a href="${href}" rel="noopener">${text}</a>`;
const EMDASH = String.fromCharCode(0x2014);
const NBSP = String.fromCharCode(0xa0);

const QUEUE_START = '<p>At epoch 341,571 the queue holds five increases:</p>';
const QUEUE_END = '<p>The dates assume the five-minute epochs the network has kept since the restart.</p>';

const QUEUE_NEW = [
  '<p>At epoch 341,571 the queue held five increases. The first of them has since taken effect.</p>',
  '<h2>Apollo Pool at 100% (19 September 2026)</h2>',
  `<p>Apollo Pool's rise from 20% to 100% took effect at <strong>epoch 342,116</strong>, 04:29 UTC on 19 September 2026. Its delegated stake was 11,323,359 XRD at that epoch and <strong>11,324,911 XRD</strong> at epoch 342,339 nineteen hours later, a rise of 1,552 XRD, so none of the 11.3 million XRD staked to the node has been withdrawn and none of it now earns its delegators anything. The node ranks 68th of the 186 registered validators. Its component still stores the old <code>0.2</code>, as every validator in this queue has; the register's <code>effective_fee_factor</code> is the field reporting the 100%.</p>`,
  `<p>The request was readable for a long time before it landed. It is already present at <strong>epoch 336,101</strong> (18 August 2026), the oldest epoch the ${int('/contents/tech/core-protocols/radix-gateway-api', 'Radix Gateway')} still serves state for, so it stood on the ledger for at least 6,015 epochs, across the ${int('/contents/history/hyperlane-asset-drain-2026', 'August halt')}, before it took effect.</p>`,
  `<p>Apollo Pool publishes <code>https://www.ApolloPool.io</code> as its <code>info_url</code> on ledger, and that domain is no longer the operator's. The Internet Archive holds the validator's own site from June 2021 to April 2025, ${ext('https://web.archive.org/web/20250317114202/https://www.apollopool.io/', 'last captured in full on 17 March 2025')} under the title "Apollo Pool | Validator Node | RadixDLT" and describing a node run by three operators, with its Olympia-era validator address printed on the page. The ${ext('https://rdap.identitydigital.services/rdap/domain/apollopool.io', 'registry record')}, read on 19 September 2026, gives a registration date of 23 August 2026 and Cloudflare nameservers, and both <code>apollopool.io</code> and <code>www.apollopool.io</code> answer HTTP 301 to an unrelated lottery site. Stake is delegated to the validator address rather than to the domain, so the node itself is unaffected, but a wallet or explorer following the on-ledger link now reaches that site instead. Only the holder of the validator's owner badge can change the field.</p>`,
  '<h2>What is still queued</h2>',
  '<p>Four requests remain, read across the register at epoch 342,339 (19 September 2026, 23:05 UTC):</p>',
  '<table><tbody>',
  `<tr><td><strong>${int('/ecosystem/avaunt-staking', 'Avaunt Staking')}</strong></td><td>2% to 25% at epoch 342,482, about 20 September, over 138.9 million XRD</td></tr>`,
  `<tr><td><strong>${int('/ecosystem/supreme-stake', 'Daffy (Supreme)')}</strong>, formerly Supreme Stake</td><td>5% to 20% at epoch 344,149, about 26 September, over 51.5 million XRD</td></tr>`,
  `<tr><td><strong>${int('/ecosystem/radixcharts', 'Radix Charts V2')}</strong></td><td>2.5% to 15% at epoch 345,107, about 29 September, over 23.7 million XRD</td></tr>`,
  '<tr><td><strong>DoItForDan</strong></td><td>5% to 15% at epoch 345,108, about 29 September, over 9.6 million XRD</td></tr>',
  '</tbody></table>',
  '<p>No further request has been signed since 17 September. The dates assume the five-minute epochs the network has kept since the restart.</p>',
].join('');

const RC_OLD = '<a target="_blank" rel="noopener noreferrer nofollow" class="link" href="https://radixcharts.com"><strong>RadixCharts</strong></a>';
const RC_NEW = '<a rel="noopener" class="link" href="/ecosystem/radixcharts"><strong>RadixCharts</strong></a>';

const EDITS = [
  {
    slug: 'validator-subsidy-sunset',
    version: '1.5.0',
    change: 'minor',
    sentinel: 'epoch 342,339',
    spans: [[QUEUE_START, QUEUE_END, QUEUE_NEW]],
    message: 'Apollo Pool went from 20% to 100% at epoch 342,116 (04:29 UTC, 19 September 2026), the first of the five queued increases to land. Pinned vault reads: 11,323,359 XRD at that epoch, 11,324,911 XRD at 342,339, so nothing has been withdrawn; rank 68 of 186; stored fee still 0.2 against an effective 1. The request was already on ledger at epoch 336,101 (18 August), the oldest state the Gateway serves. Its on-ledger info_url, apollopool.io, was re-registered on 23 August 2026 and now redirects off the ecosystem; the validator site is cited from the Wayback capture of 17 March 2025. Queue table re-read at epoch 342,339 and cut to the four that remain.',
  },
  {
    slug: 'radix-wiki-hackathon-1',
    version: '3.1.4',
    change: 'patch',
    sentinel: '/ecosystem/radixcharts',
    swaps: [[RC_OLD, RC_NEW]],
    message: 'radixcharts.com stopped resolving on 19 September 2026 (Verisign RDAP clientHold, 08:24 UTC). The track-runner credit now links this wiki’s own RadixCharts page, which records the closure.',
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

function swapSpan(blocks, [start, end, to]) {
  const text = (b) => (typeof b.text === 'string' ? b.text : '');
  const hit = blocks.filter((b) => text(b).includes(start) && text(b).indexOf(end, text(b).indexOf(start)) > 0);
  if (hit.length !== 1) throw new Error(`expected 1 span block, got ${hit.length}: ${start}`);
  return blocks.map((b) => {
    if (b !== hit[0]) return b;
    const i = b.text.indexOf(start);
    const j = b.text.indexOf(end, i) + end.length;
    return { ...b, text: b.text.slice(0, i) + to + b.text.slice(j) };
  });
}

const added = [QUEUE_NEW, RC_NEW].join('');
if (added.includes(NBSP) || added.includes(EMDASH)) throw new Error('U+00A0 or an em dash in new text');

await withClient(async (client) => {
  for (const e of EDITS) {
    if (isLockedPage(TAG, e.slug)) throw new Error(`${e.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG, e.slug]);
    if (!rows.length) throw new Error(`${e.slug} not found`);
    const page = rows[0];
    if (JSON.stringify(page.content).includes(e.sentinel)) {
      console.log(`  ${e.slug}: already applied, no write`);
      continue;
    }
    let blocks = JSON.parse(JSON.stringify(page.content));
    for (const s of e.swaps ?? []) blocks = swapOnce(blocks, s);
    for (const s of e.spans ?? []) blocks = swapSpan(blocks, s);
    const json = JSON.stringify(blocks);
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
      [cuid(), page.id, json, page.title, e.version, e.change, AUTHOR_ID, e.message, now]);
    await client.query('COMMIT');
    console.log('    written and stamped');
  }
});
