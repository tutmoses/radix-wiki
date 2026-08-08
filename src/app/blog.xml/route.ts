import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { BASE_URL, getContentSnippet } from '@/lib/utils';
import { ogImageUrl } from '@/lib/og';

export const dynamic = 'force-dynamic';

const FEED_LIMIT = 20;

// Numeric reference for the apostrophe: some readers' entity tables lack `&apos;`
const XML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s: string) => s.replace(/[&<>"']/g, c => XML_ESCAPES[c]!);

/** Aggregators hard-truncate descriptions at 150 chars — trim on a word boundary so they never cut mid-word. */
function clampWords(s: string, max = 150): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:—–-]$/, '');
}

/** Blog posts carry a `metadata.date` ("2026-08-02" or "2026/03/15"); fall back to the row's createdAt. */
function publishedAt(metadata: unknown, createdAt: Date): Date {
  const raw = (metadata as Record<string, string> | null)?.date?.replace(/\//g, '-');
  const parsed = raw ? new Date(raw) : null;
  return parsed && !isNaN(parsed.getTime()) ? parsed : createdAt;
}

export async function GET() {
  const posts = await prisma.page.findMany({
    where: { tagPath: 'blog' },
    select: { slug: true, title: true, content: true, metadata: true, bannerImage: true, createdAt: true, updatedAt: true },
  });

  const items = posts
    .map(p => ({ ...p, date: publishedAt(p.metadata, p.createdAt) }))
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, FEED_LIMIT)
    .map(p => {
      const url = `${BASE_URL}/blog/${p.slug}`;
      const description = clampWords((p.metadata as Record<string, string> | null)?.excerpt || getContentSnippet(p.content));
      // Branded 1200x630 card from the existing OG endpoint so every post has an image
      const image = ogImageUrl({ title: p.title, description, tagPath: 'blog', banner: p.bannerImage });
      return [
        '    <item>',
        `      <title>${esc(p.title)}</title>`,
        `      <link>${esc(url)}</link>`,
        `      <guid isPermaLink="true">${esc(url)}</guid>`,
        `      <description>${esc(description)}</description>`,
        `      <pubDate>${p.date.toUTCString()}</pubDate>`,
        `      <enclosure url="${esc(image)}" type="image/png" />`,
        '    </item>',
      ].join('\n');
    });

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    '    <title>RADIX.wiki Blog</title>',
    `    <link>${BASE_URL}/blog</link>`,
    '    <description>Community blog of RADIX.wiki — the knowledge base for Radix DLT.</description>',
    '    <language>en</language>',
    `    <atom:link href="${BASE_URL}/blog.xml" rel="self" type="application/rss+xml" />`,
    `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
    ...items,
    '  </channel>',
    '</rss>',
  ].join('\n');

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
