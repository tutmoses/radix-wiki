// sweep-342-radixdlt-post-to-blog.mjs
//
// radixdlt.com moved its blog off /post/ and onto /blog/. Every /post/ URL on
// the wiki now 404s; the run-342 probe found 15 distinct ones across 6 pages
// and 14 of them answer 200 at the identical /blog/ slug. The fifteenth,
// radix-partners-with-argent-..., 404s on BOTH paths: Wayback holds it at
// /blog/ as recently as 8 Oct 2025, so the live site dropped the post rather
// than moved it, and that one is repointed at the capture.
//
// Corpus-wide rather than category-scoped on purpose: the class spans four
// rotation categories (contents/tech, contents/history, blog, the homepage)
// and fixing only this run's slice would leave three future audits to
// rediscover the same 404s.
//
//   node scripts/sweep-342-radixdlt-post-to-blog.mjs --dry-run
//   node scripts/sweep-342-radixdlt-post-to-blog.mjs

import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');

// Probed 31 Aug 2026: /post/ = 404, /blog/ = 200 for every slug below.
const MOVED = /https:\/\/www\.radixdlt\.com\/post\//g;

// 404 on both /post/ and /blog/ as of 31 Aug 2026; last Wayback 200 at /blog/
// is 20251008090415, which is the capture cited here.
const ARGENT_SLUG = 'radix-partners-with-argent-the-worlds-easiest-to-use-defi-wallet';
const ARGENT_LIVE = `https://www.radixdlt.com/post/${ARGENT_SLUG}`;
const ARGENT_ARCHIVE = `https://web.archive.org/web/20251008090415/https://www.radixdlt.com/blog/${ARGENT_SLUG}`;

const bumpMinorPatch = (v) => {
  const [maj, min, pat] = String(v || '1.0.0').split('.').map((n) => parseInt(n, 10) || 0);
  return `${maj}.${min}.${pat + 1}`;
};

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  const { rows } = await client.query(
    `SELECT id, tag_path, slug, title, version, content FROM pages WHERE content::text LIKE '%radixdlt.com/post/%' ORDER BY tag_path, slug`,
  );
  if (!rows.length) {
    console.log('  no page carries a radixdlt.com/post/ URL — already applied, no write');
    process.exit(0);
  }

  let pagesWritten = 0;
  let urlsFixed = 0;

  for (const page of rows) {
    if (isLockedPage(page.tag_path, page.slug)) {
      console.log(`  SKIP ${page.tag_path}/${page.slug} — LOCKED`);
      continue;
    }

    const before = JSON.stringify(page.content);
    // Argent first: it must not be caught by the blanket /post/ -> /blog/ rewrite.
    let after = before.split(ARGENT_LIVE).join(ARGENT_ARCHIVE);
    const argentHits = (before.length - after.length) === 0 ? 0 : before.split(ARGENT_LIVE).length - 1;
    const movedHits = (after.match(MOVED) || []).length;
    after = after.replace(MOVED, 'https://www.radixdlt.com/blog/');

    if (after === before) {
      console.log(`  ${page.tag_path}/${page.slug} — nothing to change`);
      continue;
    }

    const version = bumpMinorPatch(page.version);
    const label = `${page.tag_path || '(root)'}/${page.slug || '(hub)'}`;
    console.log(
      `  ${DRY ? '[dry] ' : ''}${label}  v${page.version} -> v${version}  ` +
      `(${movedHits} moved${argentHits ? `, ${argentHits} -> archive` : ''})`,
    );
    urlsFixed += movedHits + argentHits;

    if (!DRY) {
      const now = new Date().toISOString();
      await client.query('BEGIN');
      await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [
        after, version, now, page.id,
      ]);
      await client.query(
        `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          cuid(), page.id, after, page.title, version, 'patch', AUTHOR_ID,
          'Repoint radixdlt.com/post/ citations to /blog/. The site moved its blog off /post/, so every such URL 404s; ' +
          'each cited slug answers 200 at the identical /blog/ path. The Argent partnership post 404s on both paths ' +
          '(last Wayback 200 at /blog/, 8 Oct 2025) and is repointed at that capture.',
          now,
        ],
      );
      await client.query('COMMIT');
      pagesWritten++;
    }
  }

  console.log(`\n  ${DRY ? '[dry] would fix' : 'fixed'} ${urlsFixed} URL occurrences across ${DRY ? rows.length : pagesWritten} pages`);
} finally {
  client.release();
  await pool.end();
}
