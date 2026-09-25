/**
 * sweep 484 - ecosystem rotation. CaviarNine's sunset page is live and its API
 * host is gone; ShardSpace's token values broke with it.
 *
 * /ecosystem/caviarnine (v5.4.3) last measured the site on 31 August, when the
 * promised sunset page had not appeared. Read 11:05 UTC 25 September 2026:
 *   - www.caviarnine.io answers 200, <title>CaviarNine: Sunset</title>, "CaviarNine
 *     DEX is being sunsetted", one "Remove your assets" card over LSU Pools,
 *     HyperStake, Orderbook, Shape Liquidity and Simple Pool. No trade UI.
 *   - api.caviarnine.com is NXDOMAIN (SOA ns1.digitalocean.com, caviarnine.com's
 *     own zone). Wayback holds 200 captures of its /v1.0/resource/image/ route
 *     from May 2025; the sunset page still references it for token icons.
 *   - LSULP (resource_rdx1thksg5...xfmf) total supply 203,955,253.57 at epoch
 *     343,923 (radixscan, live), against 235,758,772.06 on 31 Aug and
 *     267,774,125.70 on 19 Aug.
 * /ecosystem/shardspace: t.me/ShardSpace/5241 (18 Sep, token values stopped the
 * day before) and 5242 (19 Sep, "the caviar nine API has closed"). Closes the
 * run-479 VERIFY item as far as it can be verified from outside the dApp.
 *
 * Idempotent per page: skipped if its sentinel is already stored.
 */
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, assertLinkShapes, withClient } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');

const PAGES = [
  {
    slug: 'caviarnine',
    version: '5.5.0',
    changeType: 'minor',
    sentinel: 'The sunset page goes up (September 2026)',
    anchor: '<h3>Why, and the num',
    insertBefore: true,
    html:
      '<h3>The sunset page goes up (September 2026)</h3>\n' +
      '<p>By 25 September 2026 <a href="https://www.caviarnine.io" target="_blank" rel="noopener">caviarnine.io</a> had become the sunset page the operator described on 21 August. It is titled "CaviarNine: Sunset", tells traders the DEX is being wound down and asks them to withdraw their remaining liquidity in the coming months. Its one control is a Remove your assets card covering the LSU pools, HyperStake, the order book, Shape Liquidity and the simple pools. Swapping, limit orders and new positions are gone from the site; the components themselves remain on ledger, as the 21 August correction said they would.</p>\n' +
      '<p>The API host behind the old application has gone with it. <code>api.caviarnine.com</code>, which served token images to the CaviarNine front end (<a href="https://web.archive.org/web/20250514050251/https://api.caviarnine.com/v1.0/resource/image/resource_rdx1thksg5ng70g9mmy9ne7wz0sc7auzrrwy7fmgcxzel2gvp8pj0xxfmf" target="_blank" rel="noopener">Wayback, May 2025</a>) no longer resolves: caviarnine.com&#39;s own name servers answer that the name does not exist. <a href="/ecosystem/shardspace" rel="noopener">ShardSpace</a> users reported token values failing from 17 September, and put it down to the API closing.</p>\n' +
      '<p>The LSU pool keeps draining. LSULP&#39;s total supply read <strong>204m</strong> at epoch 343,923 on 25 September, on the <a href="https://www.radixscan.io/resource/resource_rdx1thksg5ng70g9mmy9ne7wz0sc7auzrrwy7fmgcxzel2gvp8pj0xxfmf" target="_blank" rel="noopener">resource&#39;s ledger record</a>: 32m units (13.5%) redeemed since 31 August, and 64m (24%) since the announcement.</p>\n',
    message:
      'Sunset page live: caviarnine.io serves "CaviarNine: Sunset" with remove-liquidity only (read 25 Sep 2026); api.caviarnine.com is NXDOMAIN; ' +
      'LSULP supply 203.96m at epoch 343,923 against 235.76m on 31 Aug and 267.77m on 19 Aug (radixscan). New subsection before "Why, and the numbers behind it".',
  },
  {
    slug: 'shardspace',
    version: '2.3.0',
    changeType: 'minor',
    sentinel: 'token values had stopped showing',
    anchor: '<h2>Roadmap as Published</h2>',
    insertBefore: true,
    html:
      '<p>On 18 September 2026 a user reported in the <a href="https://t.me/ShardSpace/5241" target="_blank" rel="noopener">ShardSpace Telegram group</a> that token values had stopped showing the day before, and <a href="https://t.me/ShardSpace/5242" target="_blank" rel="noopener">another member attributed it</a> to the CaviarNine API closing. That API host, <code>api.caviarnine.com</code>, no longer resolves as of 25 September, part of <a href="/ecosystem/caviarnine" rel="noopener">CaviarNine</a>&#39;s wind-down on Radix. The site, the dApp and the docs still answer, so the status stays 🟢 Active.</p>\n',
    message:
      'Status: token values reported failing from 17 Sep 2026 (t.me/ShardSpace/5241, 5242); api.caviarnine.com, the CaviarNine API host, is NXDOMAIN as of 25 Sep. ' +
      'Links the CaviarNine wind-down. Status unchanged.',
  },
];

await withClient(async (client) => {
  for (const P of PAGES) {
    if (isLockedPage('ecosystem', P.slug)) throw new Error(`ecosystem/${P.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', ['ecosystem', P.slug]);
    if (!rows.length) throw new Error(`${P.slug} not found`);
    const page = rows[0];
    if (JSON.stringify(page.content).includes(P.sentinel)) { console.log(`  ${P.slug}: already applied`); continue; }
    const blocks = JSON.parse(JSON.stringify(page.content));
    const hits = blocks.filter((b) => (b.text || '').includes(P.anchor));
    if (hits.length !== 1) throw new Error(`${P.slug}: anchor found in ${hits.length} blocks`);
    const b = hits[0];
    const i = b.text.indexOf(P.anchor);
    if (b.text.indexOf(P.anchor, i + 1) >= 0) throw new Error(`${P.slug}: anchor not unique`);
    b.text = b.text.slice(0, i) + P.html + b.text.slice(i);
    assertLinkShapes(blocks, page.title);
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${P.version}`);
    if (DRY) continue;
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query(
      'UPDATE pages SET content = $1, version = $2, updated_at = $3, last_verified_at = $3 WHERE id = $4',
      [json, P.version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, P.version, P.changeType, AUTHOR_ID, P.message, now]);
    await client.query('COMMIT');
  }
});
