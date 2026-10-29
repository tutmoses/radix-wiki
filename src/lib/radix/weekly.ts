// src/lib/radix/weekly.ts – the weekly network snapshot as a series /charts can plot.
//
// scripts/network-snapshot.mjs reads /api/charts/snapshot every week and keeps the
// reading in the Network Weekly page's `metadata.state.snapshots`. That page is the
// record; this only reads it back, so staking history needs no table and no cron of
// its own, and starts on 16 August 2026, the first stored week.

import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma/client';

export const WEEKLY_PAGE = { tagPath: 'contents/tech/operations', slug: 'network-weekly' } as const;

type Snapshot = {
  week: string;
  totalStake?: number;
  activeStake?: number;
  xrdSupply?: number;
  nakamoto?: number;
  top10Share?: number;
};

/** One week, as /charts plots it: `time` in UTC seconds. A figure the week did not record is NaN, which serialises as null and is dropped from that metric's line. */
export interface WeeklyPoint {
  time: number;
  totalStake: number;
  stakedShare: number;
  nakamoto: number;
  top10Share: number;
}

const figure = (n: number | undefined | null) => (typeof n === 'number' && isFinite(n) ? n : NaN);

export const getWeeklySnapshots = unstable_cache(
  async (): Promise<WeeklyPoint[]> => {
    const page = await prisma.wikiPage.findUnique({ where: { siteId_tagPath_slug: { siteId: '', ...WEEKLY_PAGE } }, select: { metadata: true } });
    const snapshots = ((page?.metadata as { state?: { snapshots?: Snapshot[] } } | null)?.state?.snapshots ?? [])
      .filter(s => /^\d{4}-\d{2}-\d{2}$/.test(s.week))
      .sort((a, b) => a.week.localeCompare(b.week));
    return snapshots.map(s => ({
      time: Date.parse(`${s.week}T00:00:00Z`) / 1000,
      totalStake: figure(s.totalStake),
      stakedShare: s.totalStake && s.xrdSupply ? (s.totalStake / s.xrdSupply) * 100 : NaN,
      nakamoto: figure(s.nakamoto),
      top10Share: figure(s.top10Share),
    }));
  },
  ['network-weekly-v2'],
  // The snapshot script writes through the `wiki` tag like every page edit.
  { revalidate: 86400, tags: ['wiki'] },
);
