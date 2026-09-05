// scripts/seed-utils.mjs — shared plumbing for the wiki's database scripts.

import pg from 'pg';
import { randomUUID, randomBytes } from 'crypto';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { config } from 'dotenv';
import { bump } from 'wiki-formant/versioning';
config();

export const uid = () => randomUUID();
export const cuid = () => 'c' + randomBytes(12).toString('hex').slice(0, 24);
export const AUTHOR_ID = 'cmk5t48vx0000005zc5se4dqz';

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** pages.metadata is jsonb and can be null; every caller wants an object. */
export const meta = (row) => (row?.metadata && typeof row.metadata === 'object' ? row.metadata : {});
export const argOf = (flag) => { const i = process.argv.indexOf(flag); return i >= 0 ? process.argv[i + 1] : null; };

/** The Sunday that ends a week, so the ledger, the repositories and the recap key alike. */
export function weekKey(iso) {
  const d = iso ? new Date(`${iso}T00:00:00Z`) : new Date();
  const sunday = new Date(d);
  sunday.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return sunday.toISOString().slice(0, 10);
}

// `blank` is what an absent reading prints: a dash in prose, nothing at all in an
// SVG figure, where a stray dash reads as a value.
export const fmt = (n, digits = 0, blank = '—') =>
  n == null || !isFinite(n) ? blank : n.toLocaleString('en-US', { maximumFractionDigits: digits });

export function compact(n, blank = '—') {
  if (n == null || !isFinite(n)) return blank;
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return fmt(n, 0, blank);
}

/** Never invent a comparison: an absent or stale prior reading yields no delta at all. */
export function delta(now, was, { percent = true, staleDays = 10, gapDays = 0 } = {}) {
  if (was == null || now == null || !isFinite(was) || !isFinite(now) || was === 0) return '';
  if (gapDays > staleDays) return '';
  const diff = now - was;
  if (diff === 0) return 'no change';
  const sign = diff > 0 ? '+' : '−';
  const mag = Math.abs(diff);
  return percent
    ? `${sign}${((mag / Math.abs(was)) * 100).toFixed(1)}%`
    : `${sign}${compact(mag)}`;
}

// Locked pages must never be written by scripts. src/lib/tags.ts is the single
// source of truth (isLockedPage guards the API path); we parse the LOCKED_PAGES
// literal from it at runtime so this list can't drift out of sync. Direct-DB
// seed/update scripts bypass the app-layer guard, so they must call isLockedPage
// before writing (insertPages does this automatically).
const _lockedPages = () => {
  try {
    const tagsPath = resolve(dirname(fileURLToPath(import.meta.url)), '../src/lib/tags.ts');
    const src = readFileSync(tagsPath, 'utf8');
    const m = src.match(/LOCKED_PAGES\s*=\s*new Set\(\[([^\]]*)\]/);
    if (!m) return new Set();
    return new Set([...m[1].matchAll(/['"`]([^'"`]+)['"`]/g)].map((x) => x[1]));
  } catch {
    return new Set();
  }
};
export const LOCKED_PAGES = _lockedPages();
export const isLockedPage = (tagPath, slug) => LOCKED_PAGES.has(`${tagPath}/${slug}`);

/**
 * Run `fn` against a connected client, then release the client and the pool.
 * A throw rolls back whatever transaction was open and fails the process — every
 * one of these scripts writes to the live database, so a half-applied edit must
 * never be left behind and must never look like a success.
 */
export async function withClient(fn) {
  const { Pool } = pg;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    return await fn(client);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

/**
 * Insert or replace a `data-graphic="<marker>"` figure block on a loaded page row,
 * writing one revision when it changes. Idempotent: html identical to what is
 * already stored is not rewritten. `place(blocks)` chooses where a new block goes
 * and defaults to the end. Returns `{ action, version, blocks }`, or null when the
 * page already carries exactly this figure.
 */
export async function embedFigure(client, page, { marker, html, place, message, dry }) {
  const blocks = Array.isArray(page.content) ? JSON.parse(JSON.stringify(page.content)) : [];
  const has = (b) => b.type === 'content' && typeof b.text === 'string' && b.text.includes(`data-graphic="${marker}"`);
  const at = blocks.findIndex(has);

  let action;
  if (at >= 0) {
    if (blocks[at].text === html) return null;
    blocks[at] = { ...blocks[at], text: html };
    action = `replaced [${at}]`;
  } else {
    const pos = place ? place(blocks) : blocks.length;
    blocks.splice(pos, 0, { id: uid(), type: 'content', text: html });
    action = pos === blocks.length - 1 ? `appended [${pos}]` : `inserted [${pos}]`;
  }

  const version = bump(page.version, 'minor');
  if (!dry) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content = $1, version = $2, updated_at = $3 WHERE id = $4',
      [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,'minor',$6,$7,$8)`,
      [cuid(), page.id, json, page.title, version, AUTHOR_ID, message, now]);
    await client.query('COMMIT');
  }
  return { action, version, blocks };
}

/**
 * Insert pages into the database, skipping duplicates.
 * @param {Array} pages - Array of { slug, title, content, metadata?, tagPath? }
 * @param {string} defaultTagPath - Fallback tag path if page.tagPath is not set
 * @param {string} [revisionMessage='Initial page'] - Revision message
 */
export async function insertPages(pages, defaultTagPath, revisionMessage = 'Initial page') {
  await withClient(async (client) => {
    let inserted = 0, skipped = 0;
    for (const page of pages) {
      const tagPath = page.tagPath || defaultTagPath;
      if (isLockedPage(tagPath, page.slug)) {
        console.warn(`SKIP ${tagPath}/${page.slug} — locked page (LOCKED_PAGES in src/lib/tags.ts)`);
        skipped++;
        continue;
      }
      const existing = await client.query(
        'SELECT id FROM pages WHERE tag_path = $1 AND slug = $2',
        [tagPath, page.slug],
      );
      if (existing.rows.length > 0) { skipped++; continue; }

      const id = cuid();
      const now = new Date().toISOString();

      await client.query('BEGIN');

      await client.query(
        `INSERT INTO pages (id, slug, title, content, tag_path, metadata, version, author_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
        [id, page.slug, page.title, JSON.stringify(page.content), tagPath, JSON.stringify(page.metadata || {}), '1.0.0', AUTHOR_ID, now],
      );

      await client.query(
        `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [cuid(), id, JSON.stringify(page.content), page.title, '1.0.0', 'major', AUTHOR_ID, revisionMessage, now],
      );

      await client.query('COMMIT');
      inserted++;
    }
    console.log(`Done. Inserted: ${inserted}, Skipped: ${skipped}`);
  });
}
