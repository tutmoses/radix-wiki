// src/components/charts/TokenChart.tsx — Reusable token price chart (lightweight-charts)

'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { useFetch } from '@/hooks';
import { formatPriceSubscript } from './format';
import { OCISWAP_API } from '@/lib/radix/config';
import { useAreaChart, type ChartPoint } from './useAreaChart';

const TIMEFRAME_CONFIG: Record<string, { resolution: string; seconds: number; countback: number }> = {
  '24h': { resolution: '60', seconds: 86400, countback: 24 },
  '7d': { resolution: '240', seconds: 604800, countback: 42 },
  '30d': { resolution: '1D', seconds: 2592000, countback: 30 },
  '90d': { resolution: '1D', seconds: 7776000, countback: 90 },
};
const TIMEFRAMES = ['24h', '7d', '30d', '90d'] as const;
const TIMEFRAME_LABELS: Record<string, string> = { '24h': '24H', '7d': '7D', '30d': '30D', '90d': '90D' };

// The UDF response is columnar — parallel `t` and `c` arrays — or a status that
// is not `ok`. A throw in here surfaces as the fetch's own error.
type UdfResponse = { s?: string; t?: number[]; c?: (string | number)[] };

function toPoints(json: UdfResponse): ChartPoint[] {
  if (json.s !== 'ok' || !Array.isArray(json.t)) throw new Error('No chart data');
  return json.t.map((t, i) => ({ time: t, value: parseFloat(String(json.c?.[i])) || 0 }));
}

export function TokenChart({ resourceAddress, defaultTimeframe = '30d', height = 260 }: { resourceAddress: string; defaultTimeframe?: string; height?: number }) {
  const [timeframe, setTimeframe] = useState(defaultTimeframe);
  const { containerRef, ready, show } = useAreaChart(height, formatPriceSubscript);
  // Pinned to the render that changed the timeframe: `useFetch` keys off the URL,
  // and a `now` recomputed every render would refetch forever.
  const url = useMemo(() => {
    const cfg = TIMEFRAME_CONFIG[timeframe] ?? TIMEFRAME_CONFIG['7d']!;
    const now = Math.floor(Date.now() / 1000);
    return `${OCISWAP_API}/udf/history?symbol=${resourceAddress}&resolution=${cfg.resolution}&from=${now - cfg.seconds}&to=${now}&countback=${cfg.countback}&currencyCode=USD`;
  }, [resourceAddress, timeframe]);
  const { data, isLoading, error } = useFetch<ChartPoint[]>(url, { transform: toPoints });

  useEffect(() => {
    if (ready && data?.length) show(data);
  }, [data, ready, show]);

  return (
    <div className="asset-chart">
      <div className="asset-chart-controls">
        {TIMEFRAMES.map(tf => (
          <button key={tf} onClick={() => setTimeframe(tf)} className={cn('toggle-option', timeframe === tf && 'toggle-option-active')}>
            {TIMEFRAME_LABELS[tf]}
          </button>
        ))}
      </div>
      <div ref={containerRef} className="asset-chart-container" style={{ minHeight: height }}>
        {isLoading && !ready && <div className="skeleton rounded" style={{ height }} />}
        {error && <p className="text-error text-small p-4">{error}</p>}
      </div>
    </div>
  );
}
