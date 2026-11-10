import { SITE_URL } from '@/lib/site';
import { blogFeed, datedPosts, feedItem } from '@/lib/feed';

export const dynamic = 'force-dynamic';

const FEED_LIMIT = 20;

export async function GET(request: Request) {
  const items = (await datedPosts()).reverse().slice(0, FEED_LIMIT).map(p => feedItem(p));

  return blogFeed(request, {
    title: 'RADIX.wiki Blog',
    link: `${SITE_URL}/blog`,
    description: 'Community blog of RADIX.wiki, the knowledge base for Radix DLT.',
    self: `${SITE_URL}/blog.xml`,
  }, items);
}
