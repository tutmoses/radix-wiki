import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { BASE_URL, getContentSnippet, pageUrl } from '@/lib/utils';
import { ogImageUrl } from '@/lib/og';
import { blocksToFeedHtml, clampWords, publishedAt, renderFeed, FEED_HEADERS } from '@/lib/feed';
import { licenseNote } from 'wiki-formant/license';
import { WIKI_LICENSE } from '@/lib/markdown';

export const dynamic = 'force-dynamic';

const FEED_LIMIT = 20;

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
      const url = pageUrl('blog', p.slug);
      const description = clampWords((p.metadata as Record<string, string> | null)?.excerpt || getContentSnippet(p.content));
      return {
        title: p.title,
        url,
        description,
        date: p.date,
        // Branded 1200x630 card from the existing OG endpoint so every post has an image
        image: ogImageUrl({ title: p.title, description, tagPath: 'blog', banner: p.bannerImage }),
        html: blocksToFeedHtml(p.content),
      };
    });

  return new NextResponse(renderFeed({
    title: 'RADIX.wiki Blog',
    link: `${BASE_URL}/blog`,
    description: 'Community blog of RADIX.wiki, the knowledge base for Radix DLT.',
    copyright: licenseNote(WIKI_LICENSE),
    self: `${BASE_URL}/blog.xml`,
  }, items), { headers: FEED_HEADERS });
}
