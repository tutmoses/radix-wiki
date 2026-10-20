// scripts/seed-utils.mjs — shared plumbing for the wiki's database scripts.

import pg from 'pg';
import { randomUUID } from 'crypto';
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { bump } from 'wiki-formant/versioning';
import { wikiStore } from 'wiki-formant/store';
import { validateLinkGroups, validateReferenceItems } from 'wiki-formant/validation';
try { process.loadEnvFile(); } catch {} // the .env in the working directory, if there is one

export const uid = () => randomUUID();
export const AUTHOR_ID = 'cmk5t48vx0000005zc5se4dqz';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** "WikiPage".metadata is jsonb; every caller wants an object. */
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
    const tagsPath = resolve(ROOT, 'src/lib/tags.ts');
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
 * Refuse block content whose URL-bearing leaves are mis-shaped, before it reaches
 * the database.
 *
 * The app's `validateBlocks` already rejects exactly this, and it is the reason
 * the defect only ever arrives by this route: it lives in
 * `src/lib/block-utils.ts`, and no `.mjs` script can import a TypeScript module,
 * so every direct-DB write skips it. The two leaf validators underneath it ship
 * compiled in the package, and they cover the half that fails silently --
 * `LinkGridView` and `ReferencesView` DROP an entry whose URL fails
 * `safeLinkHref` rather than rendering it inert, so a one-field slip
 * (`{ label, url }` for a link, whose real shape is `{ label, href }`) shows up
 * as a group heading with no pills and nothing anywhere reports it.
 *
 * Throws rather than returning false: `withClient` turns a throw into a rollback
 * and a non-zero exit, and a script that skips a page quietly is how this reached
 * five published issues before anyone looked at one.
 */
export function assertLinkShapes(blocks, where = 'content') {
  const bad = [];
  const leaf = (b, path) => {
    if (!b || typeof b !== 'object') return;
    if (b.type === 'linkGrid')
      for (const [gi, g] of (b.groups || []).entries())
        for (const [li, l] of (g?.links || []).entries())
          if (!validateLinkGroups([{ id: '', heading: '', links: [l] }]))
            bad.push(`${path}.groups[${gi}].links[${li}] "${l?.label ?? '(no label)'}" `
              + `has fields {${Object.keys(l || {}).sort().join(', ')}} -- LinkGridLink is { label, href }`);
    if (b.type === 'references' && !validateReferenceItems(b.items))
      bad.push(`${path}.items -- ReferenceItem is { id, text, url? }`);
  };
  (blocks || []).forEach((b, i) => {
    leaf(b, `[${i}]`);
    if (b?.type === 'infobox') (b.blocks || []).forEach((n, j) => leaf(n, `[${i}].blocks[${j}]`));
    if (b?.type === 'columns') (b.columns || []).forEach((c, ci) =>
      (c?.blocks || []).forEach((n, j) => leaf(n, `[${i}].columns[${ci}].blocks[${j}]`)));
  });
  if (bad.length) throw new Error(`${where}: ${bad.length} mis-shaped link(s)\n  ` + bad.join('\n  '));
}

/**
 * Run `fn` against a connected client, then release the client and the pool.
 * A throw rolls back whatever transaction was open and fails the process — every
 * one of these scripts writes to the live database, so a half-applied edit must
 * never be left behind and must never look like a success.
 *
 * A run that wrote anything ends by invalidating the `wiki` cache tag. Pages
 * revalidate daily and the app's own write routes call `revalidateTag('wiki')`;
 * a script bypasses those routes, so without this its edit stays stale for a day.
 */
export async function withClient(fn) {
  const { Pool } = pg;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  let wrote = false;
  const query = client.query.bind(client);
  client.query = (sql, ...rest) => {
    // Anywhere in the text: the store's writes are data-modifying CTEs, `WITH up AS (UPDATE …`.
    if (/\b(insert\s+into|update\s+\S+\s+set|delete\s+from)\b/i.test(typeof sql === 'string' ? sql : sql?.text ?? '')) wrote = true;
    return query(sql, ...rest);
  };
  try {
    return await fn(client);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
    // In finally: a run that throws part-way may already have committed earlier writes.
    if (wrote) invalidateWikiCache();
  }
}

/** Mark every page and query cached under `wiki` stale on production (the linked project). */
function invalidateWikiCache() {
  try {
    execFileSync('vercel', ['cache', 'invalidate', '--tag', 'wiki', '--yes'], { cwd: ROOT, stdio: 'ignore' });
    console.log('cache: wiki tag invalidated');
  } catch (e) {
    console.warn(`cache: wiki tag NOT invalidated (${e.message}); run \`vercel cache invalidate --tag wiki\``);
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

  const version = await writeRevision(client, page, blocks, { message, dry });
  return { action, version, blocks };
}

/** The app's own store (`wiki-formant/store`) over a script's client, so a script writes exactly what the editor writes. */
export const storeFor = (client) => wikiStore({ sql: async (q, ...v) => (await client.query(q, v)).rows });

/** A page row by path, every column: what `writeRevision` and `embedFigure` take. Null when there is none. */
export const readPage = (client, tagPath, slug) => storeFor(client).get(tagPath, slug);

/**
 * Write edited blocks back to a page row from `readPage` as one revision, through
 * the store: the page and its revision in one statement, the version bumped from
 * the stored one by `change`, which is also the revision's change type. The save
 * names the version it read, so an edit landing in between is refused (409)
 * instead of overwritten. `verified` stamps `lastVerifiedAt` too, for an edit that
 * re-checked the page's facts. `dry` writes nothing. Returns the new version.
 */
export async function writeRevision(client, page, blocks, { change = 'minor', message, verified = false, dry = false, metadata }) {
  if (dry) return bump(page.version, change);
  assertLinkShapes(blocks, page.title);
  const { page: saved } = await storeFor(client).save({
    tagPath: page.tagPath, slug: page.slug, content: blocks, metadata,
    change, message, verified, authorId: AUTHOR_ID, baseVersion: page.version,
  });
  return saved.version;
}

/**
 * Insert pages into the database, skipping duplicates.
 * @param {Array} pages - Array of { slug, title, content, metadata?, tagPath? }
 * @param {string} defaultTagPath - Fallback tag path if page.tagPath is not set
 * @param {string} [revisionMessage='Initial page'] - Revision message
 */
export async function insertPages(pages, defaultTagPath, revisionMessage = 'Initial page') {
  await withClient(async (client) => {
    const store = storeFor(client);
    let inserted = 0, skipped = 0;
    for (const page of pages) {
      const tagPath = page.tagPath || defaultTagPath;
      if (isLockedPage(tagPath, page.slug)) {
        console.warn(`SKIP ${tagPath}/${page.slug} — locked page (LOCKED_PAGES in src/lib/tags.ts)`);
        skipped++;
        continue;
      }
      if (await store.get(tagPath, page.slug)) { skipped++; continue; }
      assertLinkShapes(page.content, `${tagPath}/${page.slug}`);
      await store.save({
        tagPath, slug: page.slug, title: page.title, content: page.content,
        metadata: page.metadata || {}, authorId: AUTHOR_ID, message: revisionMessage,
      });
      inserted++;
    }
    console.log(`Done. Inserted: ${inserted}, Skipped: ${skipped}`);
  });
}
