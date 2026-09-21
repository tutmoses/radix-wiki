import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

// The last four pages that name Dan Hughes in prose without linking the
// biography. When the Community section was retired in September 2026 the
// biography moved to contents/history and 103 links were rewritten; 23 pages
// point at it today and these four were missed. They matter because six
// radix.wiki URLs compete for "dan hughes radix" - the biography at 8, then four
// listing pages that merely display his name - and an internal link with his
// name as the anchor is what tells a crawler which of them is the article.
//
// Only the first prose mention on each page is linked, per the convention the
// rest of the wiki follows. Mentions already inside an anchor, and citation
// lines under External Links, are left alone.

const HREF = '/contents/history/dan-hughes';
const LINK = `<a href="${HREF}" rel="noopener">Dan Hughes</a>`;
const DRY = process.argv.includes('--dry-run');

const EDITS = [
  // Each `find` must occur exactly once in the page, and must not already be linked.
  { tagPath: 'contents/history', slug: 'flexathon', bump: 'patch',
    find: 'run by Dan Hughes, founder of Radix' },
  { tagPath: 'ecosystem', slug: 'addix', bump: 'patch',
    // The first two mentions sit inside an anchor to the Tempo whitepaper; this is
    // the first that is plain text.
    find: 'written by Dan Hughes on the Bitcointalk forum' },
  { tagPath: 'ecosystem', slug: 'dan', bump: 'patch',
    find: 'to pay homage to Dan Hughes, the creator of Radix' },
  { tagPath: 'blog', slug: 'week-in-review-2026-07-26', bump: 'patch',
    find: "whether Dan Hughes's original consensus work" },
];

const MESSAGE = `Linked the first prose mention of Dan Hughes to the biography at ${HREF}. The Community section was retired on 2026-09-09 and his page moved to contents/history; 23 pages were relinked then and this one was missed, leaving the name as plain text. Wording is unchanged - only the anchor is new.`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

let written = 0, skipped = 0;
try {
  for (const { tagPath, slug, bump, find } of EDITS) {
    if (isLockedPage(tagPath, slug)) throw new Error(`${tagPath}/${slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [tagPath, slug]);
    if (!rows.length) throw new Error(`page not found: ${tagPath}/${slug}`);
    const page = rows[0];

    const blocks = JSON.parse(JSON.stringify(page.content));
    const hits = blocks.filter(b => typeof b.text === 'string' && b.text.includes(find));
    if (hits.length === 0) {
      // Either the wording moved or the link is already in place. Both are a
      // reason to stop rather than to guess at a different sentence.
      const linked = JSON.stringify(blocks).includes(HREF);
      if (linked) { console.log(`  ${slug}: already links the biography - no write`); skipped++; continue; }
      throw new Error(`${slug}: "${find}" not found, and the page does not link ${HREF}`);
    }
    if (hits.length > 1) throw new Error(`${slug}: "${find}" matched ${hits.length} blocks; expected 1`);
    const block = hits[0];
    const count = block.text.split(find).length - 1;
    if (count !== 1) throw new Error(`${slug}: "${find}" occurs ${count} times in its block; expected 1`);

    block.text = block.text.replace(find, find.replace('Dan Hughes', LINK));

    const [maj, min, pat] = String(page.version).split('.').map(Number);
    const version = bump === 'minor' ? `${maj}.${min + 1}.0` : `${maj}.${min}.${pat + 1}`;
    console.log(`  ${DRY ? '[dry] ' : ''}/${tagPath}/${slug}  v${page.version} -> v${version}`);
    if (DRY) console.log(`          ${find.replace('Dan Hughes', LINK)}`);

    if (!DRY) {
      const now = new Date().toISOString();
      const json = JSON.stringify(blocks);
      await client.query('BEGIN');
      await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4',
        [json, version, now, page.id]);
      await client.query(
        `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [cuid(), page.id, json, page.title, version, 'patch', AUTHOR_ID, MESSAGE, now]);
      await client.query('COMMIT');
    }
    written++;
  }
  console.log(`\n  ${DRY ? 'would write' : 'written'}: ${written}   already applied: ${skipped}`);
} finally {
  client.release();
  await pool.end();
}
