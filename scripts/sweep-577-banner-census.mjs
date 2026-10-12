// Sweep 577 (policy rotation): sweep 544 removed the advertisement notice from Blue Chick NFTs on
// 6 October, and four policy pages still counted it. Re-read 11:10 UTC 12 October 2026 from the pages
// table: two editor-placed banners on 381 pages (promotional, on UniSci and UniX, both Notion imports,
// Dormant and Closed); 4,115 revisions on 381 pages from eleven accounts (Bayesian's one Foohack save on
// 7 Oct has no message); 2,518 of 2,522 revisions in 90 days from the maintenance account (99.8%);
// 153 Ecosystem articles, import still 111; comments still four, last April 2026.
import { isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');
const SENTINEL = '12 October 2026';

const EDITS = [
  {
    slug: 'conflict-of-interest',
    replace: [
      ['Of the 152 pages under', 'Of the 153 pages under'],
      ['All four counts below were re-measured on 28 September 2026.', 'All four counts below were re-measured on 12 October 2026.'],
      ['Across 3,890 revisions on 380 pages, written by the ten accounts that have ever saved one,',
        'Across 4,115 revisions on 381 pages, written by the eleven accounts that have ever saved one,'],
      ['Three notice banners exist on the entire wiki, all of them <em>Written like an advertisement</em> and all on imported ecosystem pages.',
        'Two notice banners exist on the entire wiki, both <em>Written like an advertisement</em> and both on imported ecosystem pages. A third came off <a href="/ecosystem/blue-chick-nfts" class="link">Blue Chick NFTs</a> on 6 October 2026, when the sweep replaced that page&rsquo;s pasted promotional post with a sourced record.'],
      ['Of the 2,563 revisions saved in the last 90 days, 2,548 come from the maintenance account – 99.4 per cent,',
        'Of the 2,522 revisions saved in the last 90 days, 2,518 come from the maintenance account – 99.8 per cent,'],
    ],
    message: 'Re-measured the four counts in "How this has worked here" on 12 October 2026: Ecosystem 153 articles (import still 111); 4,115 revisions on 381 pages from eleven accounts, none disclosing; two banners, not three, because sweep 544 removed the advertisement notice from Blue Chick NFTs on 6 October; 2,518 of 2,522 revisions in 90 days (99.8%) from the maintenance account. wiki-sweep run 577.',
  },
  {
    slug: 'verifiability',
    replace: [
      ['<td>The prose is promotional &ndash; see <a href="/policy/neutral-point-of-view" class="link">neutral point of view</a>.</td><td>3</td>',
        '<td>The prose is promotional &ndash; see <a href="/policy/neutral-point-of-view" class="link">neutral point of view</a>.</td><td>2</td>'],
      ['One query over the <code>pages</code> table on 28 September 2026 found <strong>three</strong> editor-placed banners across <strong>380</strong> pages, all of them the <em>Written like an advertisement</em> notice on ecosystem pages. From 19 August to 20 September the same query returned five: those three, and the <em>Stub</em> notice on',
        'One query over the <code>pages</code> table on 12 October 2026 found <strong>two</strong> editor-placed banners across <strong>381</strong> pages, both the <em>Written like an advertisement</em> notice on ecosystem pages. From 21 September to 5 October the same query returned three, the third being the advertisement notice on <a href="/ecosystem/blue-chick-nfts" class="link">Blue Chick NFTs</a>, which came off on 6 October when the sweep rewrote that page from sources and said so in the revision message. From 19 August to 20 September it returned five: those three, and the <em>Stub</em> notice on'],
      ['Of 2,563 revisions written in the ninety days to 28 September 2026, 2,548 &ndash; 99.4% &ndash; came from',
        'Of 2,522 revisions written in the ninety days to 12 October 2026, 2,518 &ndash; 99.8% &ndash; came from'],
    ],
    message: 'Banner census re-read on 12 October 2026: two editor-placed banners across 381 pages, not three, because sweep 544 removed the advertisement notice from Blue Chick NFTs on 6 October after rewriting the page from sources. In use table, "Banners in practice" count and the 90-day revision share (2,518 of 2,522, 99.8%) updated. wiki-sweep run 577.',
  },
  {
    slug: 'editorial-notices',
    replace: [
      ['Read again on 5 October 2026, the whole wiki carries <strong>three</strong> of them across 379 pages, all the advertisement notice: on <a href="/ecosystem/blue-chick-nfts" class="link">Blue Chick NFTs</a>, <a href="/ecosystem/unisci" class="link">UniSci</a> and <a href="/ecosystem/unix" class="link">UniX</a>. From at least 19 August it carried five,',
        'Read again on 12 October 2026, the whole wiki carries <strong>two</strong> of them across 381 pages, both the advertisement notice: on <a href="/ecosystem/unisci" class="link">UniSci</a> and <a href="/ecosystem/unix" class="link">UniX</a>. A third stood on <a href="/ecosystem/blue-chick-nfts" class="link">Blue Chick NFTs</a> until 6 October 2026, when the sweep replaced the pasted first-person post it flagged with a sourced record and removed the notice in the same edit. From at least 19 August it carried five,'],
      ['All three advertisement notices sit on projects the', 'Both remaining advertisement notices sit on projects the'],
    ],
    message: 'Notice count re-read 12 Oct 2026: two advertisement notices on 381 pages (UniSci, UniX); the third came off Blue Chick NFTs on 6 Oct in sweep 544, which rewrote the page from its Medium posts and a 2023 Wayback capture. wiki-sweep run 577.',
  },
  {
    slug: 'freshness',
    replace: [
      ['the six an editor can place by hand sit on five pages in total,', 'the six an editor can place by hand sit on two pages in total on 12 October 2026,'],
    ],
    message: 'Hand-placed notice count corrected: two pages on 12 October 2026, not five (the two Stub notices came off on 21 Sep, the Blue Chick NFTs advertisement notice on 6 Oct). wiki-sweep run 577.',
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
