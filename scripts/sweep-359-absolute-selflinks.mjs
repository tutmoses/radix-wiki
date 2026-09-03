/**
 * Run 359 — internal navigation links written as absolute radix.wiki URLs.
 *
 * Six pages linked to other wiki pages through `https://radix.wiki/...` rather
 * than a relative path. On two of them (the auto-generated Olympia and
 * Alexandria release pages) the anchors also carried
 * `target="_blank" rel="noopener noreferrer nofollow"`, so nineteen links from
 * two cornerstone pages opened the wiki in a new tab and told crawlers not to
 * follow the site's own internal links.
 *
 * Rewrites only anchors whose href is a radix.wiki *page* path that resolves to
 * a real row, and only inside the six pages named. Absolute uses that are
 * deliberate - the legal pages naming the site, brand-assets, /ecosystem/radix-wiki,
 * the MCP endpoint URLs printed as documentation, and citation URLs inside the
 * Week in Review's structured source lists - are out of scope and untouched.
 */
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');

const TARGETS = [
  ['contents/tech/releases', 'radix-developer-environment-alexandria', '3.1.2'],
  ['contents/tech/releases', 'radix-mainnet-olympia', '2.0.4'],
  ['ecosystem', 'singularityx', '2.1.2'],
  ['ecosystem', 'leafnode', '4.1.1'],
  ['contents/history', 'validator-subsidy-sunset', '1.3.1'],
];

const MESSAGE =
  'Internal links written as absolute radix.wiki URLs now use relative paths. On this page they pointed at other wiki pages through the public domain, which bypasses client-side navigation and the link-preview hook; where the anchor also carried target="_blank" rel="noopener noreferrer nofollow" it opened the wiki in a new tab and instructed crawlers not to follow the site\'s own internal links. Every rewritten target was checked to resolve to a real page row first. Deliberate absolute uses of the domain are untouched.';

// <a ...href="https://radix.wiki/<path>"...>  ->  <a href="/<path>" rel="noopener">
const RE = /<a\b([^>]*?)href="https:\/\/(?:www\.)?radix\.wiki(\/[^"#?]*)"([^>]*)>/g;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

const exists = async (path) => {
  const i = path.lastIndexOf('/');
  const { rows } = await client.query('SELECT 1 FROM pages WHERE tag_path=$1 AND slug=$2', [path.slice(1, i), path.slice(i + 1)]);
  return rows.length > 0;
};

try {
  let totalLinks = 0, totalPages = 0;

  for (const [tagPath, slug, version] of TARGETS) {
    if (isLockedPage(tagPath, slug)) { console.log(`  SKIP ${tagPath}/${slug} — LOCKED`); continue; }

    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path=$1 AND slug=$2', [tagPath, slug]);
    if (!rows.length) { console.log(`  MISS ${tagPath}/${slug}`); continue; }
    const page = rows[0];

    let json = JSON.stringify(page.content);
    if (!/radix\\?\.wiki/.test(json)) { console.log(`  ${tagPath}/${slug} — already applied, no absolute self-links`); continue; }

    // collect candidate paths first so each is verified before any rewrite
    const paths = new Set();
    for (const m of json.matchAll(/<a\b[^>]*?href=\\"https:\/\/(?:www\.)?radix\.wiki(\/[^\\"#?]*)\\"/g)) paths.add(m[1]);
    const good = new Set();
    for (const p of paths) { if (await exists(p)) good.add(p); else console.log(`    unresolved, left absolute: ${p}`); }

    let n = 0;
    // content is stored as JSON, so the markup carries escaped quotes
    json = json.replace(/<a\b([^>]*?)href=\\"https:\/\/(?:www\.)?radix\.wiki(\/[^\\"#?]*)\\"([^>]*?)>/g,
      (whole, pre, path, post) => {
        if (!good.has(path)) return whole;
        n++;
        return `<a href=\\"${path}\\" rel=\\"noopener\\">`;
      });

    if (!n) { console.log(`  ${tagPath}/${slug} — nothing to rewrite`); continue; }
    totalLinks += n; totalPages++;
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  (${n} links)`);

    if (!DRY) {
      const now = new Date().toISOString();
      const content = JSON.parse(json);
      const out = JSON.stringify(content);
      await client.query('BEGIN');
      await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [out, version, now, page.id]);
      await client.query(
        `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [cuid(), page.id, out, page.title, version, 'patch', AUTHOR_ID, MESSAGE, now]);
      await client.query('COMMIT');
    }
  }
  console.log(`  ${DRY ? '[dry] ' : ''}${totalLinks} links across ${totalPages} pages`);
} finally {
  client.release();
  await pool.end();
}
