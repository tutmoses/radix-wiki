// src/components/charts/ActivityChart.tsx – daily ledger activity, one metric at a time

'use client';

import { MetricChart, type Metric } from './MetricChart';
import { NETWORK_EVENTS, NETWORK_MARKERS } from '@/lib/radix/events';
import { ACTIVITY_METRICS, type ActivityMetric } from '@/lib/radix/metrics';
import type { LedgerDayPoint } from '@/lib/radix/activity';

const METRICS: Metric<ActivityMetric>[] = [...ACTIVITY_METRICS];

const longDay = (time: number) => new Date(time * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** `dataUrl` is the series' API, absolute: a download, not a page to route to. */
export function ActivityChart({ days, dataUrl }: { days: LedgerDayPoint[]; dataUrl: string }) {
  const first = days[0], last = days.at(-1);
  return (
    <MetricChart
      points={days}
      metrics={METRICS}
      param="m"
      period="day"
      compare={{ points: 30, label: 'the 30 days before' }}
      markers={NETWORK_MARKERS}
      events={NETWORK_EVENTS}
      caption={first && last && (
        <>
          Daily figures from {longDay(first.time)} to {longDay(last.time)}, in UTC days. A week or month point is the total of its days, so the week in progress counts only the days so far, and an account active on three days of a week counts three times. Counts cover the transactions
          people submit, not the ones the network makes for itself each round. An active account is one whose balance
          changed. Burned $XRD is the half of each network fee that is destroyed, plus any $XRD burned on purpose.
          {' '}<a href={`${dataUrl}?format=csv`} download>Download CSV</a> · <a href={dataUrl}>JSON</a>
        </>
      )}
    />
  );
}
