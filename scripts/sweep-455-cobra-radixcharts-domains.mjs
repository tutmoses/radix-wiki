// sweep 455 – ecosystem rotation. Two domains the link audit caught going dark since the last pass.
//
// radixcharts: radixcharts.com stopped resolving on 19 September 2026. Verisign RDAP, read 11:08 UTC:
//   status client hold (plus delete/transfer/update prohibited), expiration moved to 18 September 2027,
//   last changed 08:24:56 UTC 19 September; nameservers still Hetzner. clientHold keeps a domain out of
//   the zone, so the closure notice the page quoted is no longer served. The notice is cited from the
//   Wayback capture of 6 June 2026 (title "RadixCharts - Service Closed").
// cobra-stakes: re-read at epoch 342,195 (19 September 2026, 11:07 UTC). Stake 92,918,353.30 ->
//   84,554,792.53 XRD since 16 August, rank 17 of 187 -> 21 of 186; fee 15% charged, stored 0.01;
//   7-day uptime 100%; info_url still https://www.cobrastakes.com. Verisign RDAP: expiration
//   6 August 2026, status redemption period, last changed 13:07:15 UTC 18 September, nameservers
//   dns-expired.com. The Leaf Node contrast is updated: it unregistered on 10 August and
//   re-registered on 16 August.
//
//   node scripts/sweep-455-cobra-radixcharts-domains.mjs --dry-run

import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, withClient } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG = 'ecosystem';
const ext = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const int = (href, text) => `<a href="${href}" rel="noopener">${text}</a>`;
const EMDASH = String.fromCharCode(0x2014);
const NBSP = String.fromCharCode(0xa0);
const GATEWAY = int('/contents/tech/core-protocols/radix-gateway-api', 'Radix Gateway');
const RDAP = (d) => `https://rdap.verisign.com/com/v1/domain/${d}`;

const RC_OLD = '<a href="https://radixcharts.com/" target="_blank" rel="noopener">radixcharts.com</a> serves a single notice saying its "data analytics service for RadixDLT is no longer available", with one link, to the <a href="https://www.radixdlt.com/ecosystem-directory" target="_blank" rel="noopener">Radix ecosystem directory</a>. The documentation site, docs.radixcharts.com, no longer resolves, so the feature descriptions below cite archived copies.';
const RC_NEW = `Until September 2026 radixcharts.com served a single notice (${ext('https://web.archive.org/web/20260606071924/https://www.radixcharts.com/', 'archived 6 June 2026')}) saying its "data analytics service for RadixDLT is no longer available", with one link, to the ${ext('https://www.radixdlt.com/ecosystem-directory', 'Radix ecosystem directory')}. On 19 September the domain went dark as well. Its ${ext(RDAP('radixcharts.com'), 'registry record')}, read that morning, had been renewed to 18 September 2027 and set to ${ext('https://icann.org/epp#clientHold', '<code>clientHold</code>')} at 08:24 UTC, a status that takes a domain out of the DNS, and neither radixcharts.com nor www.radixcharts.com returns an address. The documentation site, docs.radixcharts.com, stopped resolving earlier, so the feature descriptions below cite archived copies.`;

const COBRA_VALIDATOR_OLD_START = '<h2>Validator</h2><p>Read live from the';
const COBRA_VALIDATOR_OLD_END = 'on 17 July 2026.</p>';
const COBRA_VALIDATOR_NEW = `<h2>Validator</h2><p>Read live from the ${GATEWAY} at mainnet <strong>epoch 342,195</strong> (19 September 2026, 11:07&nbsp;UTC), Cobra Stakes is <strong>registered</strong>, accepts delegated stake, and holds <strong>84,554,792.53&nbsp;XRD</strong> &ndash; <strong>rank 21 of the 186 registered validators</strong>. That is 8.36 million XRD less than the 92,918,353.30&nbsp;XRD it held at epoch 335,407 on 16 August, when it ranked 17th of 187. Its uptime over the preceding week was 100%.</p>`;

const COBRA_SITE_OLD_START = '<h2>The website</h2>';
const COBRA_SITE_OLD_END = 'Here the ledger record is unbroken.</p>';
const COBRA_SITE_NEW = `<h2>The website</h2>`
  + `<p>Cobra Stakes has no working site, and its domain is on its way out of the owner's hands. On 16 August 2026 both <code>cobrastakes.com</code> and <code>www.cobrastakes.com</code> returned a registrar page titled &ldquo;Your domain is expired&rdquo;, a step down from the &ldquo;Coming soon&rdquo; placeholder this page recorded in July. By 19 September neither name resolved at all. The domain's ${ext(RDAP('cobrastakes.com'), 'registry record')} shows a registration that expired on 6 August 2026 and, since 13:07 UTC on 18 September, the status ${ext('https://icann.org/epp#redemptionPeriod', '<code>redemptionPeriod</code>')}: the registrar has deleted it, the owner has a last window to restore it, and a .com left unrestored is released for anyone to register once that window and a further pending-delete period have run.</p>`
  + `<p>The validator's on-ledger <code>info_url</code> metadata still points at <code>https://www.cobrastakes.com</code>, so a wallet or explorer following that link now reaches nothing, and would reach whoever registers the name next if it is released. Only the holder of the validator's owner badge can change that field.</p>`
  + `<p>That is a presentation failure rather than an operational one, and the distinction matters: an expired domain says nothing about whether a node is proposing. ${int('/ecosystem/leafnode', 'Leaf Node')} is the contrasting case, where the website going dark came with an on-ledger <code>unregister</code> on 10 August 2026, reversed six days later. Here the ledger record is unbroken.</p>`;

const EDITS = [
  {
    slug: 'radixcharts',
    version: '4.1.1',
    change: 'patch',
    sentinel: 'web/20260606071924',
    swaps: [[RC_OLD, RC_NEW]],
    message: 'radixcharts.com stopped resolving on 19 September 2026: Verisign RDAP shows clientHold set at 08:24 UTC that day (expiration moved to 18 September 2027). The closure notice the Status section quoted is now cited from the Wayback capture of 6 June 2026.',
  },
  {
    slug: 'cobra-stakes',
    version: '2.3.0',
    sentinel: 'epoch 342,195',
    swaps: [
      ['92,918,353.30 XRD &ndash; rank 17 of 187 registered validators', '84,554,792.53 XRD &ndash; rank 21 of 186 registered validators'],
      ['<td><strong>Uptime (30d)</strong></td><td>100%, as measured on the Radix Dashboard at epoch 326958 (17 July 2026)</td>',
        '<td><strong>Uptime (7d)</strong></td><td>100%, read at epoch 342,195 (19 September 2026)</td>'],
      ['<a href="https://cobrastakes.com" target="_blank" rel="noopener">cobrastakes.com</a> &ndash; domain expired (16 August 2026)',
        '<code>cobrastakes.com</code> &ndash; lapsed, in the registry redemption period since 18 September 2026'],
      ['at mainnet epoch 335,407 (16 August 2026, 07:09&nbsp;UTC)</td>', 'at mainnet epoch 342,195 (19 September 2026, 11:07&nbsp;UTC)</td>'],
      ['its branded domain, <a href="https://cobrastakes.com" target="_blank" rel="noopener">cobrastakes.com</a>, has expired, while the node itself keeps proposing.',
        'its branded domain, cobrastakes.com, has lapsed and no longer resolves, while the node itself keeps proposing.'],
    ],
    spans: [
      [COBRA_VALIDATOR_OLD_START, COBRA_VALIDATOR_OLD_END, COBRA_VALIDATOR_NEW],
      [COBRA_SITE_OLD_START, COBRA_SITE_OLD_END, COBRA_SITE_NEW],
    ],
    message: 'Re-read 19 September 2026 at epoch 342,195: stake 92,918,353.30 -> 84,554,792.53 XRD since 16 August, rank 17 of 187 -> 21 of 186, 7-day uptime 100%, fee 15% charged against a stored 0.01. cobrastakes.com no longer resolves: Verisign RDAP shows the registration expired 6 August and entered the redemption period at 13:07 UTC on 18 September, while the validator info_url still points at it. Website link removed; the Leaf Node contrast now records its 16 August re-registration.',
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

// Replace the span from `start` through the first `end` after it, inside the one block holding both.
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

const added = [RC_NEW, COBRA_VALIDATOR_NEW, COBRA_SITE_NEW, ...EDITS.flatMap((e) => e.swaps.map(([, to]) => to))].join('');
if (added.includes(NBSP) || added.includes(EMDASH)) throw new Error('U+00A0 or an em dash in new text');

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
      [cuid(), page.id, json, page.title, e.version, e.change ?? 'minor', AUTHOR_ID, e.message, now]);
    await client.query('COMMIT');
    console.log('    written and stamped');
  }
});
