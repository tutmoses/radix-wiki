// src/app/sitemap.ts

import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma/client';
import { isValidTagPath, tagPaths } from '@/lib/tags';
import { SITEMAP_PAGES } from '@/lib/static-pages';
import { pageUrl } from '@/lib/utils';
import { SITE_URL } from '@/lib/site';
import { treeSitemap } from 'wiki-formant/sitemap';
import { NOT_HIDDEN, getAssetPages } from '@/lib/wiki';

// Rendered per request, never `revalidate`: Vercel never regenerates a metadata
// route's ISR prerender, so an hourly sitemap froze at each deploy (STRUCTURE.md S13).
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
    prisma.wikiPage.findMany({
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

  // The homepage moves when any page does. A lastmod that reads "now" on every
  // fetch is one Google learns to disregard, and it disregards the honest ones
  // with it — so the static routes below carry none rather than a fake one.
  const latest = pages[0]?.updatedAt ?? new Date();

  // Only pages that can be indexed belong here. The text indexes and the two
  // feeds were listed too, and Search Console filed all five under "crawled,
  // currently not indexed" — the one thing a sitemap row can do for a document
  // that is not a page. Each stays discoverable where it was found before:
  // the feeds are <link rel="alternate"> in the layout, and llms.txt is the
  // address every agent tries first.
  return [
    { url: SITE_URL, lastModified: latest, changeFrequency: 'daily', priority: 1 },
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
    // Each category dated by its newest page; a hub article (empty slug) dates
    // its category and takes no row of its own, since its URL is the category's.
    ...treeSitemap(pages.filter(p => p.tagPath && isValidTagPath(p.tagPath.split('/'))), {
      sections: categoryPaths,
      sectionRow: path => ({ url: `${SITE_URL}/${path}`, changeFrequency: 'weekly', priority: 0.8 }),
      pageRow: p => ({ url: pageUrl(p.tagPath, p.slug), changeFrequency: 'weekly', priority: pagePriority(p.tagPath) }),
    }),
  ];
}