// sweep-346 — remove the hand-written infobox rows that are byte-identical to the
// metadata row BlockRenderer already renders above them.
//
// `buildMetadataBlock` (src/components/BlockRenderer.tsx) turns every declared
// metadata key with a value into its own table at the top of the infobox aside.
// Where a page's hand-written facts table repeats one of those rows with the same
// value, the sidebar prints it twice. This removes the hand-written copy; the
// metadata row stays, because it is the one the category view facets and sorts on.
//
// ONLY exact duplicates are touched. A row that says more than the metadata value
// (113 of them) or that contradicts it (73) is left alone deliberately — those need
// a human to decide which of the two is right.
//
// The removable set is RE-DERIVED from the live DB on every run rather than read
// from a list, so the script is idempotent: a row already gone is simply not found.
//
// Run: npx tsx scripts/sweep-346-infobox-metadata-duplicates.ts [--dry-run] [--limit N]
import pg from 'pg';
import { config } from 'dotenv';
import { metadataRows } from '../src/lib/taxonomy';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const limitArg = process.argv.indexOf('--limit');
const LIMIT = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity;

const strip = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
const norm = (s: string) => strip(s).replace(/[:：]$/, '').trim().toLowerCase();
const canon = (s: string) => norm(s).replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
const bumpPatch = (v: string) => { const [a, b, c] = (v || '1.0.0').split('.').map(Number); return `${a}.${b}.${(c || 0) + 1}`; };
/** A table still has a real data row after the removals. */
const hasDataRow = (html: string) => /<tr[^>]*>\s*<(th|td)(?![^>]*colspan)[^>]*>[\s\S]*?<\/\1>\s*<(th|td)/.test(html);

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

let pagesChanged = 0, rowsRemoved = 0, pagesSkipped = 0;
try {
  const { rows: pages } = await client.query<any>(
    'SELECT id, tag_path, slug, title, version, metadata, content FROM pages ORDER BY tag_path, slug');

  for (const p of pages) {
    if (pagesChanged >= LIMIT) break;
    if (!p.metadata) continue;
    if (isLockedPage(p.tag_path, p.slug)) continue;

    let meta: any[] = [];
    try { meta = metadataRows(p.tag_path, { metadata: p.metadata } as any).filter((r: any) => r.type !== 'resource_address'); } catch { continue; }
    const M = new Map<string, string>(meta.map((r: any) => [norm(r.label), String(r.value)]));
    if (!M.size) continue;

    const blocks = JSON.parse(JSON.stringify(p.content));
    const removed: string[] = [];
    let aborted: string | null = null;

    for (const b of blocks) {
      if (b?.type !== 'infobox') continue;
      for (const nb of b.blocks ?? []) {
        if (typeof nb?.text !== 'string') continue;
        const before = nb.text;
        let text = nb.text;
        for (const tr of [...before.matchAll(/<tr[^>]*>[\s\S]*?<\/tr>/g)].map(m => m[0])) {
          const cells = /^<tr[^>]*>\s*<(th|td)([^>]*)>([\s\S]*?)<\/\1>\s*<(th|td)[^>]*>([\s\S]*?)<\/\4>\s*<\/tr>$/.exec(tr);
          if (!cells) continue;
          // Groups 2, 3 and 5 are the first cell's attributes, its text and the
          // second cell's text. They cannot be undefined once the match holds,
          // but `noUncheckedIndexedAccess` types them so - name them here rather
          // than asserting at each use.
          const [, , attrs = '', labelCell = '', , valueCell = ''] = cells;
          if (/colspan/i.test(attrs)) continue;
          const label = norm(labelCell);
          const metaValue = M.get(label);
          if (metaValue === undefined) continue;
          if (canon(metaValue) !== canon(valueCell)) continue;      // superset / divergent: leave alone
          if (text.split(tr).length - 1 !== 1) { aborted = `${label}: <tr> is not unique in its block`; continue; }
          // Eat one adjacent newline with the row so a removal does not leave a
          // blank line where the <tr> stood.
          text = text.includes(tr + '\n') ? text.replace(tr + '\n', '')
               : text.includes('\n' + tr) ? text.replace('\n' + tr, '')
               : text.replace(tr, '');
          removed.push(label);
        }
        if (text === before) continue;
        if (!hasDataRow(text)) { aborted = 'removal would leave a table with no data rows'; break; }
        nb.text = text;
      }
      if (aborted) break;
    }

    if (aborted) { console.log(`  SKIP /${p.tag_path}/${p.slug} — ${aborted}`); pagesSkipped++; continue; }
    if (!removed.length) continue;

    const version = bumpPatch(p.version);
    console.log(`  ${DRY ? '[dry] ' : ''}/${p.tag_path}/${p.slug}  v${p.version} -> v${version}  removed: ${removed.join(', ')}`);
    pagesChanged++; rowsRemoved += removed.length;

    if (!DRY) {
      const now = new Date().toISOString();
      const json = JSON.stringify(blocks);
      await client.query('BEGIN');
      await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, version, now, p.id]);
      await client.query(
        `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [cuid(), p.id, json, p.title, version, 'patch', AUTHOR_ID,
         `Removed ${removed.length} infobox row(s) duplicating the page's own metadata (${removed.join(', ')}): the declared metadata keys already render as a table above the infobox, so these printed twice. Only exact duplicates removed; qualified and contradictory rows left in place.`, now]);
      await client.query('COMMIT');
    }
  }
  console.log(`\n${DRY ? '[dry] ' : ''}${pagesChanged} pages, ${rowsRemoved} rows removed, ${pagesSkipped} skipped`);
} finally {
  client.release();
  await pool.end();
}
