// src/app/api/metrics/route.ts — DMAIC metrics collection
//
// Collects content, agent, and distribution metrics from existing tables.
// Stores daily snapshots for SPC analysis. No schema changes needed —
// snapshots are stored as Tweet records with type='metrics_snapshot'.

import { prisma } from '@/lib/prisma/client';
import { json, cronRoute } from '@/lib/api';

export const maxDuration = 60;

interface MetricsSnapshot {
  timestamp: string;
  content: {
    page_count: number;
    pages_updated_7d: number;
    stale_pages_30d: number;
    infobox_pct: number;
    excerpt_pct: number;
  };
  agents: {
    error_rate_24h: number;
    error_rate_7d: number;
    errors_by_agent: Record<string, number>;
    pulse_health_pct: number;
    mend_success_rate: number;
  };
  distribution: {
    tweets_sent_7d: number;
    tweets_expired_7d: number;
    tweet_queue_depth: number;
    moltbook_posts_7d: number;
    moltbook_replies_7d: number;
    coverage_gap_count: number;
  };
  composite: {
    content_quality_score: number;
    system_health_score: number;
    distribution_velocity: number;
  };
}

async function collectSnapshot(): Promise<MetricsSnapshot> {
  const now = Date.now();
  const day1 = new Date(now - 24 * 3_600_000);
  const day7 = new Date(now - 7 * 24 * 3_600_000);
  const day30 = new Date(now - 30 * 24 * 3_600_000);

  // --- Content metrics ---
  const [pageCount, pagesUpdated7d, stalePages30d, allPages] = await Promise.all([
    prisma.page.count(),
    prisma.page.count({ where: { updatedAt: { gte: day7 } } }),
    prisma.page.count({ where: { updatedAt: { lt: day30 } } }),
    prisma.page.findMany({ select: { content: true, excerpt: true } }),
  ]);

  let hasInfobox = 0;
  let hasExcerpt = 0;
  for (const p of allPages) {
    const str = JSON.stringify(p.content);
    if (str.includes('"type":"infobox"') || str.includes('"type": "infobox"')) hasInfobox++;
    if (p.excerpt && p.excerpt.trim().length > 0) hasExcerpt++;
  }
  const infoboxPct = pageCount > 0 ? hasInfobox / pageCount : 0;
  const excerptPct = pageCount > 0 ? hasExcerpt / pageCount : 0;

  // --- Agent metrics ---
  const [errors24h, total24h, errors7d, total7d] = await Promise.all([
    prisma.tweet.count({ where: { status: 'failed', createdAt: { gte: day1 } } }),
    prisma.tweet.count({ where: { createdAt: { gte: day1 } } }),
    prisma.tweet.count({ where: { status: 'failed', createdAt: { gte: day7 } } }),
    prisma.tweet.count({ where: { createdAt: { gte: day7 } } }),
  ]);
  const errorRate24h = total24h > 0 ? errors24h / total24h : 0;
  const errorRate7d = total7d > 0 ? errors7d / total7d : 0;

  // Per-agent error counts (last 24h)
  const failedRecords = await prisma.tweet.findMany({
    where: { status: 'failed', createdAt: { gte: day1 } },
    select: { type: true },
  });
  const errorsByAgent: Record<string, number> = {};
  for (const r of failedRecords) {
    errorsByAgent[r.type] = (errorsByAgent[r.type] ?? 0) + 1;
  }

  // Pulse health (last 14 pulse records)
  const recentPulses = await prisma.tweet.findMany({
    where: { type: 'pulse' },
    orderBy: { createdAt: 'desc' },
    take: 14,
    select: { status: true },
  });
  const healthyPulses = recentPulses.filter(p => p.status === 'healthy').length;
  const pulseHealthPct = recentPulses.length > 0 ? healthyPulses / recentPulses.length : 0;

  // Mend success rate (last 30d)
  const [mendSuccess, mendTotal] = await Promise.all([
    prisma.tweet.count({ where: { type: 'mend', status: 'sent', createdAt: { gte: day30 } } }),
    prisma.tweet.count({ where: { type: 'mend', createdAt: { gte: day30 } } }),
  ]);
  const mendSuccessRate = mendTotal > 0 ? mendSuccess / mendTotal : 1;

  // --- Distribution metrics ---
  const [tweetsSent7d, tweetsExpired7d, tweetQueueDepth, moltbookPosts7d, moltbookReplies7d, coverageGapCount] = await Promise.all([
    prisma.tweet.count({ where: { type: 'twitter', status: 'sent', createdAt: { gte: day7 } } }),
    prisma.tweet.count({ where: { type: 'twitter', status: 'expired', createdAt: { gte: day7 } } }),
    prisma.tweet.count({ where: { type: 'twitter', status: 'queued' } }),
    prisma.tweet.count({ where: { type: 'moltbook', status: 'sent', createdAt: { gte: day7 } } }),
    prisma.tweet.count({ where: { type: 'moltbook_reply', status: 'sent', createdAt: { gte: day7 } } }),
    prisma.tweet.count({ where: { type: 'scout_intel', status: 'flagged' } }),
  ]);

  // --- Composite scores ---
  // Sentinel broken link rate: issues_found / total sentinel checks (last 30d)
  const [sentinelIssues, sentinelTotal] = await Promise.all([
    prisma.tweet.count({ where: { type: 'sentinel_check', status: 'issues_found', createdAt: { gte: day30 } } }),
    prisma.tweet.count({ where: { type: 'sentinel_check', createdAt: { gte: day30 } } }),
  ]);
  const brokenLinkRate = sentinelTotal > 0 ? sentinelIssues / sentinelTotal : 0;
  const staleRate = pageCount > 0 ? stalePages30d / pageCount : 0;

  const contentQualityScore = infoboxPct * 0.3 + excerptPct * 0.2 + (1 - brokenLinkRate) * 0.3 + (1 - staleRate) * 0.2;
  const systemHealthScore = (1 - errorRate7d) * 0.4 + pulseHealthPct * 0.3 + mendSuccessRate * 0.3;
  const distributionVelocity = tweetsSent7d + moltbookPosts7d;

  return {
    timestamp: new Date().toISOString(),
    content: {
      page_count: pageCount,
      pages_updated_7d: pagesUpdated7d,
      stale_pages_30d: stalePages30d,
      infobox_pct: Math.round(infoboxPct * 1000) / 1000,
      excerpt_pct: Math.round(excerptPct * 1000) / 1000,
    },
    agents: {
      error_rate_24h: Math.round(errorRate24h * 1000) / 1000,
      error_rate_7d: Math.round(errorRate7d * 1000) / 1000,
      errors_by_agent: errorsByAgent,
      pulse_health_pct: Math.round(pulseHealthPct * 1000) / 1000,
      mend_success_rate: Math.round(mendSuccessRate * 1000) / 1000,
    },
    distribution: {
      tweets_sent_7d: tweetsSent7d,
      tweets_expired_7d: tweetsExpired7d,
      tweet_queue_depth: tweetQueueDepth,
      moltbook_posts_7d: moltbookPosts7d,
      moltbook_replies_7d: moltbookReplies7d,
      coverage_gap_count: coverageGapCount,
    },
    composite: {
      content_quality_score: Math.round(contentQualityScore * 1000) / 1000,
      system_health_score: Math.round(systemHealthScore * 1000) / 1000,
      distribution_velocity: distributionVelocity,
    },
  };
}

export const GET = cronRoute(async (request: Request) => {
  const url = new URL(request.url);
  const historyParam = url.searchParams.get('history');

  // If history requested, return past snapshots
  if (historyParam) {
    const limit = Math.min(90, Math.max(1, parseInt(historyParam, 10) || 14));
    const snapshots = await prisma.tweet.findMany({
      where: { type: 'metrics_snapshot' },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { text: true, createdAt: true },
    });

    const history = snapshots.map(s => {
      try { return JSON.parse(s.text) as MetricsSnapshot; }
      catch { return null; }
    }).filter(Boolean);

    return json({ status: 'ok', count: history.length, history });
  }

  // Collect fresh snapshot
  const snapshot = await collectSnapshot();

  // Store snapshot for SPC history
  await prisma.tweet.create({
    data: {
      type: 'metrics_snapshot',
      text: JSON.stringify(snapshot),
      status: 'completed',
    },
  }).catch(() => {});

  return json({ status: 'ok', snapshot });
}, 'Metrics: collection failed');
