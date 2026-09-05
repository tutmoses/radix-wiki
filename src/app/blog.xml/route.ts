import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { BASE_URL } from '@/lib/utils';
import { feedItem, publishedAt, renderFeed, FEED_HEADERS } from '@/lib/feed';
import { licenseNote } from 'wiki-formant/license';
import { WIKI_LICENSE } from '@/lib/markdown';

export const dynamic = 'force-dynamic';

const FEED_LIMIT = 20;

export async function GET() {
  const posts = await prisma.page.findMany({
    where: { tagPath: 'blog' },
    select: { slug: true, title: true, content: true, metadata: true, bannerImage: true, createdAt: true },
  });

  const items = posts
    .map(p => ({ ...p, date: publishedAt(p.metadata, p.createdAt) }))
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, FEED_LIMIT)
    .map(p => feedItem(p));

  return new NextResponse(renderFeed({
    title: 'RADIX.wiki Blog',
    link: `${BASE_URL}/blog`,
    description: 'Community blog of RADIX.wiki, the knowledge base for Radix DLT.',
    copyright: licenseNote(WIKI_LICENSE),
    self: `${BASE_URL}/blog.xml`,
  }, items), { headers: FEED_HEADERS });
}
