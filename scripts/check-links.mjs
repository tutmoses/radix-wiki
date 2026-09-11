// scripts/check-links.mjs — Dead-link checker for the wiki-sweep routine.
//
// Enumerates pages (optionally filtered to a tag prefix), extracts every
// external link, every internal /path link and every embedded <iframe>/<img>,
// then verifies them:
//   - external: HTTP HEAD (falling back to GET) with a timeout
//   - internal: resolved against the set of live page paths in the DB
//   - externals: status-checked, except YouTube watch/youtu.be links, which go
//               through oEmbed for the same reason the embeds do (run 353)
//   - embeds:   status-checked, except YouTube embeds (whose /embed/ URL 200s
//               even for a private or deleted video) which are resolved via the
//               oEmbed endpoint instead, and JS widget shells whose 200 proves
//               nothing about the content behind them (reported unverifiable)
//
// Usage:
//   node scripts/check-links.mjs                       # whole wiki
//   node scripts/check-links.mjs contents/tech         # only this tag subtree
//   node scripts/check-links.mjs ecosystem --json      # machine-readable
//
// Prints a human summary to stdout and, with --json, the full report as JSON.

import { readdirSync } from 'fs';
import { config } from 'dotenv';
import { withClient } from './seed-utils.mjs';
// The probe engine is `wiki-formant/link-check`, shared with caper. Each repo
// had learned a different half of the same lesson — this one knew that npmjs
// 403s a script, that an expired cert is not a dead host and that a YouTube
// /embed/ URL 200s for a deleted video; caper's knew that a connect refusal is
// usually concurrency and that serialising per hostname is the fix. Both halves
// now apply on every run, in both repos.
import {
  YOUTUBE_EMBED,
  extractEmbeds as htmlEmbeds,
  extractLinks as htmlLinks,
  mapLimit,
  probeExternal,
  probeUrl,
  probeYouTube,
  unverifiableReason,
} from 'wiki-formant/link-check';

config({ path: new URL('../.env', import.meta.url) });

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const prefix = args.find((a) => !a.startsWith('--')) || '';
const CONCURRENCY = 12;

// Hosts that answer 200 with a JS loader shell regardless of whether the deck /
// store / dataset behind the query string still exists. A status check on these
// is meaningless, so report them as unverifiable rather than healthy. The list is
// this wiki's; the matcher is shared.
const UNVERIFIABLE_EMBED_HOSTS = new Map([
  ['radixrolodex.com', '630-byte module loader — 200 says nothing about the deck ID'],
  ['widgets.sociablekit.com', 'widget shell rendering only "Shopify Store" — 200 says nothing about the store ID'],
]);

// Routes parsePath() resolves without a backing page (src/lib/wiki.ts).
const STATIC_PATHS = ['/', '/leaderboard', '/welcome', '/rewards', '/search', '/maintenance', '/charts', '/charts/validators', '/charts/tokens',
  // Agent surface: real routes, not wiki pages, so they need declaring here or every
  // page that cites one is reported as a broken internal link (run 272).
  '/AGENTS.md'];

// Route handlers under src/app/ — /week-in-review.xml, /blog.xml, /llms.txt and
// friends are real URLs with no backing page row, so without this every page that
// cites one reads as a broken internal link (run 347: /week-in-review.xml was
// reported broken on eleven blog pages while the live feed answered 200). Read from
// disk like publicAssetPaths() so a new route resolves on its own. Conventional
// files that name their own output are mapped by hand — there are only three.
const CONVENTION_ROUTES = { 'sitemap.ts': '/sitemap.xml', 'robots.ts': '/robots.txt', 'manifest.ts': '/manifest.webmanifest' };

function appRoutePaths() {
  const dir = new URL('../src/app/', import.meta.url);
  const walk = (base, prefix = '') =>
    readdirSync(new URL(base, dir), { withFileTypes: true }).flatMap((e) => {
      if (e.isDirectory()) {
        // /api/* is machine surface, and a bracketed segment is a dynamic route
        // whose instances are pages, not fixed paths.
        if (e.name === 'api' || e.name.startsWith('[')) return [];
        return walk(`${base}${e.name}/`, `${prefix}${e.name}/`);
      }
      if (e.name === 'route.ts') return [`/${prefix}`.replace(/(.)\/$/, '$1')];
      return CONVENTION_ROUTES[e.name] && !prefix ? [CONVENTION_ROUTES[e.name]] : [];
    });
  try {
    return walk('');
  } catch {
    return [];
  }
}

// Files served straight out of public/ — /logo.png, /favicon.ico and friends are
// real URLs with no backing page row, so without this every page offering them for
// download reads as a broken internal link (run 278, /contents/resources/brand-assets).
// Read from disk rather than listed by hand so a new asset resolves on its own.
function publicAssetPaths() {
  const dir = new URL('../public/', import.meta.url);
  const walk = (base, prefix = '') =>
    readdirSync(new URL(base, dir), { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(`${base}${e.name}/`, `${prefix}${e.name}/`) : [`/${prefix}${e.name}`]);
  try {
    return walk('');
  } catch {
    return [];
  }
}

// Append-only historical records: their links point at where pages *were* when
// the entry was written. Rewriting them would falsify the log, so don't report them.
const LINK_ROT_EXEMPT = new Set(['/contents/tech/operations/wiki-maintenance-log']);

// An href/src is an HTML attribute, so `&` is stored escaped. Probe what a browser
// would request, not the literal attribute text — 116 URLs wiki-wide carry `&amp;`,
// and probing them raw turned query-sensitive APIs into false failures.
const ENTITIES = { amp: '&', '#38': '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" };
const decodeAttr = (s) => s.replace(/&(amp|lt|gt|quot|apos|#38|#39);/g, (_, e) => ENTITIES[e]);

// The two regexes are `wiki-formant/link-check` (`extractLinks` /
// `extractEmbeds`, on one HTML fragment). What stays here is the BLOCK WALK —
// this repo's container types — and the internal/external split, which depends
// on what counts as a path on this site.
function collectLinks(blocks, acc = { external: [], internal: [], embeds: [] }) {
  for (const block of blocks || []) {
    if (block?.type === 'content' && block.text) {
      for (const { href: raw } of htmlLinks(block.text)) {
        const href = decodeAttr(raw);
        if (href.startsWith('http')) acc.external.push(href);
        // Strip the trailing slash, but never down to the empty string: a bare "/"
        // is the homepage, which STATIC_PATHS declares as "/". Run 277 rewrote the
        // blog essays' absolute https://radix.wiki sign-offs to site-relative "/",
        // and every run since reported those 14 healthy anchors on 12 pages as one
        // broken internal link to "" (run 290).
        else if (href.startsWith('/')) acc.internal.push(href.split('#')[0].replace(/(.)\/$/, '$1'));
      }
      for (const { kind, url: rawSrc } of htmlEmbeds(block.text)) {
        const src = decodeAttr(rawSrc);
        if (src.startsWith('http')) acc.embeds.push({ kind, url: src });
      }
    }
    if (block?.type === 'infobox' && Array.isArray(block.blocks)) collectLinks(block.blocks, acc);
    if (block?.type === 'columns' && Array.isArray(block.columns)) {
      for (const col of block.columns) collectLinks(col.blocks, acc);
    }
  }
  return acc;
}

async function probeEmbed({ kind, url }) {
  const yt = url.match(YOUTUBE_EMBED);
  if (yt) return { kind, url, videoId: yt[1], ...(await probeYouTube(yt[1])) };

  const { status, ok, error, contentType, bytes } = await probeUrl(url);
  const unverifiable = ok ? unverifiableReason(url, UNVERIFIABLE_EMBED_HOSTS) : null;
  return { kind, url, status, ok, error, contentType, bytes, ...(unverifiable ? { unverifiable, reason: unverifiable } : {}) };
}

// Uploads are normalised by /api/upload (src/lib/images.ts), but seed scripts write
// straight to the DB and editors can paste a foreign URL, so images can still enter
// off-standard. Format isn't the signal — a handful of PNG/JPEGs are kept on purpose
// because re-encoding them came out larger — weight and host are.
const MAX_STANDARD_BYTES = 500 * 1024;

function imageDrift({ kind, url, ok, bytes }) {
  if (kind !== 'img' || !ok) return null;
  if (!/\.public\.blob\.vercel-storage\.com\//.test(url)) return 'hosted off-site — outside the standard and can rot without warning';
  if (bytes > MAX_STANDARD_BYTES) return `${(bytes / 1024).toFixed(0)}KB — over the ${MAX_STANDARD_BYTES / 1024}KB standard`;
  return null;
}

await withClient(async (client) => {
  const { rows } = await client.query(
    'SELECT slug, title, tag_path, content, updated_at FROM pages WHERE tag_path LIKE $1 ORDER BY updated_at ASC',
    [`${prefix}%`],
  );

  // Live link targets = every page, every category path that has pages beneath it
  // (derived from tag_path rather than parsed out of TAG_HIERARCHY, which is a
  // nested TS literal this .mjs cannot import), and the static routes parsePath
  // resolves outside the tag tree.
  const livePaths = new Set([...STATIC_PATHS, ...appRoutePaths(), ...publicAssetPaths()]);
  const { rows: allRows } = await client.query('SELECT slug, tag_path FROM pages');
  for (const r of allRows) {
    livePaths.add(`/${r.tag_path}/${r.slug}`);
    const segments = r.tag_path.split('/').filter(Boolean);
    for (let i = 1; i <= segments.length; i++) livePaths.add(`/${segments.slice(0, i).join('/')}`);
  }

  // Map each unique external URL -> pages that reference it; same for internal.
  const externalToPages = new Map();
  const internalToPages = new Map();
  const embedToPages = new Map();
  for (const row of rows) {
    const path = `/${row.tag_path}/${row.slug}`;
    if (LINK_ROT_EXEMPT.has(path)) continue;
    const blocks = Array.isArray(row.content) ? row.content : [];
    const { external, internal, embeds } = collectLinks(blocks);
    for (const u of new Set(external)) {
      if (!externalToPages.has(u)) externalToPages.set(u, []);
      externalToPages.get(u).push(path);
    }
    for (const u of new Set(internal)) {
      if (!internalToPages.has(u)) internalToPages.set(u, []);
      internalToPages.get(u).push(path);
    }
    for (const e of embeds) {
      if (!embedToPages.has(e.url)) embedToPages.set(e.url, { kind: e.kind, pages: [] });
      const entry = embedToPages.get(e.url);
      if (!entry.pages.includes(path)) entry.pages.push(path);
    }
  }

  const externalUrls = [...externalToPages.keys()];
  const results = await mapLimit(externalUrls, CONCURRENCY, probeExternal);
  // A 405 is the one status that proves the resource exists: the server routed the
  // request and rejected the method. The checker HEADs and GETs, so every POST-only
  // API endpoint the wiki cites answers 405 and got reported dead — the Gateway's
  // /status/gateway-status has been re-flagged on every developers rotation since
  // run 366 while the sweep itself POSTs it for readings. Re-probe those with POST.
  const methodRejected = results.filter((r) => !r.ok && r.status === 405);
  await mapLimit(methodRejected, CONCURRENCY, async (r) => {
    try {
      const res = await fetch(r.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        signal: AbortSignal.timeout(15000),
      });
      if (res.status < 400) { r.ok = true; r.postStatus = res.status; }
    } catch { /* leave it flagged */ }
  });
  const brokenExternal = results
    .filter((r) => !r.ok)
    .map((r) => ({ ...r, pages: externalToPages.get(r.url) }));

  const brokenInternal = [...internalToPages.entries()]
    .filter(([p]) => !livePaths.has(p))
    .map(([p, pages]) => ({ url: p, pages }));

  const embeds = [...embedToPages.entries()].map(([url, { kind }]) => ({ kind, url }));
  const embedResults = await mapLimit(embeds, CONCURRENCY, probeEmbed);
  const brokenEmbeds = embedResults
    .filter((r) => !r.ok)
    .map((r) => ({ ...r, pages: embedToPages.get(r.url).pages }));
  const unverifiableEmbeds = embedResults
    .filter((r) => r.ok && r.unverifiable)
    .map((r) => ({ ...r, pages: embedToPages.get(r.url).pages }));
  const nonStandardImages = embedResults
    .map((r) => ({ r, drift: imageDrift(r) }))
    .filter(({ drift }) => drift)
    .map(({ r, drift }) => ({ url: r.url, bytes: r.bytes, contentType: r.contentType, drift, pages: embedToPages.get(r.url).pages }));

  // Self-rotating refresh queue: least-recently-updated pages first.
  const pagesByStaleness = rows.map((r) => ({
    path: `/${r.tag_path}/${r.slug}`,
    title: r.title,
    updatedAt: r.updated_at,
  }));

  const report = {
    scope: prefix || '(entire wiki)',
    pagesScanned: rows.length,
    externalChecked: externalUrls.length,
    embedsChecked: embeds.length,
    brokenExternal,
    brokenInternal,
    brokenEmbeds,
    unverifiableEmbeds,
    nonStandardImages,
    pagesByStaleness,
    generatedAt: new Date().toISOString(),
  };

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`\nLink check — scope: ${report.scope}`);
    console.log(
      `Pages scanned: ${report.pagesScanned} | external links checked: ${report.externalChecked} | embeds checked: ${report.embedsChecked}`,
    );
    console.log(`\nBroken external (${brokenExternal.length}):`);
    for (const b of brokenExternal) console.log(`  [${b.status || b.error}] ${b.url}\n      ← ${b.pages.join(', ')}`);
    console.log(`\nBroken internal (${brokenInternal.length}):`);
    for (const b of brokenInternal) console.log(`  ${b.url}\n      ← ${b.pages.join(', ')}`);
    console.log(`\nBroken embeds (${brokenEmbeds.length}):`);
    for (const b of brokenEmbeds) {
      const why = b.reason ? `${b.status} ${b.reason}` : b.status || b.error;
      console.log(`  <${b.kind}> [${why}] ${b.url}\n      ← ${b.pages.join(', ')}`);
    }
    console.log(`\nUnverifiable embeds (${unverifiableEmbeds.length}) — 200 proves nothing, check by hand:`);
    for (const b of unverifiableEmbeds) console.log(`  <${b.kind}> ${b.url}\n      ${b.reason}\n      ← ${b.pages.join(', ')}`);
    console.log(`\nImages off-standard (${nonStandardImages.length}):`);
    for (const b of nonStandardImages) console.log(`  ${b.drift}\n      ${b.url}\n      ← ${b.pages.join(', ')}`);
    console.log(`\nStalest pages (refresh oldest first):`);
    for (const p of pagesByStaleness.slice(0, 8)) console.log(`  ${String(p.updatedAt).slice(0, 10)}  ${p.path}`);
    console.log('');
  }
});
