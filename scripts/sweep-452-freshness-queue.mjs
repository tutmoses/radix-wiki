// sweep 452 – policy rotation.
//
// /policy/freshness names the three oldest readings on the wiki. Re-read on
// 18 September the census is unchanged from 16 September (308 of 377 stamped,
// 69 never verified), but the third name is wrong: Scrypto fundamentals was
// re-verified on 16 September, so the third-oldest reading is now System Layer,
// verified 2 August 2026, 47 days, reaching 180 days on 29 January 2027. The
// two locked pages still head the queue, XRD Domains at 173 days and Radix
// Namespace at 81.
//
//   node scripts/sweep-452-freshness-queue.mjs --dry-run

import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, withClient } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'policy';
const SLUG = 'freshness';
const SENTINEL = 'System Layer</a>, verified on 2 August 2026';

const EDITS = [
  ['Read on 16 September 2026, 308 of the wiki&rsquo;s 377 pages carry a verification stamp and 69 have never been verified, against 293 of 373 on 10 September',
   'Read on 18 September 2026, 308 of the wiki&rsquo;s 377 pages carry a verification stamp and 69 have never been verified, the same as on 16 September, against 293 of 373 on 10 September'],
  ['last edited on 28 March 2026, 171 days ago as of this reading',
   'last edited on 28 March 2026, 173 days ago as of this reading'],
  ['last edited on 29 June 2026, 79 days ago',
   'last edited on 29 June 2026, 81 days ago'],
  ['The third-oldest reading is 50 days, on <a href="/developers/scrypto/01-fundamentals" class="link">Scrypto fundamentals</a>, verified on 27 July 2026 and crossing the threshold on 23 January 2027.',
   'The third-oldest reading is 47 days, on <a href="/contents/tech/core-protocols/system-layer" class="link">System Layer</a>, verified on 2 August 2026 and crossing the threshold on 29 January 2027.'],
];

await withClient(async (client) => {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);

  // Re-measure rather than trust the constants above.
  const { rows: [census] } = await client.query(
    'SELECT count(*)::int total, count(last_verified_at)::int stamped FROM pages');
  if (census.total !== 377 || census.stamped !== 308)
    throw new Error(`census moved (${census.stamped} of ${census.total}) - rewrite the sentence, do not run this script`);
  const { rows: queue } = await client.query(
    'SELECT tag_path, slug FROM pages ORDER BY coalesce(last_verified_at, updated_at) LIMIT 3');
  if (queue.map((r) => r.slug).join() !== 'xrd-domains,radix-namespace,system-layer')
    throw new Error(`queue moved: ${queue.map((r) => r.slug).join()}`);

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (blocks.some((b) => b.text?.includes(SENTINEL))) {
    console.log('  already applied – no write');
    return;
  }

  const i = blocks.findIndex((b) => b.text?.includes(EDITS[0][0]));
  if (i < 0) throw new Error('census sentence not found – inspect the stored HTML before rewriting');
  let text = blocks[i].text;
  for (const [was, now] of EDITS) {
    if (!text.includes(was)) throw new Error(`replacement target not found: ${was.slice(0, 60)}…`);
    text = text.replace(was, now);
  }
  blocks[i] = { ...blocks[i], text };

  const version = '1.6.1';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  block ${i}  ${text.length - page.content[i].text.length} chars`);
  if (DRY) return;

  const now = new Date().toISOString();
  const json = JSON.stringify(blocks);
  await client.query('BEGIN');
  await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
    [json, version, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, version, 'patch', AUTHOR_ID,
     'Re-read the staleness queue on 18 September 2026. The census is unchanged from 16 September (308 of 377 stamped, 69 never verified). Scrypto fundamentals was re-verified on 16 September, so the third-oldest reading is now System Layer, verified 2 August 2026, 47 days, reaching 180 days on 29 January 2027. Ages of the two locked pages updated: XRD Domains 173 days, Radix Namespace 81.',
     now]);
  await client.query('COMMIT');
  console.log('  written and stamped');
});
