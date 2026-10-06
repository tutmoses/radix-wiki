// src/components/charts/ActivityChart.tsx – daily ledger activity, one metric at a time

'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { LedgerDayPoint } from '@/lib/radix/activity';
import { formatAmount } from './format';
import { useAreaChart } from './useAreaChart';

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

const RANGES = [
  { key: '90d', label: '90D', days: 90 },
  { key: '1y', label: '1Y', days: 365 },
  { key: 'all', label: 'All', days: Infinity },
] as const;

const HEIGHT = 300;
const longDay = (time: number) => new Date(time * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export function ActivityChart({ days }: { days: LedgerDayPoint[] }) {
  const [metric, setMetric] = useState<Metric>('transactions');
  const [range, setRange] = useState<(typeof RANGES)[number]['key']>('1y');
  const { containerRef, ready, show } = useAreaChart(HEIGHT, formatAmount, false);

  const shown = useMemo(() => {
    const span = RANGES.find(r => r.key === range)!.days;
    return days.slice(Math.max(0, days.length - span));
  }, [days, range]);

  useEffect(() => {
    if (ready) show(shown.map(d => ({ time: d.time, value: d[metric] })));
  }, [ready, show, shown, metric]);

  const first = shown[0], last = shown.at(-1);

  return (
    <div className="stack-sm">
      <div className="activity-metrics">
        {METRICS.map(m => (
          <button key={m.key} onClick={() => setMetric(m.key)} className={cn('toggle-option', metric === m.key && 'toggle-option-active')}>
            {m.label}
          </button>
        ))}
      </div>
      <div className="asset-chart">
        <div className="asset-chart-controls">
          {RANGES.map(r => (
            <button key={r.key} onClick={() => setRange(r.key)} className={cn('toggle-option', range === r.key && 'toggle-option-active')}>
              {r.label}
            </button>
          ))}
        </div>
        <div ref={containerRef} className="asset-chart-container" style={{ minHeight: HEIGHT }}>
          {!ready && <div className="skeleton rounded" style={{ height: HEIGHT }} />}
        </div>
      </div>
      {first && last && (
        <p className="text-small text-text-muted">
          One point per UTC day, from {longDay(first.time)} to {longDay(last.time)}. Counts cover the transactions
          people submit, not the ones the network makes for itself each round. An active account is one whose balance
          changed. Burned $XRD is the half of each network fee that is destroyed, plus any $XRD burned on purpose.
        </p>
      )}
    </div>
  );
}
