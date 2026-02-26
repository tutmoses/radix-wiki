// src/app/api/twitter/route.ts — Generate tweets and store for RSS distribution

import { prisma } from '@/lib/prisma/client';
import { generateTweet } from '@/lib/buffer';
import { json, errors, handleRoute } from '@/lib/api';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://radix.wiki';

export const maxDuration = 60;

export async function POST(request: Request) {
  return handleRoute(async () => {
    const secret = request.headers.get('authorization')?.replace('Bearer ', '') || request.headers.get('x-cron-secret');
    if (secret !== process.env.CRON_SECRET) return errors.unauthorized();

    // Get recently updated pages
    const pages = await prisma.page.findMany({
      select: { title: true, tagPath: true, slug: true, excerpt: true },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    });

    // Skip pages tweeted in last 7 days
    const recentTweets = await prisma.tweet.findMany({
      where: { type: 'twitter', createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
      select: { pageSlug: true, pageTagPath: true },
    });
    const alreadyTweeted = new Set(recentTweets.map(t => `${t.pageTagPath}/${t.pageSlug}`));

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
