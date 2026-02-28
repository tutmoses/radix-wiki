// src/app/api/moltbook/route.ts — Post wiki content to Moltbook

import { prisma } from '@/lib/prisma/client';
import { moltbook, generatePost, generateTitle, pickSubmolt } from '@/lib/moltbook';
import { json, errors, handleRoute } from '@/lib/api';

// Always use production URL for Moltbook posts — never leak localhost
const BASE_URL = 'https://radix.wiki';
const STALENESS_DAYS = 90;

export const maxDuration = 60;

export async function POST(request: Request) {
  return handleRoute(async () => {
    const secret = request.headers.get('authorization')?.replace('Bearer ', '') || request.headers.get('x-cron-secret');
    if (secret !== process.env.CRON_SECRET) return errors.unauthorized();
    if (!process.env.MOLTBOOK_API_KEY) return errors.badRequest('MOLTBOOK_API_KEY not configured');

    const freshCutoff = new Date(Date.now() - STALENESS_DAYS * 86_400_000);

    // Fetch pool of fresh pages (revised or created within 90 days)
    const pages = await prisma.page.findMany({
      where: {
        excerpt: { not: null },
        tagPath: { not: '' },
        OR: [
          { revisions: { some: { createdAt: { gte: freshCutoff } } } },
          { createdAt: { gte: freshCutoff } },
        ],
      },
      select: { title: true, tagPath: true, slug: true, excerpt: true },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    // Deduplicate: skip pages posted in the last 7 days
    const recentPosts = await prisma.tweet.findMany({
      where: { type: 'moltbook', createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
      select: { pageSlug: true, pageTagPath: true },
    });
    const alreadyPosted = new Set(recentPosts.map(p => `${p.pageTagPath}/${p.pageSlug}`));

    const eligible = pages.filter(p => p.tagPath && p.slug && !alreadyPosted.has(`${p.tagPath}/${p.slug}`));
    if (eligible.length === 0) return json({ posted: 0, results: [{ status: 'no_eligible_pages' }] });

    // Random pick from top 10 eligible
    const page = eligible[Math.floor(Math.random() * Math.min(eligible.length, 10))];
    const url = `${BASE_URL}/${page.tagPath}/${page.slug}`;
    const submolt = pickSubmolt();

    try {
      const [text, title] = await Promise.all([
        generatePost(page, url),
        generateTitle(page),
      ]);

      await moltbook.post(submolt, title, text);
      await prisma.tweet.create({
        data: { type: 'moltbook', pageSlug: page.slug, pageTagPath: page.tagPath, text, status: 'sent' },
      });
      return json({ posted: 1, results: [{ submolt, title, status: 'posted' }] });
    } catch (e) {
      const errorMsg = (e as Error).message;
      await prisma.tweet.create({
        data: { type: 'moltbook', pageSlug: page.slug, pageTagPath: page.tagPath, text: '', status: 'failed', error: errorMsg },
      }).catch(() => {});
      return json({ posted: 0, results: [{ submolt, title: page.title, status: 'failed', error: errorMsg }] });
    }
  }, 'Failed to post to Moltbook');
}
