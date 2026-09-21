import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

// Three pages whose top-level sections were stored as h3 under the page's h1,
// so the outline skipped h2 entirely. Found by check-pages (wiki-formant)
// walking the whole sitemap; a per-page read would not have grouped them.
//
// Only the sections that head the page move. radix-wiki-hackathon-1 already has
// one h2, "Results", with medal placings as h3 beneath it - those are correctly
// nested and are left alone, which is why each heading is named rather than
// every h3 being promoted.

const DRY = process.argv.includes('--dry-run');

const EDITS = [
  { tagPath: 'contents/tech/core-protocols', slug: 'personas',
    headings: ['Overview', 'Functionality', 'Process', 'User Control and Privacy', 'Impact'] },
  { tagPath: 'ecosystem', slug: 'religant',
    headings: ['Functionality', 'Component API', 'Integration Guide', 'Status', 'External Links'] },
  { tagPath: 'contents/history', slug: 'radix-wiki-hackathon-1',
    headings: ['Testimonials', 'Tracks'] },
];

const MESSAGE = 'Promoted the page’s top-level sections from h3 to h2. Each of these rendered an h1 followed straight by h3, so the document had no second level and both a screen reader and a parser read the sections as subordinate to nothing. Wording and order are unchanged; only the tag level moves, and a heading already correctly nested under an h2 is left as it is.';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

let written = 0, skipped = 0;
try {
  for (const { tagPath, slug, headings } of EDITS) {
    if (isLockedPage(tagPath, slug)) throw new Error(`${tagPath}/${slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [tagPath, slug]);
    if (!rows.length) throw new Error(`page not found: ${tagPath}/${slug}`);
    const page = rows[0];

    const blocks = JSON.parse(JSON.stringify(page.content));
    let changed = 0;
    for (const heading of headings) {
      // The opening tag may carry an id from the stored decoration, so the
      // match is the tag and its text rather than a fixed string.
      const open = new RegExp(`<h3([^>]*)>(\\s*(?:<[^>]+>\\s*)*)${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
      for (const b of blocks) {
        if (typeof b.text !== 'string' || !b.text.includes(heading)) continue;
        const before = b.text;
        b.text = b.text.replace(open, (_m, attrs, inner) => `<h2${attrs}>${inner}${heading}`);
        if (b.text !== before) {
          // Its closing tag is the next </h3> after the opening one.
          b.text = b.text.replace(new RegExp(`(<h2[^>]*>(?:(?!</h[23]>)[\\s\\S])*?)</h3>`, 'g'), '$1</h2>');
          changed++;
        }
      }
    }
    if (changed === 0) { console.log(`  ${slug}: nothing matched - already applied?`); skipped++; continue; }
    if (changed !== headings.length) throw new Error(`${slug}: matched ${changed} of ${headings.length} headings`);
    if (/<h3[^>]*>[^<]*<\/h2>|<h2[^>]*>[^<]*<\/h3>/.test(JSON.stringify(blocks))) throw new Error(`${slug}: mismatched heading tags after rewrite`);

    const [maj, min, pat] = String(page.version).split('.').map(Number);
    const version = `${maj}.${min}.${pat + 1}`;
    console.log(`  ${DRY ? '[dry] ' : ''}/${tagPath}/${slug}  v${page.version} -> v${version}   ${changed} heading(s) h3 -> h2`);

    if (!DRY) {
      const now = new Date().toISOString();
      const json = JSON.stringify(blocks);
      await client.query('BEGIN');
      await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, version, now, page.id]);
      await client.query(
        `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [cuid(), page.id, json, page.title, version, 'patch', AUTHOR_ID, MESSAGE, now]);
      await client.query('COMMIT');
    }
    written++;
  }
  console.log(`\n  ${DRY ? 'would write' : 'written'}: ${written}   skipped: ${skipped}`);
} finally {
  client.release();
  await pool.end();
}
