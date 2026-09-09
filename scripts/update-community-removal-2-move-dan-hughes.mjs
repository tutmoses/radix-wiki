// Moves the Dan Hughes biography out of the Community section and into
// contents/history, then re-points every link that named its old path.
// Also corrects the History hub's birth year, which disagreed with the
// biography's own sourced date (24 July 1979, died aged 46).

import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
import { bump } from 'wiki-formant/versioning';
config();

const DRY = process.argv.includes('--dry-run');
const FROM = { tagPath: 'community', slug: 'dan-hughes' };
const TO = { tagPath: 'contents/history', slug: 'dan-hughes' };
const OLD_HREF = '/community/dan-hughes';
const NEW_HREF = '/contents/history/dan-hughes';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(FROM.tagPath, FROM.slug) || isLockedPage(TO.tagPath, TO.slug)) throw new Error('page is LOCKED');

  // ── The move itself.
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [FROM.tagPath, FROM.slug]);
  const { rows: already } = await client.query(
    'SELECT id FROM pages WHERE tag_path = $1 AND slug = $2', [TO.tagPath, TO.slug]);

  if (!rows.length && already.length) {
    console.log('  page already moved');
  } else if (!rows.length) {
    throw new Error(`page not found at ${FROM.tagPath}/${FROM.slug}`);
  } else if (already.length) {
    throw new Error(`${TO.tagPath}/${TO.slug} already exists — refusing to clobber`);
  } else {
    const page = rows[0];
    const version = '4.0.0'; // major: the page's own URL changes
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}: ${FROM.tagPath} -> ${TO.tagPath}  v${page.version} -> v${version}`);
    if (!DRY) {
      const now = new Date().toISOString();
      await client.query('BEGIN');
      await client.query('UPDATE pages SET tag_path=$1, version=$2, updated_at=$3 WHERE id=$4',
        [TO.tagPath, version, now, page.id]);
      await client.query(
        `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [cuid(), page.id, JSON.stringify(page.content), page.title, version, 'major', AUTHOR_ID,
         'Moved from the Community section to contents/history. The Community section is being retired; this biography stays because its subject is a historical figure of the project rather than a living participant in it.', now]);
      await client.query('COMMIT');
    }
  }

  // ── Re-point every link that named the old path.
  const { rows: linkers } = await client.query(
    `SELECT id, tag_path, slug, title, version, content::text AS c
       FROM pages WHERE content::text LIKE $1 AND tag_path <> 'community'`,
    [`%${OLD_HREF}%`]);
  console.log(`\n  ${linkers.length} pages still link to ${OLD_HREF}`);
  for (const p of linkers) {
    const before = p.c;
    const after = before.split(OLD_HREF).join(NEW_HREF);
    const n = before.split(OLD_HREF).length - 1;
    console.log(`  ${DRY ? '[dry] ' : ''}${p.tag_path}/${p.slug || '(hub)'} — ${n} link${n === 1 ? '' : 's'}`);
    if (DRY) continue;
    const now = new Date().toISOString();
    const v = bump(p.version, 'patch');
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1::jsonb, version=$2, updated_at=$3 WHERE id=$4', [after, v, now, p.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), p.id, after, p.title, v, 'patch', AUTHOR_ID,
       `Re-pointed ${n} link${n === 1 ? '' : 's'} to the Dan Hughes biography, which moved from /community to /contents/history.`, now]);
    await client.query('COMMIT');
  }

  // ── The History hub had his birth year as 1974; the biography sources 1979.
  const { rows: hub } = await client.query(
    `SELECT id, title, version, content FROM pages WHERE tag_path = 'contents/history' AND slug = ''`);
  if (hub.length) {
    const h = hub[0];
    const blocks = JSON.parse(JSON.stringify(h.content));
    const target = blocks.find((b) => (b.text || '').includes('1974'));
    if (!target) {
      console.log('\n  History hub: birth year already corrected — no write');
    } else {
      const n = target.text.split('1974').length - 1;
      if (n !== 1) throw new Error(`History hub: expected 1 occurrence of 1974, found ${n}`);
      target.text = target.text.replace('1974', '1979');
      const hv = bump(h.version, 'patch');
      console.log(`\n  ${DRY ? '[dry] ' : ''}History of Radix: 1974 -> 1979  v${h.version} -> v${hv}`);
      if (!DRY) {
        const now = new Date().toISOString();
        const json = JSON.stringify(blocks);
        await client.query('BEGIN');
        await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, hv, now, h.id]);
        await client.query(
          `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [cuid(), h.id, json, h.title, hv, 'patch', AUTHOR_ID,
           'Corrected Dan Hughes’s birth year from 1974 to 1979. The biography records 24 July 1979 and a death aged 46 on 27 July 2025; 1974 is inconsistent with both.', now]);
        await client.query('COMMIT');
      }
    }
  }
  console.log(DRY ? '\ndry run complete — nothing written' : '\nmove complete');
} finally {
  client.release();
  await pool.end();
}
