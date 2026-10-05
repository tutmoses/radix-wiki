// Sweep 541: /policy/freshness carried its verification census and its notice queue as read on
// 24 September. Re-read at 23:04 UTC on 5 October 2026 from the pages table: 332 of 379 pages carry a
// verification stamp, 47 never verified. XRD Domains still shows the notice (cache-busted load, 5 Oct);
// Radix Namespace is 98 days old; the four pages that were third-oldest on 24 Sep have all been
// re-verified since, so third place is now Access Controller (verified 7 Aug, notice from 4 Feb 2027).
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'policy';
const SLUG = 'freshness';
const SENTINEL = '332 of the wiki';
const DRY = process.argv.includes('--dry-run');

const REPLACE = [
  ['Read at 23:05 UTC on 24 September 2026, 313 of the wiki&rsquo;s 379 pages carry a verification stamp and 66 have never been verified, against 310 of 378 on 20 September,',
    'Read at 23:04 UTC on 5 October 2026, 332 of the wiki&rsquo;s 379 pages carry a verification stamp and 47 have never been verified, against 313 of 379 on 24 September, 310 of 378 on 20 September,'],
  ['So the first notice sits on a page the process cannot currently clear.</p>',
    'So the first notice sits on a page the process cannot currently clear. On 5 October it was 191 days old and a cache-busted load still rendered the notice.</p>'],
  ['last edited on 29 June 2026, 87 days old at that reading, and showing the notice from 27 December 2026',
    'last edited on 29 June 2026, 98 days old on 5 October, and showing the notice from 27 December 2026'],
  ['The third-oldest reading is 53 days, shared by four pages the sweep verified on 2 August 2026, <a href="/contents/tech/comparisons/cerberus-vs-other-bft-protocols" class="link">Cerberus vs Other BFT Protocols</a>, <a href="/contents/tech/research/consensus-evolution" class="link">Consensus Evolution at Radix</a>, <a href="/contents/tech/core-concepts/sharding" class="link">Sharding</a> and <a href="/contents/tech/core-concepts/rollups" class="link">Rollups</a>; unless one is verified again first, all four show the notice from 30 January 2027.',
    'On 24 September the third-oldest reading was 53 days, shared by four pages the sweep had verified on 2 August 2026, <a href="/contents/tech/comparisons/cerberus-vs-other-bft-protocols" class="link">Cerberus vs Other BFT Protocols</a>, <a href="/contents/tech/research/consensus-evolution" class="link">Consensus Evolution at Radix</a>, <a href="/contents/tech/core-concepts/sharding" class="link">Sharding</a> and <a href="/contents/tech/core-concepts/rollups" class="link">Rollups</a>. All four were verified again before 5 October, which is the rotation working as intended, and third place passed to <a href="/contents/tech/core-concepts/access-controller" class="link">Access Controller</a>, 59 days old, verified on 7 August 2026; unless it is verified again first, it shows the notice from 4 February 2027.'],
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
  const version = '1.8.2';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'patch', AUTHOR_ID,
        'Sweep 541: verification census re-read at 23:04 UTC 5 Oct 2026 (332 of 379 pages stamped, 47 never verified, from 313 of 379 on 24 Sep). XRD Domains still renders the notice at 191 days; Radix Namespace 98 days. The four pages that were third-oldest on 24 Sep have all been re-verified, so third place is Access Controller (verified 7 Aug, notice from 4 Feb 2027).', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
