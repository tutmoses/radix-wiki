import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

// Run 459: wiring for the new /ecosystem/apollo-pool page, seeded this run.
// 1. The page's Olympia link was written as /contents/tech/releases/radix-olympia;
//    the page is radix-mainnet-olympia, so the link resolved to nothing.
// 2. Validator subsidy sunset told the Apollo Pool story before the ecosystem
//    page existed and still names it in plain text.
// 3. Cobra Stakes lists sibling validators whose on-ledger site has lapsed and
//    should name the one whose domain someone else now owns.
const DRY = process.argv.includes('--dry-run');
const NBSP = String.fromCharCode(160);

const EDITS = [
  {
    tagPath: 'ecosystem',
    slug: 'apollo-pool',
    block: '667f4e37-fc79-4336-b8be-90d6dd0d88de',
    version: '1.0.1',
    changeType: 'patch',
    sentinel: '/contents/tech/releases/radix-mainnet-olympia',
    from: 'href="/contents/tech/releases/radix-olympia"',
    to: 'href="/contents/tech/releases/radix-mainnet-olympia"',
    message: 'The Olympia link pointed at /contents/tech/releases/radix-olympia, which is not a page on this wiki. Repointed to /contents/tech/releases/radix-mainnet-olympia.',
  },
  {
    tagPath: 'contents/history',
    slug: 'validator-subsidy-sunset',
    block: 'e1bc9c42-36d8-4f56-9f1f-1a8ddc8c2686',
    version: '1.5.1',
    changeType: 'patch',
    sentinel: '/ecosystem/apollo-pool',
    from: `<h2>Apollo Pool at 100% (19 September 2026)</h2><p>Apollo Pool's rise`,
    to: `<h2>Apollo Pool at 100% (19 September 2026)</h2><p><a href="/ecosystem/apollo-pool" rel="noopener">Apollo Pool</a>'s rise`,
    message: 'Linked the Apollo Pool section to the validator’s new ecosystem page, seeded 20 September 2026.',
  },
  {
    tagPath: 'ecosystem',
    slug: 'cobra-stakes',
    block: 'e15d983a-1e68-4f39-8e93-4cec095137d3',
    version: '2.3.1',
    changeType: 'patch',
    sentinel: '/ecosystem/apollo-pool',
    from: '<li><a href="/ecosystem/crumbsnode" rel="noopener">CrumbsNode</a>',
    to: '<li><a href="/ecosystem/apollo-pool" rel="noopener">Apollo Pool</a> &ndash; Radix validator whose on-ledger website was re-registered by someone else</li><li><a href="/ecosystem/crumbsnode" rel="noopener">CrumbsNode</a>',
    message: 'Added Apollo Pool to Related: a second validator naming a domain on ledger that its operator no longer owns. Its page was seeded 20 September 2026.',
  },
];

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  for (const e of EDITS) {
    if (isLockedPage(e.tagPath, e.slug)) throw new Error(`${e.tagPath}/${e.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [e.tagPath, e.slug]);
    if (!rows.length) throw new Error(`${e.tagPath}/${e.slug} not found`);
    const page = rows[0];

    const blocks = JSON.parse(JSON.stringify(page.content));
    const block = blocks.find((b) => b.id === e.block);
    if (!block) throw new Error(`${e.slug}: block ${e.block} not found`);

    if (block.text.includes(e.sentinel)) {
      console.log(`  ${e.slug}: already applied, no write`);
      continue;
    }
    if (!block.text.includes(e.from)) throw new Error(`${e.slug}: target string not found verbatim`);
    block.text = block.text.replace(e.from, e.to);

    const json = JSON.stringify(blocks);
    const stray = json.match(new RegExp(NBSP, 'g'));
    if (stray) throw new Error(`${e.slug}: ${stray.length} raw U+00A0 in the written blocks`);

    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${e.version}  (+${json.length - JSON.stringify(page.content).length} chars)`);
    if (!DRY) {
      const now = new Date().toISOString();
      await client.query('BEGIN');
      await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
        [json, e.version, now, page.id]);
      await client.query(
        `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [cuid(), page.id, json, page.title, e.version, e.changeType, AUTHOR_ID, e.message, now]);
      await client.query('COMMIT');
    }
  }
} finally {
  client.release();
  await pool.end();
}
