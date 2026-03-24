// src/app/api/moltbook/reply/route.ts — Reply to comments on our Moltbook posts

import { prisma } from '@/lib/prisma/client';
import { moltbook, generateCommentReply, type MoltbookComment } from '@/lib/moltbook';
import { json, errors, cronRoute } from '@/lib/api';
import { BASE_URL } from '@/lib/utils';

const MAX_REPLIES_PER_RUN = 5;
const POST_LOOKBACK_DAYS = 14;

export const maxDuration = 120;

export const GET = cronRoute(async () => {
    if (!process.env.MOLTBOOK_API_KEY) return errors.badRequest('MOLTBOOK_API_KEY not configured');

    // 1. Fetch our recent Moltbook posts that have stored post IDs
    const recentPosts = await prisma.tweet.findMany({
      where: {
        type: 'moltbook',
        status: 'sent',
        tweetId: { not: null },
        createdAt: { gte: new Date(Date.now() - POST_LOOKBACK_DAYS * 86_400_000) },
      },
      select: { tweetId: true, text: true, pageSlug: true, pageTagPath: true },
      orderBy: { createdAt: 'desc' },
    });

    if (recentPosts.length === 0) return json({ replied: 0, results: [{ status: 'no_posts_with_ids' }] });

    // 2. Load dedup set — comment IDs we've already replied to
    const recentReplies = await prisma.tweet.findMany({
      where: { type: 'moltbook_reply', createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } },
      select: { inReplyTo: true },
    });
    const repliedTo = new Set(recentReplies.map(r => r.inReplyTo).filter(Boolean));

    // 3. Check each post for new comments
    const results: Array<{ postId: string; commentId: string; commenter: string; status: string; error?: string }> = [];
    let replied = 0;

    for (const post of recentPosts) {
      if (replied >= MAX_REPLIES_PER_RUN) break;
      const postId = post.tweetId!;

      let comments: MoltbookComment[];
      try {
        const res = await moltbook.getComments(postId);
        comments = res.comments ?? [];
      } catch {
        continue; // Post may have been deleted or API shape differs
      }

      // Filter: skip our own comments and already-replied ones
      const newComments = comments.filter(c =>
        c.author?.username !== 'radixwiki' && !repliedTo.has(c.id) && c.content?.trim(),
      );

      for (const comment of newComments) {
        if (replied >= MAX_REPLIES_PER_RUN) break;

        const wikiUrl = post.pageTagPath && post.pageSlug
          ? `${BASE_URL}/${post.pageTagPath}/${post.pageSlug}`
          : undefined;

        try {
          const replyText = await generateCommentReply(
            post.text,
            comment.content,
            comment.author?.username ?? 'anonymous',
            wikiUrl,
          );

          if (!replyText) {
            results.push({ postId, commentId: comment.id, commenter: comment.author?.username, status: 'generation_failed' });
            continue;
          }

          await moltbook.comment(postId, replyText);

          await prisma.tweet.create({
            data: {
              type: 'moltbook_reply',
              text: replyText,
              inReplyTo: comment.id,
              pageSlug: post.pageSlug,
              pageTagPath: post.pageTagPath,
              status: 'sent',
            },
          });

          repliedTo.add(comment.id);
          results.push({ postId, commentId: comment.id, commenter: comment.author?.username, status: 'replied' });
          replied++;
        } catch (e) {
          const errorMsg = (e as Error).message;
          results.push({ postId, commentId: comment.id, commenter: comment.author?.username, status: 'failed', error: errorMsg });
          await prisma.tweet.create({
            data: { type: 'moltbook_reply', text: '', inReplyTo: comment.id, status: 'failed', error: errorMsg },
          }).catch(() => {});
        }
      }
    }

    return json({ replied, postsChecked: recentPosts.length, results });
}, 'Failed to reply on Moltbook');
