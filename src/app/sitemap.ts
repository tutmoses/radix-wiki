// src/app/sitemap.ts

import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma/client';
import { TAG_HIERARCHY, type TagNode } from '@/lib/tags';

export const revalidate = 3600;

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://radix.wiki';

function collectTagPaths(nodes: TagNode[], parentPath = ''): string[] {
  return nodes.flatMap(node => {
    const path = parentPath ? `${parentPath}/${node.slug}` : node.slug;
    return [path, ...(node.children ? collectTagPaths(node.children, path) : [])];
  });
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = await prisma.page.findMany({
    select: { tagPath: true, slug: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  });

  const categoryPaths = collectTagPaths(TAG_HIERARCHY);

  return [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    ...categoryPaths.map(path => ({
      url: `${BASE_URL}/${path}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...pages
      .filter(p => p.tagPath && p.slug)
      .map(p => ({
        url: `${BASE_URL}/${p.tagPath}/${p.slug}`,
        lastModified: p.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      })),
  ];
}