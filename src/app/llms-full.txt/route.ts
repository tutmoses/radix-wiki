import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { BASE_URL, getContentSnippet } from '@/lib/utils';
import { extractText } from '@/lib/content';
import type { Block } from '@/types/blocks';

export const dynamic = 'force-dynamic';

function cleanExcerpt(s: string): string {
  return s
    .replace(/\(https?:\/\/[^)]*\)/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 160);
}

export async function GET() {
  const pages = await prisma.page.findMany({
    select: { title: true, tagPath: true, slug: true, content: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  });

  const sections = pages
    .filter(p => p.tagPath && p.slug)
    .map(p => {
      const url = `${BASE_URL}/${p.tagPath}/${p.slug}`;
      const body = extractText((p.content as unknown as Block[]) || []);
      const snippet = getContentSnippet(p.content);
      return `## ${p.title}\n\nURL: ${url}\nUpdated: ${p.updatedAt.toISOString().split('T')[0]}\n${snippet ? `Summary: ${cleanExcerpt(snippet)}\n` : ''}\n${body}`;
    });

  const text = [
    `# RADIX Wiki — Full Content Export`,
    ``,
    `> This is the full-text version of llms.txt for ${BASE_URL}`,
    `> ${pages.length} pages, last generated ${new Date().toISOString().split('T')[0]}`,
    ``,
    ...sections,
  ].join('\n\n');

  return new NextResponse(text, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
