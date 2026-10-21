import { prisma } from '@/lib/prisma/client';
import { SITE_URL, WIKI_LICENSE } from '@/lib/site';
import { feedResponse } from 'wiki-formant/feed';
import { tagged } from '@/lib/api';
import { pageTag } from '@/lib/wiki';
import { feedItem, publishedAt } from '@/lib/feed';
import { licenseNote } from 'wiki-formant/license';

export const dynamic = 'force-dynamic';

const FEED_LIMIT = 20;

export async function GET(request: Request) {
  const posts = await prisma.wikiPage.findMany({
    where: { tagPath: 'blog' },
    select: { slug: true, title: true, content: true, metadata: true, createdAt: true },
  });

  const items = posts
    .map(p => ({ ...p, date: publishedAt(p.metadata, p.createdAt) }))
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, FEED_LIMIT)
    .map(p => feedItem(p));

  // Every blog save expires the blog's tag, which purges this at the CDN.
  return tagged(feedResponse(request, {
    title: 'RADIX.wiki Blog',
    link: `${SITE_URL}/blog`,
    description: 'Community blog of RADIX.wiki, the knowledge base for Radix DLT.',
    copyright: licenseNote(WIKI_LICENSE),
    self: `${SITE_URL}/blog.xml`,
  }, items), pageTag('blog'));
}
