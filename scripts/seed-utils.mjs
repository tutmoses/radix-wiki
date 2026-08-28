// scripts/seed-utils.mjs — Shared utilities for wiki seed scripts

import pg from 'pg';
import { randomUUID, randomBytes } from 'crypto';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { config } from 'dotenv';
config();

export const uid = () => randomUUID();
export const cuid = () => 'c' + randomBytes(12).toString('hex').slice(0, 24);
export const AUTHOR_ID = 'cmk5t48vx0000005zc5se4dqz';

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
 * Insert pages into the database, skipping duplicates.
 * @param {Array} pages - Array of { slug, title, content, metadata?, tagPath? }
 * @param {string} defaultTagPath - Fallback tag path if page.tagPath is not set
 * @param {string} [revisionMessage='Initial page'] - Revision message
 */
export async function insertPages(pages, defaultTagPath, revisionMessage = 'Initial page') {
  const { Pool } = pg;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  let inserted = 0, skipped = 0;

  try {
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
      const revId = cuid();
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
        [revId, id, JSON.stringify(page.content), page.title, '1.0.0', 'major', AUTHOR_ID, revisionMessage, now],
      );

      await client.query('COMMIT');
      inserted++;
    }
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  console.log(`Done. Inserted: ${inserted}, Skipped: ${skipped}`);
  await pool.end();
}
