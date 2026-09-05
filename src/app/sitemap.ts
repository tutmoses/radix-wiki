// src/app/sitemap.ts

import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma/client';
import { isValidTagPath, tagPaths } from '@/lib/tags';
import { SITEMAP_PAGES } from '@/lib/static-pages';
import { BASE_URL, pageUrl } from '@/lib/utils';

// `revalidate` alone, not `force-dynamic` beside it. The two contradict each
// other and force-dynamic wins, so this route was rebuilt per request and
// served uncached — which is why radix.wiki was the only origin of the three
// whose sitemap carried no ETag, while caper's (identical config, minus the
// force-dynamic) does. The validator itself comes from the edge caching a
// prerendered response, so it appears on deploy rather than under `next start`.
// Hourly is the right freshness for a document listing pages, not per-request.
export const revalidate = 3600;

const HIGH_PRIORITY_PATHS = ['contents/tech/research', 'contents/tech/releases', 'contents/tech/core-protocols', 'contents/tech/core-concepts'];
const MED_PRIORITY_PATHS = ['developers', 'ecosystem'];

function pagePriority(tagPath: string): number {
  if (HIGH_PRIORITY_PATHS.some(hp => tagPath.startsWith(hp))) return 0.9;
  if (MED_PRIORITY_PATHS.some(mp => tagPath.startsWith(mp))) return 0.7;
  return 0.6;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = await prisma.page.findMany({
    select: { tagPath: true, slug: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  });

  const categoryPaths = tagPaths().map(t => t.path);

  // Newest page under each category → real lastModified (pages already ordered updatedAt desc)
  const catModified = new Map<string, Date>();
  for (const path of categoryPaths) {
    const latest = pages.find(p => p.tagPath === path || p.tagPath.startsWith(`${path}/`));
    if (latest) catModified.set(path, latest.updatedAt);
  }

  return [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    // The plain-text agent surface. Only the text indexes belong here — the
    // .md twins would be duplicate content beside their canonical pages.
    { url: `${BASE_URL}/llms.txt`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.5 },
    { url: `${BASE_URL}/llms-index.txt`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.4 },
    { url: `${BASE_URL}/llms-full.txt`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.4 },
    // The feeds are the only syndication surface the site has. Leaving them out of
    // the sitemap left browser auto-discovery as the sole route to them.
    { url: `${BASE_URL}/blog.xml`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.5 },
    { url: `${BASE_URL}/week-in-review.xml`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
    ...categoryPaths.map(path => ({
      url: `${BASE_URL}/${path}`,
      lastModified: catModified.get(path) ?? new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...SITEMAP_PAGES.map(p => ({
      url: `${BASE_URL}/${p.path}`,
      lastModified: new Date(),
      changeFrequency: p.changeFrequency,
      priority: p.priority,
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