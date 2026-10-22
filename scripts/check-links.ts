// scripts/check-links.ts — dead-link checker for the sweep routine.
//
// Enumerates pages (optionally filtered to a tag prefix), extracts every
// external link, every internal /path link and every embedded <iframe>/<img>,
// then verifies them: externals and embeds by probe, internals against the
// live page paths, the app's routes and the public assets. The walk and the
// probe are `wiki-formant/link-check`; what stays here is what only this wiki
// knows: which embed hosts answer 200 for anything, what an image should weigh
// and where it should live, and which page is exempt.
//
//   node scripts/check-links.ts                       # whole wiki
//   node scripts/check-links.ts contents/tech         # only this tag subtree
//   node scripts/check-links.ts ecosystem --json      # machine-readable

import { readdirSync } from 'node:fs';
import { auditLinks, mapLimit, printLinkAudit, probeExternal, unverifiableReason } from 'wiki-formant/link-check';
import { withClient } from './wiki-utils.ts';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const prefix = args.find(a => !a.startsWith('--')) || '';
const CONCURRENCY = 12;

const UNVERIFIABLE_EMBED_HOSTS = new Map([
  ['radixrolodex.com', '630-byte module loader — 200 says nothing about the deck ID'],
  ['widgets.sociablekit.com', 'widget shell rendering only "Shopify Store" — 200 says nothing about the store ID'],
]);

const STATIC_PATHS = ['/', '/leaderboard', '/welcome', '/rewards', '/search', '/maintenance', '/charts', '/charts/validators', '/charts/tokens', '/AGENTS.md'];
const CONVENTION_ROUTES: Record<string, string> = { 'sitemap.ts': '/sitemap.xml', 'robots.ts': '/robots.txt', 'manifest.ts': '/manifest.webmanifest' };
const LINK_ROT_EXEMPT = new Set(['/contents/tech/operations/wiki-maintenance-log']);
const MAX_STANDARD_BYTES = 500 * 1024;

const walk = (dir: URL, keep: (name: string, prefix: string) => string[], base = '', prefix = ''): string[] => {
  try {
    return readdirSync(new URL(base, dir), { withFileTypes: true }).flatMap(e =>
      e.isDirectory()
        ? e.name === 'api' || e.name.startsWith('[') ? [] : walk(dir, keep, `${base}${e.name}/`, `${prefix}${e.name}/`)
        : keep(e.name, prefix),
    );
  } catch {
    return [];
  }
};
const appRoutePaths = () =>
  walk(new URL('../src/app/', import.meta.url), (name, prefix) =>
    name === 'route.ts' ? [`/${prefix}`.replace(/(.)\/$/, '$1')] : CONVENTION_ROUTES[name] && !prefix ? [CONVENTION_ROUTES[name]!] : [],
  );
const publicAssetPaths = () => walk(new URL('../public/', import.meta.url), (name, prefix) => [`/${prefix}${name}`]);

type Embed = { kind: string; url: string };
async function probeEmbed({ kind, url }: Embed) {
  const probe = await probeExternal(url);
  const unverifiable = probe.ok ? unverifiableReason(url, UNVERIFIABLE_EMBED_HOSTS) : null;
  return { kind, ...probe, ...(unverifiable ? { unverifiable, reason: unverifiable } : {}) };
}

function imageDrift({ kind, url, ok, bytes }: { kind: string; url: string; ok: boolean; bytes?: number }): string | null {
  if (kind !== 'img' || !ok) return null;
  if (!/\.public\.blob\.vercel-storage\.com\//.test(url)) return 'hosted off-site — outside the standard and can rot without warning';
  if ((bytes ?? 0) > MAX_STANDARD_BYTES) return `${((bytes ?? 0) / 1024).toFixed(0)}KB — over the ${MAX_STANDARD_BYTES / 1024}KB standard`;
  return null;
}

type Row = { slug: string; title: string; tag_path: string; content: unknown; metadata: unknown; updated_at: string };

await withClient(async client => {
  const { rows } = (await client.query(
    `SELECT slug, title, "tagPath" AS tag_path, content, metadata, "updatedAt" AS updated_at FROM "WikiPage" WHERE "siteId" = '' AND "tagPath" LIKE $1 ORDER BY "updatedAt" ASC`,
    [`${prefix}%`],
  )) as { rows: Row[] };

  const livePaths = new Set([...STATIC_PATHS, ...appRoutePaths(), ...publicAssetPaths()]);
  const { rows: allRows } = (await client.query(`SELECT slug, "tagPath" AS tag_path FROM "WikiPage" WHERE "siteId" = ''`)) as { rows: Row[] };
  for (const r of allRows) {
    livePaths.add(`/${r.tag_path}/${r.slug}`);
    const segments = r.tag_path.split('/').filter(Boolean);
    for (let i = 1; i <= segments.length; i++) livePaths.add(`/${segments.slice(0, i).join('/')}`);
  }

  const pages = rows.map(row => ({ path: `/${row.tag_path}/${row.slug}`, content: row.content, metadata: row.metadata })).filter(p => !LINK_ROT_EXEMPT.has(p.path));
  const audit = await auditLinks(pages, { livePaths, concurrency: CONCURRENCY });

  // A 405 is a host that answers POST alone; one that still 404s is gone.
  const methodRejected = audit.brokenExternal.filter(r => r.status === 405);
  await mapLimit(methodRejected, CONCURRENCY, async r => {
    try {
      const res = await fetch(r.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(15000) });
      if (res.status !== 404 && res.status !== 410) r.ok = true;
    } catch { /* leave it flagged */ }
  });
  const brokenExternal = audit.brokenExternal.filter(r => !r.ok);

  const embeds = [...audit.embeds.entries()].map(([url, { kind }]) => ({ kind, url }));
  const embedResults = await mapLimit(embeds, CONCURRENCY, probeEmbed);
  const pagesOf = (url: string) => audit.embeds.get(url)!.pages;
  const brokenEmbeds = embedResults.filter(r => !r.ok).map(r => ({ ...r, pages: pagesOf(r.url) }));
  const unverifiableEmbeds = embedResults.filter(r => r.ok && r.unverifiable).map(r => ({ ...r, pages: pagesOf(r.url) }));
  const nonStandardImages = embedResults
    .map(r => ({ r, drift: imageDrift(r) }))
    .filter(({ drift }) => drift)
    .map(({ r, drift }) => ({ url: r.url, bytes: r.bytes, contentType: r.contentType, drift, pages: pagesOf(r.url) }));

  const pagesByStaleness = rows.map(r => ({ path: `/${r.tag_path}/${r.slug}`, title: r.title, updatedAt: r.updated_at }));

  const report = {
    scope: prefix || '(entire wiki)',
    pagesScanned: rows.length,
    externalChecked: audit.externalChecked,
    embedsChecked: embeds.length,
    brokenExternal,
    brokenInternal: audit.brokenInternal,
    brokenEmbeds,
    unverifiableEmbeds,
    nonStandardImages,
    pagesByStaleness,
    generatedAt: new Date().toISOString(),
  };

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  printLinkAudit({ ...audit, brokenExternal }, { scope: report.scope, pagesScanned: rows.length });
  console.log(`Embeds checked: ${embeds.length}`);
  console.log(`\nBroken embeds (${brokenEmbeds.length}):`);
  for (const b of brokenEmbeds) console.log(`  <${b.kind}> [${b.reason ? `${b.status} ${b.reason}` : b.status || b.error}] ${b.url}\n      ← ${b.pages.join(', ')}`);
  console.log(`\nUnverifiable embeds (${unverifiableEmbeds.length}) — 200 proves nothing, check by hand:`);
  for (const b of unverifiableEmbeds) console.log(`  <${b.kind}> ${b.url}\n      ${b.reason}\n      ← ${b.pages.join(', ')}`);
  console.log(`\nImages off-standard (${nonStandardImages.length}):`);
  for (const b of nonStandardImages) console.log(`  ${b.drift}\n      ${b.url}\n      ← ${b.pages.join(', ')}`);
  console.log(`\nStalest pages (refresh oldest first):`);
  for (const p of pagesByStaleness.slice(0, 8)) console.log(`  ${String(p.updatedAt).slice(0, 10)}  ${p.path}`);
  console.log('');
});
