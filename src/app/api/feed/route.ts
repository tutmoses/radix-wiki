// src/app/api/feed/route.ts — RSS feed for auto-posting services (dlvr.it, IFTTT, etc.)
// Serves generated tweets when available, falls back to recent wiki pages.

import { prisma } from '@/lib/prisma/client';
import { NextResponse } from 'next/server';
import { CACHE } from '@/lib/api';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://radix.wiki';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Try generated tweets first
  const tweets = await prisma.tweet.findMany({
    where: { type: 'twitter' },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  let items: string;

  if (tweets.length > 0) {
    items = tweets.map(t => {
      const pageUrl = t.pageTagPath && t.pageSlug ? `${BASE_URL}/${t.pageTagPath}/${t.pageSlug}` : BASE_URL;
      return feedItem(t.text.slice(0, 100), t.text, pageUrl, t.id, t.createdAt);
    }).join('\n');
  } else {
    // Fallback: serve recent wiki pages so feed validators see content
    const pages = await prisma.page.findMany({
      select: { title: true, excerpt: true, tagPath: true, slug: true, updatedAt: true, id: true },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });
    items = pages.map(p => {
      const url = `${BASE_URL}/${p.tagPath}/${p.slug}`;
      const text = `${p.title}: ${p.excerpt || 'Read more on the Radix wiki.'} ${url}`;
      return feedItem(p.title, text, url, p.id, p.updatedAt);
    }).join('\n');
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>RADIX.wiki</title>
    <link>${BASE_URL}</link>
    <description>Latest from the Radix ecosystem wiki</description>
    <atom:link href="${BASE_URL}/api/feed" rel="self" type="application/rss+xml"/>
    <language>en</language>
${items}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', ...CACHE.long },
  });
}

function feedItem(title: string, description: string, link: string, guid: string, date: Date): string {
  return `    <item>
      <title>${escapeXml(title)}</title>
      <description>${escapeXml(description)}</description>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="false">${guid}</guid>
      <pubDate>${new Date(date).toUTCString()}</pubDate>
    </item>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
