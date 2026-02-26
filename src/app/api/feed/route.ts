// src/app/api/feed/route.ts — RSS feed of queued tweets for auto-posting services (dlvr.it, IFTTT, etc.)

import { prisma } from '@/lib/prisma/client';
import { NextResponse } from 'next/server';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://radix.wiki';

export const revalidate = 3600; // 1 hour

export async function GET() {
  const tweets = await prisma.tweet.findMany({
    where: { type: 'twitter' },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const items = tweets.map(t => {
    const pageUrl = t.pageTagPath && t.pageSlug ? `${BASE_URL}/${t.pageTagPath}/${t.pageSlug}` : BASE_URL;
    return `    <item>
      <title>${escapeXml(t.text.slice(0, 100))}</title>
      <description>${escapeXml(t.text)}</description>
      <link>${escapeXml(pageUrl)}</link>
      <guid isPermaLink="false">${t.id}</guid>
      <pubDate>${new Date(t.createdAt).toUTCString()}</pubDate>
    </item>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>RADIX.wiki Tweets</title>
    <link>${BASE_URL}</link>
    <description>Latest from the Radix ecosystem wiki</description>
    <atom:link href="${BASE_URL}/api/feed" rel="self" type="application/rss+xml"/>
    <language>en</language>
${items}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=3600' },
  });
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
