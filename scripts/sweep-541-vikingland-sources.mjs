// Sweep 541: /ecosystem/vikingland lost its only external link on 1 Oct (v3.4.0, the recycled-handle
// section removed under the scope change) and entered the Unsourced tracking queue. Re-sourced from
// primary material read 5 Oct 2026: the Radix blog's RadLand Babylon Booster Grant post names the
// VikingLand + Radish Square merger; the Wayback Machine holds vikingland.io as "VikingLand - NFT Market"
// on 3 Feb 2023 and as a domain-expired page on 10 Nov 2024.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'ecosystem';
const SLUG = 'vikingland';
const SENTINEL = 'babylon-booster-grants-radland';
const DRY = process.argv.includes('--dry-run');
const A = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

const REPLACE = [
  ['to form <a href="/ecosystem/radland" rel="noopener">RadLand</a>. The platform',
    `to form <a href="/ecosystem/radland" rel="noopener">RadLand</a>, as the ${A('https://www.radixdlt.com/blog/babylon-booster-grants-radland', 'Radix blog&rsquo;s Babylon Booster Grant post on RadLand')} records. The platform`],
  ['for the archived snapshots.</em></p>',
    `for the archived snapshots. VikingLand&#39;s own domain, <code>vikingland.io</code>, served a ${A('https://web.archive.org/web/20241110083853/http://vikingland.io/', 'domain-expired page')} by 10 November 2024; the last capture of the marketplace itself is ${A('https://web.archive.org/web/20230203192704/https://www.vikingland.io/', 'from 3 February 2023')}.</em></p>`],
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
  const version = '3.4.1';
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
        'Sweep 541: the 1 Oct section removal left this page with no external link, so it entered the Unsourced queue. Merger with Radish Square now cites the Radix blog RadLand grant post; link-rot note adds Wayback captures of vikingland.io (marketplace 3 Feb 2023, domain expired 10 Nov 2024). Read 5 Oct 2026.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
