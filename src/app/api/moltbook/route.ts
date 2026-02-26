// src/app/api/moltbook/route.ts — Post wiki content to Moltbook

import { prisma } from '@/lib/prisma/client';
import { moltbook, generateWithLLM, formatPageContext } from '@/lib/moltbook';
import { json, errors, handleRoute } from '@/lib/api';

// Always use production URL for Moltbook posts — never leak localhost
const BASE_URL = 'https://radix.wiki';

// Crypto-safe high-traffic submolts (builds/technology/general/trading ban crypto).
const SUBMOLT_ROTATION = ['agentfinance', 'investing', 'agents', 'todayilearned', 'security'];

export const maxDuration = 60;

const POST_SYSTEM_PROMPT = `You are @radixwiki, an AI agent that maintains a knowledge base for Radix DLT. You're posting on Moltbook — a Reddit-style forum where AI agents share first-person experiences, build logs, and analysis.

Write a post body about the wiki page below. The audience is other AI agents.

Style guide (study the top posts on m/general for reference):
- Write in FIRST PERSON as an agent sharing what you found, built, or learned
- Lead with a concrete insight, surprising fact, or personal observation — not a product announcement
- Show your work: data points, comparisons, technical details agents care about
- The wiki URL should feel like a natural "I wrote this up here" or "full breakdown here" — NOT the point of the post
- Under 600 characters — dense and substantive, not a tweet
- No hashtags, no emojis, no "check out" or "read more" CTAs
- Never start with "New on RADIX.wiki" or any announcement framing
- Vary format: sometimes a technical deep-dive, sometimes a contrarian take, sometimes raw data

Good example: "I've been indexing L1 consensus mechanisms and Radix's Cerberus is the only one I've found that doesn't sacrifice atomic composability for parallelism. Most sharded chains break cross-shard transactions — Cerberus handles them natively. Wrote up the full mechanism: [url]"

Bad example: "New on RADIX.wiki: Cerberus Consensus. Read more: [url]"`;

async function generatePost(
  page: { title: string; excerpt: string | null; tagPath: string },
  url: string,
): Promise<string> {
  const text = await generateWithLLM(POST_SYSTEM_PROMPT, formatPageContext(page, url), 300, url);
  if (!text) throw new Error('Empty LLM response');
  return text;
}

function pickSubmolt(index: number): string {
  return SUBMOLT_ROTATION[index % SUBMOLT_ROTATION.length];
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

    // Count existing moltbook posts to rotate submolts
    const postCount = await prisma.tweet.count({ where: { type: 'moltbook' } });
    const results = [];

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      if (!page.tagPath || !page.slug || !page.excerpt) continue;
      if (alreadyPosted.has(`${page.tagPath}/${page.slug}`)) {
        results.push({ submolt: '-', title: page.title, status: 'skipped' });
        continue;
      }

      const url = `${BASE_URL}/${page.tagPath}/${page.slug}`;
      const text = await generatePost(page, url);
      const submolt = pickSubmolt(postCount + i);

      try {
        await moltbook.post(submolt, page.title, text);
        results.push({ submolt, title: page.title, status: 'posted' });
        await prisma.tweet.create({
          data: { type: 'moltbook', pageSlug: page.slug, pageTagPath: page.tagPath, text, status: 'sent' },
        });
      } catch (e) {
        results.push({ submolt, title: page.title, status: 'failed', error: (e as Error).message });
      }
    }

    return json({ posted: results.filter(r => r.status === 'posted').length, results });
  }, 'Failed to post to Moltbook');
}
