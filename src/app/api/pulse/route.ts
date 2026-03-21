// src/app/api/pulse/route.ts — Pulse agent (brainstem): health monitoring + self-healing
//
// Checks all autonomous agents are running on schedule. If any are stale,
// re-triggers them. Logs health status for trend analysis.

import { prisma } from '@/lib/prisma/client';
import { json, handleRoute, requireCron } from '@/lib/api';

export const maxDuration = 60;

interface AgentHealth {
  name: string;
  status: 'healthy' | 'stale' | 'error';
  lastRun: string | null;
  ageHours: number | null;
  threshold: string;
}

const AGENTS = [
  { name: 'moltbook_posting', type: 'moltbook', statusFilter: 'sent', maxAgeHours: 24, cronPath: '/api/moltbook' },
  { name: 'moltbook_replies', type: 'moltbook_reply', statusFilter: 'sent', maxAgeHours: 24, cronPath: '/api/moltbook/reply' },
  { name: 'twitter_posting', type: 'twitter', statusFilter: 'sent', maxAgeHours: 48, cronPath: '/api/twitter' },
  { name: 'scout_intel', type: 'scout_intel', statusFilter: null, maxAgeHours: 24, cronPath: '/api/scout' },
  { name: 'sentinel_check', type: 'sentinel_check', statusFilter: null, maxAgeHours: 168, cronPath: '/api/sentinel' },
  { name: 'mend', type: 'mend', statusFilter: 'sent', maxAgeHours: 48, cronPath: '/api/mend' },
] as const;

export async function GET(request: Request) {
  return handleRoute(async () => {
    const cronErr = requireCron(request);
    if (cronErr) return cronErr;

    const now = Date.now();
    const checks: AgentHealth[] = [];
    const healed: string[] = [];

    // Check each agent's last successful run
    for (const agent of AGENTS) {
      const where: Record<string, unknown> = { type: agent.type };
      if (agent.statusFilter) where.status = agent.statusFilter;

      const last = await prisma.tweet.findFirst({
        where,
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });

      const ageHours = last ? Math.round((now - last.createdAt.getTime()) / 3_600_000) : null;
      const isStale = ageHours === null || ageHours > agent.maxAgeHours;

      checks.push({
        name: agent.name,
        status: isStale ? 'stale' : 'healthy',
        lastRun: last?.createdAt.toISOString() ?? null,
        ageHours,
        threshold: `<${agent.maxAgeHours}h`,
      });
    }

    // Error rate in last 24h
    const dayAgo = new Date(now - 24 * 3_600_000);
    const [errorCount, totalCount] = await Promise.all([
      prisma.tweet.count({ where: { status: 'failed', createdAt: { gte: dayAgo } } }),
      prisma.tweet.count({ where: { createdAt: { gte: dayAgo } } }),
    ]);
    const errorRate = totalCount > 0 ? errorCount / totalCount : 0;
    checks.push({
      name: 'error_rate_24h',
      status: errorRate < 0.3 ? 'healthy' : 'error',
      lastRun: null,
      ageHours: null,
      threshold: `${errorCount}/${totalCount} (${Math.round(errorRate * 100)}%)`,
    });

    // Self-heal: re-trigger stale agents
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://radix.wiki';
    for (const agent of AGENTS) {
      const check = checks.find(c => c.name === agent.name);
      if (check?.status !== 'stale') continue;

      try {
        await fetch(`${baseUrl}${agent.cronPath}`, {
          headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
        });
        healed.push(agent.name);
      } catch { /* will retry next cycle */ }
    }

    const overall = checks.every(c => c.status === 'healthy') ? 'healthy'
      : checks.some(c => c.status === 'error') ? 'error' : 'degraded';

    // Count pending scout intel for awareness
    const pendingIntel = await prisma.tweet.count({ where: { type: 'scout_intel', status: 'flagged' } });

    // Log pulse result for trend tracking
    await prisma.tweet.create({
      data: {
        type: 'pulse',
        text: JSON.stringify({ overall, checks, healed, pendingIntel }),
        status: overall,
      },
    }).catch(() => {});

    return json({ status: overall, checks, healed, pendingIntel, timestamp: new Date().toISOString() });
  }, 'Pulse: health check failed');
}
