// sweep 440 – policy rotation.
//
// /policy/freshness carries two dated figures about the wiki itself: the
// verification census, and the oldest reading on the wiki. Both were read on
// 10 September. Re-read on 16 September the census has moved (308 of 377
// stamped, 69 never verified) and the queue behind the oldest reading resolved
// into something the page did not say: the two oldest readings on the wiki are
// exactly the two pages it locks against script edits, and the third is 50 days
// behind them. So both of the first two "May be outdated" notices this wiki
// ever shows will sit on pages the sweep cannot clear.
//
//   node scripts/sweep-440-freshness-locked-head.mjs --dry-run

import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage, withClient } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'policy';
const SLUG = 'freshness';
const SENTINEL = 'So will the second.';

const OLD_CENSUS =
  'Read on 10 September 2026, 293 of the wiki&rsquo;s 373 pages carry a verification stamp and 80 have never been verified, against 281 of 381 on 2 September; the total fell because the Community section was retired on 9 September, taking twelve profiles and its section hub off the wiki.';
const NEW_CENSUS =
  'Read on 16 September 2026, 308 of the wiki&rsquo;s 377 pages carry a verification stamp and 69 have never been verified, against 293 of 373 on 10 September and 281 of 381 on 2 September.';

const OLD_HEAD =
  'No page currently meets the threshold, and one page is close to it. The oldest reading on the wiki is <a href="/ecosystem/xrd-domains" class="link">XRD Domains</a>, never verified and last edited on 28 March 2026, 166 days ago as of this reading, which crosses 180 days on 24 September 2026.';
const NEW_HEAD =
  'No page currently meets the threshold. The oldest reading on the wiki is <a href="/ecosystem/xrd-domains" class="link">XRD Domains</a>, never verified and last edited on 28 March 2026, 171 days ago as of this reading, which crosses 180 days on 24 September 2026.';

const OLD_TAIL =
  'The first <em>May be outdated</em> notice this wiki displays will therefore appear on a page the process cannot currently clear.';
const NEW_TAIL =
  'The first <em>May be outdated</em> notice this wiki displays will therefore appear on a page the process cannot currently clear.</p>'
  + '<p>So will the second. The next-oldest reading is <a href="/ecosystem/radix-namespace" class="link">Radix Namespace</a>, also never verified, last edited on 29 June 2026, 79 days ago, and crossing 180 days on 26 December 2026 &ndash; and it is the other locked page. Behind those two the queue drops away. The third-oldest reading is 50 days, on <a href="/developers/scrypto/01-fundamentals" class="link">Scrypto fundamentals</a>, verified on 27 July 2026 and crossing the threshold on 23 January 2027. Both of the pages that will show the notice are pages the sweep cannot edit, and no page it can edit is within four months of showing one.';

await withClient(async (client) => {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (blocks.some((b) => b.text?.includes(SENTINEL))) {
    console.log('  already applied – no write');
    return;
  }

  const i = blocks.findIndex((b) => b.text?.includes(OLD_CENSUS));
  if (i < 0) throw new Error('census sentence not found – inspect the stored HTML before rewriting');
  let text = blocks[i].text;
  for (const [was, now] of [[OLD_CENSUS, NEW_CENSUS], [OLD_HEAD, NEW_HEAD], [OLD_TAIL, NEW_TAIL]]) {
    if (!text.includes(was)) throw new Error(`replacement target not found: ${was.slice(0, 60)}…`);
    text = text.replace(was, now);
  }
  blocks[i] = { ...blocks[i], text };

  const version = '1.6.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  block ${i}  ${blocks[i].text.length - page.content[i].text.length} chars`);
  if (DRY) { console.log('\n' + NEW_TAIL.split('</p><p>')[1]); return; }

  const now = new Date().toISOString();
  const json = JSON.stringify(blocks);
  await client.query('BEGIN');
  await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
    [json, version, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
     'Re-measured the verification census on 16 September 2026 (308 of 377 stamped, 69 never verified, against 293 of 373 on 10 September) and named the rest of the staleness queue. The two oldest readings on the wiki are the two pages it locks against script edits: XRD Domains at 171 days, crossing the threshold on 24 September, and Radix Namespace at 79 days, crossing on 26 December. The third-oldest is 50 days and crosses in January 2027, so both of the first two outdated notices will sit on pages the sweep cannot clear and no page it can reach is close to one.',
     now]);
  await client.query('COMMIT');
  console.log('  written and stamped');
});
