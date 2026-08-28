// scripts/standardize-images.mjs — Bring every image on the wiki to one standard,
// rewrite every reference to it (current pages AND revision history), then delete
// the superseded blobs.
//
// Standard: max 1600px wide (the prose column is ~800px, so 2x covers retina),
// WebP, quality 80 for photographs / 90 for PNG sources whose text would smear.
// src/lib/images.ts is the canonical definition — it enforces this on every
// upload. The values are mirrored here because a .mjs script can't import TS;
// change them there first, then here.
//
// Blob URLs are referenced from four places — all four are rewritten:
//   pages.content, pages.banner_image, revisions.content, revisions.changes
// Rewriting revision history is what makes deletion safe: once no row anywhere
// points at an old blob, nothing can render it, so it can go.
//
// Deletion rule: a blob is deleted iff, after the rewrite, no DB row references
// it. That covers both the originals this run supersedes and blobs orphaned by
// earlier passes. Verified by re-scanning the DB before a single delete is issued.
//
// Images sharp cannot decode are left completely alone — still referenced, so
// never deleted. Externally-hosted images are pulled in and standardised too.
//
// This pass deliberately does NOT create revisions or touch updated_at: the image
// is the same image, and 348 mechanical revisions would bury the real history.
//
// Usage:
//   node scripts/standardize-images.mjs           # dry run: encode in memory, report, touch nothing
//   node scripts/standardize-images.mjs --apply   # upload, rewrite, then delete unreferenced blobs
//   node scripts/standardize-images.mjs --apply --keep-blobs   # rewrite but skip the deletion phase

import pg from 'pg';
import sharp from 'sharp';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { randomUUID } from 'crypto';
import { put, list, del } from '@vercel/blob';
import { config } from 'dotenv';

config({ path: new URL('../.env', import.meta.url) });

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const keepBlobs = args.includes('--keep-blobs');
const MAX_WIDTH = 1600;
const MIN_SAVING = 0.05; // re-encoding costs a blob; only swap when it actually pays

if (apply && !process.env.BLOB_READ_WRITE_TOKEN) {
  console.error('BLOB_READ_WRITE_TOKEN is not set — cannot upload or delete.');
  process.exit(1);
}

const mb = (n) => `${(n / 1048576).toFixed(2)} MB`;
const BLOB_RE = /https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/[^"'\\\s)<>]+/gi;
const IMG_SRC_RE = /<img\b[^>]*?src="(https?:[^"]+)"/gi;

/** Every blob URL referenced anywhere in the DB. The deletion allowlist derives from this. */
async function referencedUrls(client) {
  const found = new Set();
  for (const q of [
    'SELECT content::text AS t FROM pages',
    'SELECT banner_image AS t FROM pages',
    'SELECT content::text AS t FROM revisions',
    'SELECT changes::text AS t FROM revisions',
  ]) {
    const { rows } = await client.query(q);
    for (const r of rows) if (r.t) for (const m of String(r.t).matchAll(BLOB_RE)) found.add(m[0]);
  }
  return found;
}

/** Decode via macOS Image I/O — sharp's bundled libheif rejects many real AVIFs. */
function systemDecode(buf) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'img-'));
  try {
    const inFile = path.join(dir, 'in');
    const outFile = path.join(dir, 'out.png');
    fs.writeFileSync(inFile, buf);
    execFileSync('sips', ['-s', 'format', 'png', inFile, '--out', outFile], { stdio: 'ignore' });
    return fs.readFileSync(outFile);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function standardise(buf) {
  let meta = await sharp(buf).metadata().catch(() => null);
  const sourceFormat = meta?.format ?? 'unknown';
  if (meta?.pages && meta.pages > 1) return { skip: 'animated' };
  if (meta?.format === 'webp' && meta.width <= MAX_WIDTH) return { skip: 'already conforming' };

  // libheif fails at pixel-decode time even when metadata() succeeded, so AVIF
  // never goes down the sharp path — it decodes through the OS first.
  let source = buf;
  if (!meta?.width || sourceFormat === 'heif' || sourceFormat === 'avif') {
    try {
      source = systemDecode(buf);
      meta = await sharp(source).metadata();
    } catch (err) {
      return { skip: `undecodable (${err.message.split('\n')[0].slice(0, 40)})` };
    }
  }
  if (!meta?.width) return { skip: 'undecodable' };

  const pipeline = sharp(source).rotate();
  if (meta.width > MAX_WIDTH) pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true });
  // Quality keys off the ORIGINAL format: a PNG-sourced screenshot needs the
  // higher floor, and after a system decode everything looks like a PNG.
  const out = await pipeline.webp({ quality: sourceFormat === 'png' ? 90 : 80, effort: 6 }).toBuffer();
  return { out, meta: { ...meta, format: sourceFormat } };
}

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  // ---- Phase 1: inventory -------------------------------------------------
  const referenced = await referencedUrls(client);
  // Walk the parsed JSON rather than content::text — in the text form the HTML
  // attribute quotes are backslash-escaped, so a src="…" regex silently matches
  // nothing and every external image looks like it doesn't exist.
  const external = new Set();
  {
    const { rows } = await client.query('SELECT content, banner_image FROM pages');
    const walk = (blocks) => {
      for (const b of blocks || []) {
        if (typeof b?.text === 'string') {
          let m;
          while ((m = IMG_SRC_RE.exec(b.text)) !== null) if (!/blob\.vercel-storage\.com/.test(m[1])) external.add(m[1]);
          IMG_SRC_RE.lastIndex = 0;
        }
        if (Array.isArray(b?.blocks)) walk(b.blocks);
        if (Array.isArray(b?.columns)) for (const col of b.columns) walk(col.blocks);
      }
    };
    for (const r of rows) {
      walk(r.content);
      if (r.banner_image?.startsWith('http') && !/blob\.vercel-storage\.com/.test(r.banner_image)) external.add(r.banner_image);
    }
  }
  const targets = [...referenced, ...external];
  console.log(`Referenced blob images: ${referenced.size}   externally-hosted images: ${external.size}`);
  console.log(`\nStandardising to ≤${MAX_WIDTH}px WebP…`);

  // ---- Phase 2: encode + upload ------------------------------------------
  const replacements = new Map();
  const skipped = [];
  let before = 0;
  let after = 0;

  for (const url of targets) {
    if (/\.svg(\?|$)/i.test(url)) { skipped.push(`svg — ${url.slice(-46)}`); continue; }
    let buf;
    try {
      const res = await fetch(url);
      if (!res.ok) { skipped.push(`HTTP ${res.status} — ${url.slice(-46)}`); continue; }
      buf = Buffer.from(await res.arrayBuffer());
    } catch (err) {
      skipped.push(`${err.message} — ${url.slice(-46)}`);
      continue;
    }

    let result;
    try {
      result = await standardise(buf);
    } catch (err) {
      skipped.push(`sharp: ${err.message.split('\n')[0]} — ${url.slice(-46)}`);
      continue;
    }
    if (result.skip) { skipped.push(`${result.skip} — ${url.slice(-46)}`); continue; }

    const saving = 1 - result.out.length / buf.length;
    if (saving < MIN_SAVING) { skipped.push(`only ${(saving * 100).toFixed(0)}% smaller — ${url.slice(-46)}`); continue; }

    before += buf.length;
    after += result.out.length;
    console.log(`  ${mb(buf.length).padStart(8)} → ${mb(result.out.length).padStart(8)}  ${result.meta.format} ${result.meta.width}px → webp ${Math.min(result.meta.width, MAX_WIDTH)}px`);

    if (!apply) { replacements.set(url, '<pending>'); continue; }
    const blob = await put(`${randomUUID()}.webp`, result.out, { access: 'public', addRandomSuffix: false, contentType: 'image/webp' });
    replacements.set(url, blob.url);
  }

  console.log(`\n${replacements.size} images standardised: ${mb(before)} → ${mb(after)}  (saved ${mb(before - after)})`);
  console.log(`${skipped.length} left as-is:`);
  for (const s of skipped) console.log(`  · ${s}`);

  if (!apply) {
    console.log('\nDry run — re-run with --apply to upload, rewrite and delete.');
  } else {
    // ---- Phase 3: rewrite every reference ---------------------------------
    // updated_at is deliberately left alone: this is a media swap, not an edit,
    // and bumping it would reorder every recency-driven feed on the site.
    console.log('\nRewriting references…');
    const swap = (text) => {
      let out = text;
      for (const [oldUrl, newUrl] of replacements) if (out.includes(oldUrl)) out = out.split(oldUrl).join(newUrl);
      return out;
    };
    let pagesUpdated = 0;
    let revisionsUpdated = 0;

    const { rows: pages } = await client.query('SELECT id, content::text AS content, banner_image FROM pages');
    for (const p of pages) {
      const content = swap(p.content);
      const banner = p.banner_image ? swap(p.banner_image) : p.banner_image;
      if (content === p.content && banner === p.banner_image) continue;
      await client.query('UPDATE pages SET content = $1::jsonb, banner_image = $2 WHERE id = $3', [content, banner, p.id]);
      pagesUpdated++;
    }

    const { rows: revs } = await client.query('SELECT id, content::text AS content, changes::text AS changes FROM revisions');
    for (const r of revs) {
      const content = swap(r.content);
      const changes = r.changes ? swap(r.changes) : r.changes;
      if (content === r.content && changes === r.changes) continue;
      await client.query('UPDATE revisions SET content = $1::jsonb, changes = $2::jsonb WHERE id = $3', [content, changes, r.id]);
      revisionsUpdated++;
    }
    console.log(`  ${pagesUpdated} pages, ${revisionsUpdated} revisions rewritten`);

    // ---- Phase 4: verify before destroying anything -----------------------
    const stillReferenced = await referencedUrls(client);
    const leaked = [...replacements.keys()].filter((u) => stillReferenced.has(u));
    if (leaked.length) {
      console.error(`\nABORTING DELETION — ${leaked.length} superseded URLs are still referenced:`);
      for (const l of leaked.slice(0, 10)) console.error(`  ${l}`);
      process.exitCode = 1;
    } else if (keepBlobs) {
      console.log('\n--keep-blobs set — skipping deletion.');
    } else {
      // ---- Phase 5: delete every blob nothing points at -------------------
      let cursor;
      const stored = new Map();
      do {
        const res = await list({ cursor, limit: 1000 });
        for (const b of res.blobs) stored.set(b.url, b.size);
        cursor = res.cursor;
      } while (cursor);

      const doomed = [...stored.keys()].filter((u) => !stillReferenced.has(u));
      const freed = doomed.reduce((a, u) => a + stored.get(u), 0);
      console.log(`\nStorage: ${stored.size} blobs. Referenced: ${stored.size - doomed.length}. Deleting ${doomed.length} unreferenced (${mb(freed)})…`);
      for (let i = 0; i < doomed.length; i += 100) {
        await del(doomed.slice(i, i + 100));
        console.log(`  deleted ${Math.min(i + 100, doomed.length)}/${doomed.length}`);
      }
      console.log(`\nDone: ${mb(freed)} freed, ${stored.size - doomed.length} blobs remain.`);
    }
  }
} finally {
  client.release();
  await pool.end();
}
