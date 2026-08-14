import { type NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { BASE_URL, getContentSnippet, pageUrl } from '@/lib/utils';
import { extractText } from '@/lib/content';
import { cleanSnippet, corpusValidators, notModified, textHeaders } from '@/lib/llms';
import type { Block } from '@/types/blocks';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { etag, lastModified } = await corpusValidators();
  const cached = notModified(request, etag, lastModified);
  if (cached) return cached;

  const pages = await prisma.page.findMany({
    select: { title: true, tagPath: true, slug: true, content: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  });

  const sections = pages
    .filter(p => p.tagPath)
    .map(p => {
      const url = pageUrl(p.tagPath, p.slug);
      const body = extractText((p.content as unknown as Block[]) || []);
      const snippet = getContentSnippet(p.content);
      return `## ${p.title}\n\nURL: ${url}\nUpdated: ${p.updatedAt.toISOString().split('T')[0]}\n${snippet ? `Summary: ${cleanSnippet(snippet)}\n` : ''}\n${body}`;
    });

  const text = [
    `# RADIX Wiki — Full Content Export`,
    ``,
    `> This is the full-text version of llms.txt for ${BASE_URL}`,
    `> ${pages.length} pages, last generated ${new Date().toISOString().split('T')[0]}`,
    ``,
    `> License: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)`,
    `> Attribution: "Source: RADIX.wiki (${BASE_URL}), CC BY 4.0"`,
    `> Full license text: https://creativecommons.org/licenses/by/4.0/legalcode`,
    ``,
    ...sections,
  ].join('\n\n');

  return new NextResponse(text, { headers: textHeaders(etag, lastModified) });
}
