// Sweep 565 (policy rotation): the census on /policy/freshness and /policy/editorial-notices was read on
// 5 October. Re-read at 11:20 UTC on 10 October 2026: 341 of 379 pages carry a verification stamp (340
// of the 378 under a category); the /maintenance queues read Outdated 1 (XRD Domains, 195 days),
// Orphaned 41 (34 Ecosystem), Unsourced 14 (same composition: 7 reference-list pages, 4 hubs, 2
// generated, XRD Domains), Missing metadata 3. Radix Namespace 103 days; Access Controller still third.
import { isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');
const SENTINEL = '10 October 2026';

const EDITS = [
  {
    slug: 'freshness',
    replace: [
      ['Read at 23:04 UTC on 5 October 2026, 332 of the wiki&rsquo;s 379 pages carry a verification stamp and 47 have never been verified, against 313 of 379 on 24 September,',
        'Read on 10 October 2026, 341 of the wiki&rsquo;s 379 pages carry a verification stamp and 38 have never been verified, against 332 of 379 on 5 October, 313 of 379 on 24 September,'],
      ['On 5 October it was 191 days old and a cache-busted load still rendered the notice.',
        'On 10 October it was 195 days old and still showed the notice.'],
      ['last edited on 29 June 2026, 98 days old on 5 October,',
        'last edited on 29 June 2026, 103 days old on 10 October,'],
    ],
    message: 'Verification census re-read 10 Oct 2026: 341 of 379 pages stamped, 38 never verified (332 of 379 on 5 Oct). XRD Domains 195 days and still showing the notice; Radix Namespace 103 days; Access Controller still third.',
  },
  {
    slug: 'editorial-notices',
    replace: [
      ['<strong>331 of the 378</strong> pages under a category carry an explicit verification stamp, read at 23:04 UTC on 5 October 2026, against 312 on 24 September,',
        '<strong>340 of the 378</strong> pages under a category carry an explicit verification stamp, read on 10 October 2026, against 331 on 5 October and 312 on 24 September,'],
      ['On 5 October it was 191 days old.</p>', 'On 10 October it was 195 days old.</p>'],
      ['at 191 days and', 'at 195 days and'],
      ['at 98 on 5 October', 'at 103 on 10 October'],
      ['<strong>54 pages</strong> on 5 October 2026, up from 11 on 20 September and 13 on 4 September. 44 of the 54 are Ecosystem projects, and the rise follows',
        '<strong>41 pages</strong> on 10 October 2026, down from 54 on 5 October, and up from 11 on 20 September and 13 on 4 September. 34 of the 41 are Ecosystem projects, and the rise follows'],
      ['<strong>14 pages</strong> on 5 October 2026, down from the 16 it held from 4 September.',
        '<strong>14 pages</strong> on 10 October 2026, the same as on 5 October and down from the 16 it held from 4 September.'],
      ['One page on 5 October 2026, <a href="/ecosystem/xrd-domains" class="link">XRD Domains</a> at 191 days.',
        'One page on 10 October 2026, <a href="/ecosystem/xrd-domains" class="link">XRD Domains</a> at 195 days.'],
    ],
    message: 'Census re-read 10 Oct 2026 from /maintenance and the pages table: 340 of 378 categorised pages stamped (331 on 5 Oct); Orphaned 41, down from 54, 34 of them Ecosystem; Unsourced 14 unchanged; Outdated 1, XRD Domains at 195 days; Radix Namespace 103 days.',
  },
];

await withClient(async (client) => {
  for (const e of EDITS) {
    if (isLockedPage('policy', e.slug)) throw new Error(`${e.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', ['policy', e.slug]);
    if (!rows.length) throw new Error(`${e.slug} not found`);
    const page = rows[0];
    const blocks = JSON.parse(JSON.stringify(page.content));
    if (JSON.stringify(blocks).includes(SENTINEL)) { console.log(`  ${page.title}: already applied – no write`); continue; }
    for (const [from, to] of e.replace) {
      const hits = blocks.filter((b) => b.text?.includes(from));
      if (hits.length !== 1) throw new Error(`${e.slug}: "${from.slice(0, 50)}" matched ${hits.length} blocks`);
      hits[0].text = hits[0].text.replace(from, to);
    }
    const version = await writeRevision(client, page, blocks, { change: 'patch', message: e.message, verified: true, dry: DRY });
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  }
});
