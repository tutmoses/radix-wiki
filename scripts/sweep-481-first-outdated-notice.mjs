/**
 * sweep 481 - policy rotation. The day the first outdated notice fires, read
 * off the code rather than off the calendar.
 *
 * The link audit of /policy (8 pages, 40 external, 0 embeds) returned two
 * flags, both banked and neither dead: defillama.com/protocol/surge-trade is a
 * Cloudflare 403 to a script, and leafnode.info is the standing Vercel
 * DEPLOYMENT_PAUSED 503 /policy/verifiability uses as its worked example.
 *
 * The slice is a date both policy pages get wrong by one. /policy/freshness
 * and /policy/editorial-notices both say XRD Domains raises the wiki's first
 * "May be outdated" notice on 24 September 2026. wiki-formant/freshness
 * computes whole days with Math.floor and calls a page stale when that number
 * is MORE than 180 (isStale: `age > maxAgeDays`). XRD Domains was last edited
 * at 15:56:48 UTC on 28 March 2026 and has never been verified, so it is 180
 * whole days old from 15:56:48 UTC on 24 September and 181 - stale - from
 * 15:56:48 UTC on 25 September. Read at 23:05 UTC on 24 September the page is
 * 180 days old and shows no notice. The same off-by-one moves Radix Namespace
 * (29 Jun 04:41 UTC) to 27 December and the 2 August group to 30 January 2027.
 *
 * Re-measured against the database at 23:05 UTC on 24 September:
 *   379 pages, 313 stamped, 66 never verified (378 under a category, 312
 *     stamped) - against 310 of 378 on 20 September
 *   oldest readings: xrd-domains 180 days, radix-namespace 87, then four pages
 *     verified on 2 August at 53 days (cerberus-vs-other-bft-protocols,
 *     consensus-evolution, sharding, rollups). System Layer, which the page
 *     named, was re-verified on 21 September and has left the group.
 *
 * Idempotent: each page is skipped if its sentinel is already stored.
 */
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, assertLinkShapes, withClient } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const SENTINEL = '15:56 UTC on 25 September 2026';

const FRESHNESS_EDITS = [
  [
    'Read on 20 September 2026, 310 of the wiki&rsquo;s 378 pages carry a verification stamp and 68 have never been verified, against 308 of 377 on 16 and 18 September and 293 of 373 on 10 September.',
    'Read at 23:05 UTC on 24 September 2026, 313 of the wiki&rsquo;s 379 pages carry a verification stamp and 66 have never been verified, against 310 of 378 on 20 September, 308 of 377 on 16 and 18 September and 293 of 373 on 10 September.',
  ],
  [
    'No page currently meets the threshold. The oldest reading on the wiki is <a href="/ecosystem/xrd-domains" class="link">XRD Domains</a>, never verified and last edited on 28 March 2026, 176 days ago as of this reading, which crosses 180 days on 24 September 2026.',
    'Age is counted in whole days and a page is stale only when it is <em>more</em> than 180 of them old, so the notice first appears on the 181st day. At that reading no page met the threshold. The oldest reading on the wiki is <a href="/ecosystem/xrd-domains" class="link">XRD Domains</a>, never verified and last edited at 15:56 UTC on 28 March 2026, 180 whole days old at that reading, and it shows the notice from 15:56 UTC on 25 September 2026.',
  ],
  [
    'last edited on 29 June 2026, 83 days ago, and crossing 180 days on 26 December 2026',
    'last edited on 29 June 2026, 87 days old at that reading, and showing the notice from 27 December 2026',
  ],
  [
    'The third-oldest reading is 49 days, shared by six pages the sweep verified on 2 August 2026, among them <a href="/contents/tech/core-protocols/system-layer" class="link">System Layer</a>; all six cross the threshold on 29 January 2027.',
    'The third-oldest reading is 53 days, shared by four pages the sweep verified on 2 August 2026, <a href="/contents/tech/comparisons/cerberus-vs-other-bft-protocols" class="link">Cerberus vs Other BFT Protocols</a>, <a href="/contents/tech/research/consensus-evolution" class="link">Consensus Evolution at Radix</a>, <a href="/contents/tech/core-concepts/sharding" class="link">Sharding</a> and <a href="/contents/tech/core-concepts/rollups" class="link">Rollups</a>; unless one is verified again first, all four show the notice from 30 January 2027.',
  ],
];

const NOTICES_EDITS = [
  [
    '<strong>309 of the 377</strong> pages under a category now carry an explicit verification stamp, read on 20 September 2026, and <strong>none</strong> of them is past the threshold. The oldest page on the wiki was last touched 176 days ago, so it raises the notice by itself on <strong>24 September 2026</strong> unless someone acts first.',
    '<strong>312 of the 378</strong> pages under a category carry an explicit verification stamp, read at 23:05 UTC on 24 September 2026, and at that reading <strong>none</strong> of them was past the threshold. Age is counted in whole days and the notice needs more than 180 of them, so the oldest page on the wiki, last touched at 15:56 UTC on 28 March and 180 days old at that reading, raises the notice by itself from <strong>15:56 UTC on 25 September 2026</strong> unless someone acts first.',
  ],
  [
    'at 176 days and <a href="/ecosystem/radix-namespace" class="link">Radix Namespace</a> at 83, and both sit in',
    'at 180 days and <a href="/ecosystem/radix-namespace" class="link">Radix Namespace</a> at 87, and both sit in',
  ],
];

const replaceOnce = (haystack, needle, replacement, where) => {
  const i = haystack.indexOf(needle);
  if (i < 0) throw new Error(`${where}: string not found: ${JSON.stringify(needle.slice(0, 70))}`);
  if (haystack.indexOf(needle, i + 1) >= 0) throw new Error(`${where}: string is not unique: ${JSON.stringify(needle.slice(0, 70))}`);
  return haystack.slice(0, i) + replacement + haystack.slice(i + needle.length);
};

const applyEdits = (blocks, edits, where) => {
  for (const [from, to] of edits) {
    const target = blocks.find((b) => (b.text || '').includes(from));
    if (!target) throw new Error(`${where}: no block holds ${JSON.stringify(from.slice(0, 60))}`);
    target.text = replaceOnce(target.text, from, to, where);
  }
};

const load = async (client, tagPath, slug) => {
  if (isLockedPage(tagPath, slug)) throw new Error(`${tagPath}/${slug} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
    [tagPath, slug],
  );
  if (!rows.length) throw new Error(`${tagPath}/${slug} not found`);
  return rows[0];
};

const MESSAGE_CORE =
  'wiki-formant/freshness counts whole days with Math.floor and marks a page stale only when that count is more ' +
  'than 180, so XRD Domains (last edited 15:56 UTC 28 March 2026, never verified) raises the first May be outdated ' +
  'notice at 15:56 UTC on 25 September 2026, not on the 24th as stated. Figures re-measured against the database ' +
  'at 23:05 UTC on 24 September: 313 of 379 pages stamped (312 of 378 under a category), XRD Domains 180 days, ' +
  'Radix Namespace 87.';

const PAGES = [
  {
    slug: 'freshness',
    edits: FRESHNESS_EDITS,
    version: '1.8.0',
    message:
      MESSAGE_CORE +
      ' The third-oldest reading is now four pages verified on 2 August at 53 days; System Layer, which the page named, ' +
      'was re-verified on 21 September.',
  },
  { slug: 'editorial-notices', edits: NOTICES_EDITS, version: '1.3.2', message: MESSAGE_CORE },
];

await withClient(async (client) => {
  for (const p of PAGES) {
    const page = await load(client, 'policy', p.slug);
    if (JSON.stringify(page.content).includes(SENTINEL)) {
      console.log(`  ${p.slug}: already applied - no write`);
      continue;
    }
    const blocks = JSON.parse(JSON.stringify(page.content));
    applyEdits(blocks, p.edits, p.slug);
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
