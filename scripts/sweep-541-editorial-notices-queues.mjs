// Sweep 541: /policy/editorial-notices carried its stamp census, outdated-notice forecast and tracking
// queue counts as read 20-28 September. Re-read at 23:04 UTC on 5 October 2026 from the pages table with
// the predicates in src/lib/maintenance.ts: 331 of 378 categorised pages stamped; Outdated 1 (XRD Domains,
// 191 days, the forecast notice did fire on 25 Sep); Orphaned 54 (44 Ecosystem), up from 11 on 20 Sep,
// after the 1 Oct deletion of the status index that linked every project (built by sweep 502, e56e32f);
// Unsourced 14 after VikingLand was re-sourced this run (7 references-only pages carrying 60 URLs, 4 hubs,
// 2 generated pages, XRD Domains). Advertisement banners still three, on 379 pages.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'policy';
const SLUG = 'editorial-notices';
const SENTINEL = '<strong>331 of the 378</strong>';
const DRY = process.argv.includes('--dry-run');

const REPLACE = [
  ['Read again on 28 September 2026, the whole wiki carries <strong>three</strong> of them across 380 pages,',
    'Read again on 5 October 2026, the whole wiki carries <strong>three</strong> of them across 379 pages,'],
  ['<strong>312 of the 378</strong> pages under a category carry an explicit verification stamp, read at 23:05 UTC on 24 September 2026, and at that reading <strong>none</strong> of them was past the threshold. Age is counted in whole days and the notice needs more than 180 of them, so the oldest page on the wiki, last touched at 15:56 UTC on 28 March and 180 days old at that reading, raises the notice by itself from <strong>15:56 UTC on 25 September 2026</strong> unless someone acts first.</p>',
    '<strong>331 of the 378</strong> pages under a category carry an explicit verification stamp, read at 23:04 UTC on 5 October 2026, against 312 on 24 September, and at that reading <strong>one</strong> page was past the threshold. Age is counted in whole days and the notice needs more than 180 of them, so the oldest page on the wiki, last touched at 15:56 UTC on 28 March, raised the notice by itself from <strong>15:56 UTC on 25 September 2026</strong>, the first the site has shown. On 5 October it was 191 days old.</p>'],
  ['</a> at 180 days and <a href="/ecosystem/radix-namespace" class="link">Radix Namespace</a> at 87,',
    '</a> at 191 days and <a href="/ecosystem/radix-namespace" class="link">Radix Namespace</a> at 98 on 5 October,'],
  ['The first outdated notice this wiki raises will therefore land on an article the sweep cannot rewrite.',
    'The first outdated notice this wiki raised therefore landed on an article the sweep cannot rewrite.'],
  ['<strong>11 pages</strong> on 20 September 2026, still the largest queue and down from 13 on 4 September.</li>',
    '<strong>54 pages</strong> on 5 October 2026, up from 11 on 20 September and 13 on 4 September. 44 of the 54 are Ecosystem projects, and the rise follows the deletion on 1 October of the Radix Ecosystem Operational Status index, which linked every project in the directory. A project page whose only inbound link was that index now reaches readers through search and the category listing alone.</li>'],
  ['<strong>16 pages</strong>, unchanged in count since 4 September.',
    '<strong>14 pages</strong> on 5 October 2026, down from the 16 it held from 4 September.'],
  ['Seven of the sixteen are that case,', 'Seven of the fourteen are that case,'],
  ['Of the nine that carry no link of any kind, four are category hub articles and two are pages the site generates from its own data, which leaves three ecosystem articles that cite nothing: <a href="/ecosystem/arcane-labyrinth" class="link">Arcane Labyrinth</a>, <a href="/ecosystem/etherealdao" class="link">EtherealDAO</a> and <a href="/ecosystem/xrd-domains" class="link">XRD Domains</a>.</li>',
    'Of the seven that carry no link of any kind, four are category hub articles and two are pages the site generates from its own data, which leaves one ecosystem article that cites nothing, the locked <a href="/ecosystem/xrd-domains" class="link">XRD Domains</a>. <a href="/ecosystem/arcane-labyrinth" class="link">Arcane Labyrinth</a> and <a href="/ecosystem/etherealdao" class="link">EtherealDAO</a> have gained sources since the last reading. <a href="/ecosystem/vikingland" class="link">VikingLand</a> joined the queue on 1 October, when the section holding its only external link was removed, and left it on 5 October when the merger and its domain history were cited.</li>'],
  ['Empty, and an empty queue is not rendered, so the heading is absent from the index rather than showing a zero.</li>',
    'One page on 5 October 2026, <a href="/ecosystem/xrd-domains" class="link">XRD Domains</a> at 191 days. An empty queue is not rendered, so until 25 September the heading was absent from the index rather than showing a zero.</li>'],
];

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query('SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));
  if (blocks.some((b) => b.text?.includes(SENTINEL))) {
    console.log('  already applied — no write');
    process.exit(0);
  }
  for (const [from, to] of REPLACE) {
    const block = blocks.find((b) => b.type === 'content' && b.text.includes(from));
    if (!block) throw new Error(`no match: ${from.slice(0, 60)}`);
    block.text = block.text.replace(from, to);
  }
  const version = '1.5.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
        'Sweep 541: dated figures re-read at 23:04 UTC 5 Oct 2026. Stamps 331 of 378 (312 on 24 Sep); the forecast first outdated notice fired on XRD Domains on 25 Sep and that queue now holds it. Orphaned 54, up from 11 on 20 Sep, 44 of them Ecosystem projects, after the 1 Oct deletion of the status index that linked every project. Unsourced 14: Arcane Labyrinth and EtherealDAO sourced since, VikingLand in and out (re-sourced this run). Banner count re-read: three, on 379 pages.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
