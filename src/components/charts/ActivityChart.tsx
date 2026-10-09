// src/components/charts/ActivityChart.tsx – daily ledger activity, one metric at a time

'use client';

import { useMemo, useState } from 'react';
import { TimeChart } from 'wiki-formant/chart';
import { cn } from '@/lib/utils';
import type { LedgerDayPoint } from '@/lib/radix/activity';

type Metric = Exclude<keyof LedgerDayPoint, 'time'>;

const METRICS: { key: Metric; label: string }[] = [
  { key: 'transactions', label: 'Transactions' },
  { key: 'activeAccounts', label: 'Active accounts' },
  { key: 'newAccounts', label: 'New accounts' },
  { key: 'newComponents', label: 'Components created' },
  { key: 'newResources', label: 'Resources created' },
  { key: 'nftsMinted', label: 'NFTs minted' },
  { key: 'feesXrd', label: 'Fees ($XRD)' },
  { key: 'burnedXrd', label: '$XRD burned' },
  { key: 'royaltiesXrd', label: 'Royalties ($XRD)' },
];

const longDay = (time: number) => new Date(time * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export function ActivityChart({ days }: { days: LedgerDayPoint[] }) {
  const [metric, setMetric] = useState<Metric>('transactions');
  const series = useMemo(() => days.map(d => ({ time: d.time, value: d[metric] })), [days, metric]);
  const first = days[0], last = days.at(-1);

  return (
    <div className="stack-sm">
      <div className="activity-metrics">
        {METRICS.map(m => (
          <button key={m.key} onClick={() => setMetric(m.key)} className={cn('toggle-option', metric === m.key && 'toggle-option-active')}>
            {m.label}
          </button>
        ))}
      </div>
      <TimeChart series={series} label={METRICS.find(m => m.key === metric)!.label} range="1y" aggregate="mean" fromZero height={300} />
      {first && last && (
        <p className="text-small text-text-muted">
          Daily figures from {longDay(first.time)} to {longDay(last.time)}, in UTC days. A week or month is the mean of its days. Counts cover the transactions
          people submit, not the ones the network makes for itself each round. An active account is one whose balance
          changed. Burned $XRD is the half of each network fee that is destroyed, plus any $XRD burned on purpose.
        </p>
      )}
    </div>
  );
}
