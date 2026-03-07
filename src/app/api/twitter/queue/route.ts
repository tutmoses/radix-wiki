// src/app/api/twitter/queue/route.ts — Twitter queue with built-in scheduling
//
// GET:  Returns the next postable tweet (respects 2-hour spacing, expires stale tweets)
// POST: Marks a tweet as sent after browser posting
//
// Called from Claude Code sessions during the morning routine.

import { prisma } from '@/lib/prisma/client';
import { json, handleRoute, requireCron } from '@/lib/api';

const MIN_GAP_MS = 2 * 3_600_000;   // 2 hours between posts
const EXPIRY_MS  = 7 * 24 * 3_600_000;  // Tweets older than 7 days get expired (wiki content is evergreen)

export async function GET(request: Request) {
  return handleRoute(async () => {
    const cronErr = requireCron(request);
    if (cronErr) return cronErr;

    const now = Date.now();

    // 1. Expire stale queued tweets (>48h old)
    await prisma.tweet.updateMany({
      where: {
        type: 'twitter',
        status: 'queued',
        createdAt: { lt: new Date(now - EXPIRY_MS) },
      },
      data: { status: 'expired' },
    });

    // 2. Check when the last tweet was posted
    const lastPosted = await prisma.tweet.findFirst({
      where: { type: 'twitter', status: 'sent' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    const sinceLastPost = lastPosted ? now - lastPosted.createdAt.getTime() : Infinity;
    const canPostNow = sinceLastPost >= MIN_GAP_MS;

    if (!canPostNow) {
      const nextPostAt = new Date(lastPosted!.createdAt.getTime() + MIN_GAP_MS);
      return json({
        postable: false,
        reason: `Last tweet ${Math.round(sinceLastPost / 60_000)}min ago. Next slot at ${nextPostAt.toISOString()}`,
        nextPostAt: nextPostAt.toISOString(),
        queueDepth: await prisma.tweet.count({ where: { type: 'twitter', status: 'queued' } }),
      });
    }

    // 3. Get the next queued tweet (oldest first)
    const next = await prisma.tweet.findFirst({
      where: { type: 'twitter', status: 'queued' },
      orderBy: { createdAt: 'asc' },
    });

    if (!next) {
      return json({ postable: false, reason: 'Queue empty', queueDepth: 0 });
    }

    const queueDepth = await prisma.tweet.count({ where: { type: 'twitter', status: 'queued' } });

    return json({
      postable: true,
      tweet: { id: next.id, text: next.text, pageSlug: next.pageSlug, pageTagPath: next.pageTagPath },
      queueDepth,
    });
  }, 'Queue: failed to read');
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const cronErr = requireCron(request);
    if (cronErr) return cronErr;

    const { id, action } = await request.json() as { id: string; action: 'sent' | 'skip' };

    if (!id || !['sent', 'skip'].includes(action)) {
      return json({ error: 'Provide { id, action: "sent" | "skip" }' }, 400);
    }

    const status = action === 'sent' ? 'sent' : 'skipped';
    await prisma.tweet.update({ where: { id }, data: { status } });

    return json({ ok: true, id, status });
  }, 'Queue: failed to update');
}
