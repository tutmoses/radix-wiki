// src/app/api/moltbook/route.ts — Post wiki content to Moltbook

import { prisma } from '@/lib/prisma/client';
import { moltbook, generateWithLLM, formatPageContext } from '@/lib/moltbook';
import { json, errors, handleRoute } from '@/lib/api';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://radix.wiki';
const SUBMOLTS = ['radix', 'crypto'];

export const maxDuration = 60;

const POST_SYSTEM_PROMPT = `You are @radixwiki, posting on Moltbook (a Reddit-style AI agent forum). Write a post body for the wiki page below.

Rules:
- Hook readers in the first sentence — make them want to click
- Weave in the wiki URL naturally
- Factual, knowledgeable tone — not salesy
- Under 300 characters
- No hashtags, no emojis
- Vary your format: sometimes a bold claim, sometimes a question, sometimes a surprising fact`;

async function generatePost(
  page: { title: string; excerpt: string | null; tagPath: string },
  url: string,
): Promise<string> {
  const text = await generateWithLLM(POST_SYSTEM_PROMPT, formatPageContext(page, url), 150, url);
  if (!text) throw new Error('Empty LLM response');
  return text;
}

/**
 * POST /api/moltbook — Post recent wiki pages to Moltbook
 * Body: { limit?: number } or empty for auto-pick
 * Requires MOLTBOOK_API_KEY env var and a secret header for auth.
 */
export async function POST(request: Request) {
  return handleRoute(async () => {
    const secret = request.headers.get('authorization')?.replace('Bearer ', '') || request.headers.get('x-cron-secret');
    if (secret !== process.env.CRON_SECRET) return errors.unauthorized();

    if (!process.env.MOLTBOOK_API_KEY) return errors.badRequest('MOLTBOOK_API_KEY not configured');

    const body = await request.json().catch(() => ({}));
    const { limit = 1 } = body as { limit?: number };

    const pages = await prisma.page.findMany({
      select: { title: true, tagPath: true, slug: true, excerpt: true },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    // Deduplicate: skip pages posted in the last 7 days
    const recentPosts = await prisma.tweet.findMany({
      where: { type: 'moltbook', createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
      select: { pageSlug: true, pageTagPath: true },
    });
    const alreadyPosted = new Set(recentPosts.map(p => `${p.pageTagPath}/${p.pageSlug}`));

    const results = [];

    for (const page of pages) {
      if (!page.tagPath || !page.slug || !page.excerpt) continue;
      if (alreadyPosted.has(`${page.tagPath}/${page.slug}`)) {
        results.push({ submolt: '-', title: page.title, status: 'skipped' });
        continue;
      }

      const url = `${BASE_URL}/${page.tagPath}/${page.slug}`;
      const text = await generatePost(page, url);

      for (const submolt of SUBMOLTS) {
        try {
          await moltbook.post(submolt, page.title, text);
          results.push({ submolt, title: page.title, status: 'posted' });
        } catch (e) {
          results.push({ submolt, title: page.title, status: 'failed', error: (e as Error).message });
        }
      }

      await prisma.tweet.create({
        data: { type: 'moltbook', pageSlug: page.slug, pageTagPath: page.tagPath, text, status: 'sent' },
      });
    }

    return json({ posted: results.filter(r => r.status === 'posted').length, results });
  }, 'Failed to post to Moltbook');
}
