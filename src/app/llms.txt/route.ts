import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { TAG_HIERARCHY, type TagNode } from '@/lib/tags';

export const revalidate = 3600;

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

function collectCategories(nodes: TagNode[], parent = ''): { path: string; name: string }[] {
  return nodes.filter(n => !n.hidden).flatMap(n => {
    const path = parent ? `${parent}/${n.slug}` : n.slug;
    return [{ path, name: n.name }, ...(n.children ? collectCategories(n.children, path) : [])];
  });
}

export async function GET() {
  const pages = await prisma.page.findMany({
    select: { title: true, tagPath: true, slug: true, excerpt: true },
    orderBy: { updatedAt: 'desc' },
  });

  const categories = collectCategories(TAG_HIERARCHY);

  const lines = [
    '# RADIX Wiki',
    '',
    '> A decentralized wiki for the Radix DLT ecosystem, featuring blockchain authentication, semantic versioning, and hierarchical content organization.',
    '',
    '## Categories',
    '',
    ...categories.map(c => `- [${c.name}](${BASE_URL}/${c.path})`),
    '',
    '## Pages',
    '',
    ...pages
      .filter(p => p.tagPath && p.slug)
      .map(p => `- [${p.title}](${BASE_URL}/${p.tagPath}/${p.slug})${p.excerpt ? `: ${p.excerpt}` : ''}`),
  ];

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
