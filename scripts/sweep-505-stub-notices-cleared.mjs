/**
 * sweep 505 - policy rotation: the banner census on three policy pages, and a
 * tense fix on No Original Research.
 *
 * On 21 September 2026 the sweep expanded /contents/tech/core-protocols/kernel-layer
 * and /application-layer (both v2.0.0) and removed their Stub notices, saying so
 * in both revision messages. Three policy pages still counted those two notices:
 * Conflict of interest ("Five notice banners"), Verifiability (the In use table
 * and "Banners in practice") and Editorial notices ("carries five of them").
 *
 * Re-measured 28 September 2026, 23:1x UTC, against the database:
 *   banner blocks anywhere in any page's content (jsonb_path $.** type=banner): 3,
 *     all variant 'promotional', on ecosystem/blue-chick-nfts (Dormant),
 *     unisci (Dormant), unix (Closed)
 *   pages 380; ecosystem articles 152 (111 still from the 6 Feb Notion import)
 *   revisions 3,890 on 380 pages from 10 authors; none of the 15 non-maintenance
 *     revisions in 90 days discloses a relationship
 *   last 90 days: 2,563 revisions, 2,548 by the maintenance account (99.4%)
 *   comments: 4, newest 5 April 2026
 *   /ideas: 28 cards (No Original Research said the board "carries 29")
 *
 * Idempotent: each page is skipped if its sentinel is already stored.
 */
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, assertLinkShapes, withClient } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const KERNEL = '<a href="/contents/tech/core-protocols/kernel-layer" class="link">';
const APP = '<a href="/contents/tech/core-protocols/application-layer" class="link">';

const PAGES = [
  {
    tagPath: 'policy',
    slug: 'conflict-of-interest',
    version: '1.5.0',
    sentinel: 'Across 3,890 revisions',
    edits: [
      ['Of the 151 pages under', 'Of the 152 pages under'],
      [
        'All four counts below were re-measured on 12 September 2026; two of them have moved and two have not.',
        'All four counts below were re-measured on 28 September 2026.',
      ],
      ['Across 3,553 revisions on 376 pages,', 'Across 3,890 revisions on 380 pages,'],
      [
        'Five notice banners exist on the entire wiki. Three are <em>Written like an advertisement</em> and all three sit on imported ecosystem pages; the other two are <em>Stub</em>.',
        `Three notice banners exist on the entire wiki, all of them <em>Written like an advertisement</em> and all on imported ecosystem pages. Two <em>Stub</em> notices stood on ${KERNEL}Kernel layer</a> and ${APP}Application layer</a> until 21 September 2026, when the maintenance sweep expanded both pages and removed them in the same edits.`,
      ],
      [
        'Of the 2,340 revisions saved in the last 90 days, 2,319 come from the maintenance account',
        'Of the 2,563 revisions saved in the last 90 days, 2,548 come from the maintenance account',
      ],
      ['99.1 per cent, a share', '99.4 per cent, a share'],
    ],
    message:
      'Re-measured the four counts in "How this has worked here" on 28 September 2026: Ecosystem 152 articles (import still 111); ' +
      '3,890 revisions on 380 pages from ten accounts, none disclosing; three banners, not five, because the two Stub notices came off ' +
      'Kernel layer and Application layer when the sweep expanded them on 21 September; 2,548 of 2,563 revisions in 90 days (99.4%) from ' +
      'the maintenance account. wiki-sweep run 505.',
  },
  {
    tagPath: 'policy',
    slug: 'verifiability',
    version: '1.11.0',
    sentinel: 'on 28 September 2026 found <strong>three</strong>',
    edits: [
      ['needs expanding.</td><td>2</td>', 'needs expanding.</td><td>0</td>'],
      [
        `One query over the <code>pages</code> table on 12 September 2026 found <strong>five</strong> editor-placed banners across <strong>376</strong> pages, the same five the query returned on 19 August: the <em>Stub</em> notice on ${APP}application layer</a> and ${KERNEL}kernel layer</a>, and the <em>Written like an advertisement</em> notice on three ecosystem pages.`,
        `One query over the <code>pages</code> table on 28 September 2026 found <strong>three</strong> editor-placed banners across <strong>380</strong> pages, all of them the <em>Written like an advertisement</em> notice on ecosystem pages. From 19 August to 20 September the same query returned five: those three, and the <em>Stub</em> notice on ${APP}application layer</a> and ${KERNEL}kernel layer</a>.`,
      ],
      [
        'The notices did not move. Everything around them was filled in until they were accurate.',
        'Until then the notices had not moved, and everything around them had been filled in until they were accurate. On 21 September the maintenance sweep expanded both pages, the kernel layer by four sections and the application layer by three, and removed both notices in the same edits, naming the removal in each revision message.',
      ],
      [
        'Of 2,338 revisions written in the ninety days to 12 September 2026, 2,317 &ndash; 99.1% &ndash; came from',
        'Of 2,563 revisions written in the ninety days to 28 September 2026, 2,548 &ndash; 99.4% &ndash; came from',
      ],
    ],
    message:
      'Banner census re-read on 28 September 2026: three editor-placed banners across 380 pages, not five. The two Stub notices on ' +
      'Kernel layer and Application layer came off on 21 September in the edits that expanded both pages; the In use table, the ' +
      '"Banners in practice" count and the 90-day revision share (2,548 of 2,563, 99.4%) updated. The Leaf Node reading was ' +
      're-checked at epoch 344,931 (47th, 23.60m) and left as dated. wiki-sweep run 505.',
  },
  {
    tagPath: 'policy',
    slug: 'editorial-notices',
    version: '1.4.0',
    sentinel: 'Read again on 28 September 2026',
    edits: [
      [
        `Read again on 20 September 2026, the whole wiki carries <strong>five</strong> of them across 378 pages &ndash; the same five, on the same five pages, sixteen days later: the advertisement notice on <a href="/ecosystem/blue-chick-nfts" class="link">Blue Chick NFTs</a>, <a href="/ecosystem/unisci" class="link">UniSci</a> and <a href="/ecosystem/unix" class="link">UniX</a>, and the stub notice on ${KERNEL}Kernel layer</a> and ${APP}Application layer</a>.`,
        `Read again on 28 September 2026, the whole wiki carries <strong>three</strong> of them across 380 pages, all the advertisement notice: on <a href="/ecosystem/blue-chick-nfts" class="link">Blue Chick NFTs</a>, <a href="/ecosystem/unisci" class="link">UniSci</a> and <a href="/ecosystem/unix" class="link">UniX</a>. From at least 19 August it carried five, the other two being the stub notice on ${KERNEL}Kernel layer</a> and ${APP}Application layer</a>; on 21 September the edits that expanded both pages removed those notices and said so in their revision messages, as the procedure below asks.`,
      ],
    ],
    message:
      'Notice count re-read on 28 September 2026: three, all the advertisement notice, across 380 pages. The two stub notices on ' +
      'Kernel layer and Application layer were removed on 21 September by the edits that expanded both pages. wiki-sweep run 505.',
  },
  {
    tagPath: 'policy',
    slug: 'no-original-research',
    version: '2.1.2',
    sentinel: 'In August 2026 the <a href="/ideas" class="link">Ideas pipeline</a> carried 29 cards',
    edits: [
      [
        'The <a href="/ideas" class="link">Ideas pipeline</a> carries 29 cards tracking the Radix DAO transition, and 19 of them named',
        'In August 2026 the <a href="/ideas" class="link">Ideas pipeline</a> carried 29 cards tracking the Radix DAO transition, and 19 of them named',
      ],
    ],
    message:
      'Dated the Ideas-board figure in the fourth worked case: the board carried 29 cards when the case arose in August 2026 and ' +
      'holds 28 on 28 September. Other three cases re-checked against their pages and unchanged. wiki-sweep run 505.',
  },
];

const replaceOnce = (haystack, needle, replacement) => {
  const i = haystack.indexOf(needle);
  if (i < 0) throw new Error(`string not found: ${JSON.stringify(needle.slice(0, 70))}`);
  if (haystack.indexOf(needle, i + 1) >= 0) throw new Error(`string is not unique: ${JSON.stringify(needle.slice(0, 70))}`);
  return haystack.slice(0, i) + replacement + haystack.slice(i + needle.length);
};

const walk = (blocks) => blocks.flatMap((b) => [b, ...(b.blocks ? walk(b.blocks) : [])]);

await withClient(async (client) => {
  for (const p of PAGES) {
    if (isLockedPage(p.tagPath, p.slug)) throw new Error(`${p.tagPath}/${p.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
      [p.tagPath, p.slug],
    );
    if (!rows.length) throw new Error(`${p.slug} not found`);
    const page = rows[0];
    if (JSON.stringify(page.content).includes(p.sentinel)) {
      console.log(`  ${p.slug}: already applied - no write`);
      continue;
    }
    const blocks = JSON.parse(JSON.stringify(page.content));
    const all = walk(blocks);
    for (const [from, to] of p.edits) {
      const hits = all.filter((b) => (b.text || '').includes(from));
      if (hits.length !== 1) throw new Error(`${p.slug}: ${hits.length} blocks hold ${JSON.stringify(from.slice(0, 60))}`);
      hits[0].text = replaceOnce(hits[0].text, from, to);
    }
    assertLinkShapes(blocks, page.title);
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${p.version}  (${p.edits.length} edits)`);
    if (DRY) continue;
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query(
      'UPDATE pages SET content = $1, version = $2, updated_at = $3, last_verified_at = $3 WHERE id = $4',
      [json, p.version, now, page.id],
    );
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, p.version, p.version.endsWith('.0') ? 'minor' : 'patch', AUTHOR_ID, p.message, now],
    );
    await client.query('COMMIT');
  }
});
