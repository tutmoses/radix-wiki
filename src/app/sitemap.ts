// src/app/sitemap.ts

import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma/client';
import { isValidTagPath, tagPaths } from '@/lib/tags';
import { SITEMAP_PAGES } from '@/lib/static-pages';
import { pageUrl } from '@/lib/utils';
import { SITE_URL } from '@/lib/site';
import { NOT_HIDDEN, getAssetPages } from '@/lib/wiki';

// Rendered per request. `revalidate = 3600` (2026-09-05 to 2026-10-15) froze
// the sitemap at each deploy: Next stamps a metadata route's prerender with
// its own `cache-control: public, max-age=0, must-revalidate`, and Vercel
// served that prerender as a HIT for the whole day after a build — never
// stale, never regenerated, deaf to the `wiki` tag — while the ISR routes that
// carry no Cache-Control of their own (pages, /api/charts/snapshot) went stale
// on time. `next start` regenerated it correctly, so the fault is the platform's,
// not the query's. Pages created between deploys were missing until the next
// one. A sitemap is fetched a few dozen times a day; one query each is cheaper
// than an ETag on a stale list.
export const dynamic = 'force-dynamic';

const HIGH_PRIORITY_PATHS = ['contents/tech/research', 'contents/tech/releases', 'contents/tech/core-protocols', 'contents/tech/core-concepts'];
const MED_PRIORITY_PATHS = ['developers', 'ecosystem'];

function pagePriority(tagPath: string): number {
  if (HIGH_PRIORITY_PATHS.some(hp => tagPath.startsWith(hp))) return 0.9;
  if (MED_PRIORITY_PATHS.some(mp => tagPath.startsWith(mp))) return 0.7;
  return 0.6;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Hidden paths are wiki-internal: the maintenance log keeps its URL but is
  // not article space, and at several rewrites a day it also dated every
  // category above it as changed today.
  const [pages, assetPages] = await Promise.all([
    prisma.page.findMany({
      where: { tagPath: NOT_HIDDEN },
      select: { tagPath: true, slug: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    }),
    getAssetPages().catch(() => ({})),
  ]);
  // A token page earns a row when a wiki article documents the token: most other resources
  // are pages with nothing to say. Not OciSwap's traded list either, which would put a
  // third-party API call behind every sitemap fetch.
  const tokenAddresses = Object.keys(assetPages).filter(a => a.startsWith('resource_'));

  // The root tag is the homepage, already the first row — as a category it
  // came out a second time, at `${SITE_URL}/`.
  const categoryPaths = tagPaths().filter(t => t.path && !t.hidden).map(t => t.path);

  // Newest page under each category → real lastModified (pages already ordered updatedAt desc)
  const catModified = new Map<string, Date>();
  for (const path of categoryPaths) {
    const latest = pages.find(p => p.tagPath === path || p.tagPath.startsWith(`${path}/`));
    if (latest) catModified.set(path, latest.updatedAt);
  }

  // The homepage moves when any page does. A lastmod that reads "now" on every
  // fetch is one Google learns to disregard, and it disregards the honest ones
  // with it — so the static routes below carry none rather than a fake one.
  const latest = pages[0]?.updatedAt ?? new Date();

  // Only pages that can be indexed belong here. The text indexes and the two
  // feeds were listed too, and Search Console filed all five under "crawled,
  // currently not indexed" — the one thing a sitemap row can do for a document
  // that is not a page. Each stays discoverable where it was found before:
  // the feeds and llms-full.txt are <link rel="alternate"> in the layout, and
  // llms.txt is the address every agent tries first.
  return [
    { url: SITE_URL, lastModified: latest, changeFrequency: 'daily', priority: 1 },
    ...categoryPaths.map(path => ({
      url: `${SITE_URL}/${path}`,
      // A category with no pages has no honest date; the site's newest is not one.
      lastModified: catModified.get(path),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...SITEMAP_PAGES.map(p => ({
      url: `${SITE_URL}/${p.path}`,
      changeFrequency: p.changeFrequency,
      priority: p.priority,
    })),
    ...tokenAddresses.map(address => ({
      url: `${SITE_URL}/charts/tokens/${address}`,
      changeFrequency: 'daily' as const,
      priority: 0.5,
    })),
    // Hub articles (empty slug) are omitted here: their URL is the category's own,
    // already emitted above.
    ...pages
      .filter(p => p.tagPath && p.slug && isValidTagPath(p.tagPath.split('/')))
      .map(p => ({
        url: pageUrl(p.tagPath, p.slug),
        lastModified: p.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: pagePriority(p.tagPath),
      })),
  ];
}