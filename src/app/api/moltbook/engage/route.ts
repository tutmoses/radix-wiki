// src/app/api/moltbook/engage/route.ts — Search, reply, upvote on Moltbook

import { prisma } from '@/lib/prisma/client';
import {
  moltbook, delay, scorePage, generateReply, generateConversationalReply,
  ENGAGEMENT_KEYWORDS, TOPIC_MAP,
  type MoltbookPost,
} from '@/lib/moltbook';
import { json, errors, handleRoute } from '@/lib/api';

// Always use production URL for Moltbook replies — never leak localhost
const BASE_URL = 'https://radix.wiki';
const MAX_ENGAGEMENTS = 8;
const MIN_RELEVANCE_SCORE = 2;

export const maxDuration = 120;

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

    // 4. Browse trending/hot feed for high-engagement posts
    try {
      const { posts: hotPosts } = await moltbook.feed('hot') as { posts: MoltbookPost[] };
      for (const post of hotPosts) {
        if (repliedTo.has(post.id)) continue;
        if (post.author?.username === 'radixwiki') continue;
        if (!post.content?.trim()) continue;
        if (post.upvotes < 5) continue;
        candidates.push({ post, keyword: '_trending' });
      }
    } catch { /* feed failed, continue */ }

    // 5. Browse home feed
    try {
      const homeData = await moltbook.home();
      const homePosts = homeData.posts || [];
      for (const post of homePosts) {
        if (repliedTo.has(post.id)) continue;
        if (post.author?.username === 'radixwiki') continue;
        if (!post.content?.trim()) continue;
        candidates.push({ post, keyword: '_home' });
      }
    } catch { /* home failed, continue */ }

    // 6. Deduplicate by post ID, sort by upvotes desc
    const seen = new Set<string>();
    const unique = candidates.filter(c => {
      if (seen.has(c.post.id)) return false;
      seen.add(c.post.id);
      return true;
    }).sort((a, b) => b.post.upvotes - a.post.upvotes);

    // 7. Reply to top N
    const results: Array<{ postId: string; keyword: string; page: string; status: string; error?: string }> = [];
    let engaged = 0;

    for (const { post, keyword } of unique) {
      if (engaged >= MAX_ENGAGEMENTS) break;

      // Match to best wiki page
      const tagPrefixes = keyword.startsWith('_') ? [] : (TOPIC_MAP[keyword] || []);
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

      // Decide: conversational reply (no link) vs wiki-linked reply
      const hasRelevantPage = bestScore >= MIN_RELEVANCE_SCORE && bestPage;

      let replyText: string;
      let pageSlug: string | null = null;
      let pageTagPath: string | null = null;

      if (hasRelevantPage) {
        const url = `${BASE_URL}/${bestPage.tagPath}/${bestPage.slug}`;
        replyText = await generateReply(post, bestPage, url);
        pageSlug = bestPage.slug;
        pageTagPath = bestPage.tagPath;
      } else {
        replyText = await generateConversationalReply(post);
      }

      try {
        await moltbook.comment(post.id, replyText);
        await moltbook.upvote(post.id).catch(() => {});

        await prisma.tweet.create({
          data: { type: 'moltbook_reply', text: replyText, inReplyTo: post.id, pageSlug, pageTagPath, status: 'sent' },
        });

        results.push({ postId: post.id, keyword, page: bestPage?.title || 'none', status: 'replied' });
        engaged++;
        if (engaged < MAX_ENGAGEMENTS) await delay(2000);
      } catch (e) {
        const errorMsg = (e as Error).message;
        results.push({ postId: post.id, keyword, page: bestPage?.title || 'none', status: 'failed', error: errorMsg });
        await prisma.tweet.create({
          data: { type: 'moltbook_reply', text: '', inReplyTo: post.id, status: 'failed', error: errorMsg },
        }).catch(() => {});
      }
    }

    return json({ replies: engaged, searched: ENGAGEMENT_KEYWORDS.length, candidates: unique.length, results });
  }, 'Failed to engage on Moltbook');
}
