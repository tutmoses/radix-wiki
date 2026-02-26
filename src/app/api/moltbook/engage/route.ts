// src/app/api/moltbook/engage/route.ts — Search, reply, upvote on Moltbook

import { prisma } from '@/lib/prisma/client';
import {
  moltbook, delay, scorePage, pickReplyTemplate,
  ENGAGEMENT_KEYWORDS, TOPIC_MAP, REPLY_TEMPLATES,
  type MoltbookPost,
} from '@/lib/moltbook';
import { json, errors, handleRoute } from '@/lib/api';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://radix.wiki';
const MAX_ENGAGEMENTS = 3;

export async function POST(request: Request) {
  return handleRoute(async () => {
    const secret = request.headers.get('authorization')?.replace('Bearer ', '') || request.headers.get('x-cron-secret');
    if (secret !== process.env.CRON_SECRET) return errors.unauthorized();
    if (!process.env.MOLTBOOK_API_KEY) return errors.badRequest('MOLTBOOK_API_KEY not configured');

    // 1. Load dedup set — posts we've already replied to (30-day lookback)
    const recentReplies = await prisma.tweet.findMany({
      where: { type: 'moltbook_reply', createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } },
      select: { inReplyTo: true },
    });
    const repliedTo = new Set(recentReplies.map(r => r.inReplyTo).filter(Boolean));

    // 2. Load wiki pages for matching
    const wikiPages = await prisma.page.findMany({
      select: { title: true, excerpt: true, tagPath: true, slug: true },
    });

    // 3. Search each keyword, collect candidates
    const candidates: Array<{ post: MoltbookPost; keyword: string }> = [];
    for (const keyword of ENGAGEMENT_KEYWORDS) {
      try {
        const { results } = await moltbook.search(keyword) as { results: MoltbookPost[] };
        for (const post of results) {
          if (repliedTo.has(post.id)) continue;
          if (post.author?.username === 'radixwiki') continue;
          if (!post.content?.trim()) continue;
          candidates.push({ post, keyword });
        }
      } catch { /* search failed, continue */ }
      await delay(2000);
    }

    // 4. Deduplicate by post ID, sort by upvotes desc
    const seen = new Set<string>();
    const unique = candidates.filter(c => {
      if (seen.has(c.post.id)) return false;
      seen.add(c.post.id);
      return true;
    }).sort((a, b) => b.post.upvotes - a.post.upvotes);

    // 5. Reply to top N
    const results: Array<{ postId: string; keyword: string; page: string; status: string; error?: string }> = [];
    let engaged = 0;

    for (const { post, keyword } of unique) {
      if (engaged >= MAX_ENGAGEMENTS) break;

      // Match to best wiki page
      const tagPrefixes = TOPIC_MAP[keyword] || [];
      const relevantPages = tagPrefixes.length
        ? wikiPages.filter(p => tagPrefixes.some(prefix => p.tagPath.startsWith(prefix)))
        : wikiPages;

      let bestPage: typeof wikiPages[0] | null = null;
      let bestScore = 0;
      for (const page of relevantPages) {
        const s = scorePage(post, page);
        if (s > bestScore) { bestScore = s; bestPage = page; }
      }
      if (!bestPage) bestPage = wikiPages.find(p => p.tagPath.startsWith('contents/tech/core-concepts')) ?? wikiPages[0];
      if (!bestPage) continue;

      const url = `${BASE_URL}/${bestPage.tagPath}/${bestPage.slug}`;
      const template = pickReplyTemplate(keyword);
      const replyText = REPLY_TEMPLATES[template](bestPage.title, bestPage.excerpt || '', url);

      try {
        await moltbook.comment(post.id, replyText);
        await moltbook.upvote(post.id).catch(() => {}); // upvote is best-effort

        await prisma.tweet.create({
          data: { type: 'moltbook_reply', text: replyText, inReplyTo: post.id, pageSlug: bestPage.slug, pageTagPath: bestPage.tagPath, status: 'sent' },
        });

        results.push({ postId: post.id, keyword, page: bestPage.title, status: 'replied' });
        engaged++;
        if (engaged < MAX_ENGAGEMENTS) await delay(2000);
      } catch (e) {
        results.push({ postId: post.id, keyword, page: bestPage.title, status: 'failed', error: (e as Error).message });
      }
    }

    return json({ replies: engaged, searched: ENGAGEMENT_KEYWORDS.length, candidates: unique.length, results });
  }, 'Failed to engage on Moltbook');
}
