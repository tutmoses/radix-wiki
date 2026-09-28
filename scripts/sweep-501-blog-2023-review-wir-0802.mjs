/**
 * Sweep 501: the two oldest blog pages by verification age, re-read on 28 September 2026.
 *   - week-in-review-2026-08-02: the brief said the consultation app "settled its first two
 *     binding votes", but the body and What to watch both have them closing on 4 August, two
 *     days after the week ended. Proposal 1 closed 06:42 UTC and Proposal 2 06:44 UTC on 4 Aug,
 *     both unopposed (recorded on /ideas/dao-governance-app-consultation-v2 and
 *     /ecosystem/radix-accountability-council, read from the component on 11 Aug). The bullet
 *     now says opened, and the Corrections section leads with the corrected fact.
 *   - a-year-in-review-2023: ShardSpace and Impahla both have ecosystem pages and were unlinked;
 *     the word Cerberus inside the NFT collection name 'God Eater Cerberus' linked to the
 *     consensus-protocol article, which the collection has nothing to do with. The embedded
 *     tweet (JCRYPTO_YT, 30 Dec 2023, id 1741210869747306725) still resolves via syndication.
 */
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const TAG = 'blog';

const PAGES = [
  {
    slug: 'week-in-review-2026-08-02', version: '2.0.3', sentinel: 'Corrected 28 September 2026',
    message: 'Correction: the brief said the consultation app settled its first two binding votes this week. They were open during the week and closed on 4 August (Proposal 1 06:42 UTC, Proposal 2 06:44 UTC), both unopposed, as the body and What to watch already said. Bullet corrected; Corrections section records it.',
    cuts: [
      ['<li>The community\'s own voting application settled its first two binding votes.</li>',
        '<li>The community\'s own voting application opened its first two binding votes, which closed on 4 August.</li>'],
      ['<h2>Corrections</h2><p>Nothing this week.</p>',
        '<h2>Corrections</h2><p>Nothing at publication.</p><p>Corrected 28 September 2026: the first two binding votes closed on 4 August, both unopposed, two days after this week ended. The brief had said they settled during it. The result is recorded on <a href="/ideas/dao-governance-app-consultation-v2" rel="noopener">Ship the on-chain governance app</a>.</p>'],
    ],
  },
  {
    slug: 'a-year-in-review-2023', version: '2.5.4', sentinel: 'href="/ecosystem/impahla"',
    message: 'Link hygiene: ShardSpace and Impahla now link to their ecosystem pages; the word Cerberus inside the NFT collection name no longer links to the consensus-protocol article, which the collection is unrelated to. Embedded tweet re-checked and live.',
    cuts: [
      ['Shardspace gave live demos', '<a href="/ecosystem/shardspace" rel="noopener">ShardSpace</a> gave live demos'],
      ['\'God Eater <a href="/contents/tech/core-protocols/cerberus-consensus-protocol">Cerberus</a>\' collections on Impahla.',
        '\'God Eater Cerberus\' collections on <a href="/ecosystem/impahla" rel="noopener">Impahla</a>, a marketplace that has since closed.'],
    ],
  },
];

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  for (const p of PAGES) {
    if (isLockedPage(TAG, p.slug)) throw new Error(`${p.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG, p.slug]);
    if (!rows.length) throw new Error(`${p.slug} not found`);
    const page = rows[0];
    const blocks = JSON.parse(JSON.stringify(page.content));
    const leaves = [];
    const walk = (bs) => bs.forEach((b) => { if (typeof b.text === 'string') leaves.push(b); if (b.blocks) walk(b.blocks); });
    walk(blocks);
    if (leaves.some((b) => b.text.includes(p.sentinel))) { console.log(`  ${p.slug}: already applied – no write`); continue; }
    for (const [find, replace] of p.cuts) {
      const hits = leaves.filter((b) => b.text.includes(find));
      if (hits.length !== 1 || hits[0].text.split(find).length !== 2) throw new Error(`${p.slug}: expected exactly 1 match for "${find.slice(0, 60)}"`);
      hits[0].text = hits[0].text.replace(find, () => replace);
    }
    const json = JSON.stringify(blocks);
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${p.version}`);
    if (DRY) { p.cuts.forEach(([, r]) => console.log('    +', r)); continue; }
    const now = new Date().toISOString();
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, p.version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, p.version, 'patch', AUTHOR_ID, p.message, now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
