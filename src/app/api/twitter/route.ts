// src/app/api/twitter/route.ts — Generate tweets and store for RSS distribution

import { prisma } from '@/lib/prisma/client';
import { generateTweet } from '@/lib/twitter';
import { json, handleRoute, requireCron } from '@/lib/api';
import { getRecentPostSlugs } from '@/lib/scoring';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://radix.wiki';

export const maxDuration = 60;

export async function POST(request: Request) {
  return handleRoute(async () => {
    const cronErr = requireCron(request);
    if (cronErr) return cronErr;

    // Get recently updated pages
    const pages = await prisma.page.findMany({
      select: { title: true, tagPath: true, slug: true, excerpt: true },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    });

    // Skip pages tweeted in last 7 days
    const alreadyTweeted = await getRecentPostSlugs('twitter', 7);
    const candidate = pages.find(p =>
      p.tagPath && p.slug && p.excerpt && !alreadyTweeted.has(`${p.tagPath}/${p.slug}`),
    );

    if (!candidate) return json({ status: 'skipped', reason: 'no fresh pages to tweet' });

    const url = `${BASE_URL}/${candidate.tagPath}/${candidate.slug}`;
    const text = await generateTweet(candidate, url);

    await prisma.tweet.create({
      data: { type: 'twitter', pageSlug: candidate.slug, pageTagPath: candidate.tagPath, text, status: 'queued' },
    });

    return json({ status: 'queued', title: candidate.title, text });
  }, 'Failed to generate tweet');
}
