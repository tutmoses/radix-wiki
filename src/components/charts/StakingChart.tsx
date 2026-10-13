// src/components/charts/StakingChart.tsx – the weekly network snapshot, one figure at a time

'use client';

import Link from 'next/link';
import { MetricChart, type Metric } from './MetricChart';
import { NETWORK_EVENTS, NETWORK_MARKERS } from '@/lib/radix/events';
import type { WeeklyPoint } from '@/lib/radix/weekly';

type Key = Exclude<keyof WeeklyPoint, 'time'>;

const METRICS: Metric<Key>[] = [
  { key: 'totalStake', label: 'Total stake ($XRD)' },
  { key: 'stakedShare', label: 'Share of supply staked', percent: true },
  { key: 'top10Share', label: 'Stake held by the largest 10', percent: true },
  { key: 'nakamoto', label: 'Validators holding a third' },
  { key: 'active', label: 'Active validators' },
  { key: 'dexTvlXrd', label: 'OciSwap TVL ($XRD)' },
  { key: 'dexVolumeXrd', label: 'OciSwap 7-day volume ($XRD)' },
  { key: 'swaps', label: 'OciSwap 7-day swaps' },
];

/** `recordHref` is the Network Weekly page, passed in so this client module never imports the server-side reader. */
export function StakingChart({ weeks, recordHref }: { weeks: WeeklyPoint[]; recordHref: string }) {
  return (
    <MetricChart
      points={weeks}
      metrics={METRICS}
      param="w"
      period="week"
      compare={{ points: 1, label: 'the week before' }}
      single
      markers={NETWORK_MARKERS}
      events={NETWORK_EVENTS}
      caption={<>
        One reading a week, kept on the <Link href={recordHref}>Network Weekly</Link> page since 16 August 2026; the
        network was halted in the week of 6 September, so that week has none. OciSwap figures are OciSwap&apos;s own pools; CaviarNine, DefiPlaza and the other exchanges are not in them.
      </>}
    />
  );
}
