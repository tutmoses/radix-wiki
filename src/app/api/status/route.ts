// src/app/api/status/route.ts — Agent cluster health overview
//
// GET: Returns latest Pulse data, per-agent health, queue depth, errors, and flagged intel.
// No auth required — read-only, no sensitive data. Checkable via curl or browser.

import { prisma } from '@/lib/prisma/client';
import { json, handleRoute } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handleRoute(async () => {
    // Latest Pulse record
    const latestPulse = await prisma.tweet.findFirst({
      where: { type: 'pulse' },
      orderBy: { createdAt: 'desc' },
      select: { text: true, status: true, createdAt: true },
    });

    let pulse: { overall: string; checks?: unknown; healed?: unknown; lastRun: string; ageMinutes: number } | null = null;
    if (latestPulse) {
      const data = JSON.parse(latestPulse.text);
      pulse = {
        overall: data.overall,
        checks: data.checks,
        healed: data.healed,
        lastRun: latestPulse.createdAt.toISOString(),
        ageMinutes: Math.round((Date.now() - latestPulse.createdAt.getTime()) / 60_000),
      };
    }

    // Tweet queue
    const [queueDepth, errors24h, flaggedIntel] = await Promise.all([
      prisma.tweet.count({ where: { type: 'twitter', status: 'queued' } }),
      prisma.tweet.count({ where: { status: 'failed', createdAt: { gte: new Date(Date.now() - 86_400_000) } } }),
      prisma.tweet.findMany({
        where: { type: 'scout_intel', status: 'flagged' },
        select: { text: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    const intel = flaggedIntel.map(i => {
      try { return { ...JSON.parse(i.text), flaggedAt: i.createdAt.toISOString() }; }
      catch { return { raw: i.text, flaggedAt: i.createdAt.toISOString() }; }
    });

    return json({
      pulse,
      tweetQueue: queueDepth,
      errors24h,
      flaggedIntel: intel,
    });
  }, 'Status: failed');
}
