// src/components/charts/TokenChart.tsx — Reusable token price chart (lightweight-charts)

'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { formatPriceSubscript } from './format';

const TIMEFRAME_CONFIG: Record<string, { resolution: string; seconds: number; countback: number }> = {
  '24h': { resolution: '60', seconds: 86400, countback: 24 },
  '7d': { resolution: '240', seconds: 604800, countback: 42 },
  '30d': { resolution: '1D', seconds: 2592000, countback: 30 },
  '90d': { resolution: '1D', seconds: 7776000, countback: 90 },
};
const TIMEFRAMES = ['24h', '7d', '30d', '90d'] as const;
const TIMEFRAME_LABELS: Record<string, string> = { '24h': '24H', '7d': '7D', '30d': '30D', '90d': '90D' };

type ChartPoint = { time: number; value: number };

function useChartData(resourceAddress?: string, timeframe: string = '7d') {
  const [data, setData] = useState<ChartPoint[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!resourceAddress) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const cfg = TIMEFRAME_CONFIG[timeframe] ?? TIMEFRAME_CONFIG['7d']!;
    const now = Math.floor(Date.now() / 1000);
    const from = now - cfg.seconds;
    const url = `https://api.ociswap.com/udf/history?symbol=${resourceAddress}&resolution=${cfg.resolution}&from=${from}&to=${now}&countback=${cfg.countback}&currencyCode=USD`;

    fetch(url)
      .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
      .then(json => {
        if (cancelled) return;
        if (json.s !== 'ok' || !Array.isArray(json.t)) { setError('No chart data'); return; }
        const points: ChartPoint[] = json.t.map((t: number, i: number) => ({ time: t, value: parseFloat(json.c[i]) || 0 }));
        setData(points);
      })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [resourceAddress, timeframe]);

  return { data, isLoading, error };
}

export function TokenChart({ resourceAddress, defaultTimeframe = '30d', height = 260 }: { resourceAddress: string; defaultTimeframe?: string; height?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const [timeframe, setTimeframe] = useState(defaultTimeframe);
  const [chartReady, setChartReady] = useState(false);
  const { data, isLoading, error } = useChartData(resourceAddress, timeframe);

  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;

    import('lightweight-charts').then(({ createChart, AreaSeries, ColorType, LineType, CrosshairMode }) => {
      if (disposed || !containerRef.current) return;

      const chart = createChart(containerRef.current, {
        layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#8b8fa3', fontFamily: 'inherit', fontSize: 10 },
        grid: { vertLines: { color: 'rgba(139, 143, 163, 0.1)' }, horzLines: { color: 'rgba(139, 143, 163, 0.1)' } },
        crosshair: { mode: CrosshairMode.Magnet, vertLine: { color: 'rgba(255, 157, 160, 0.4)', width: 1, style: 3 }, horzLine: { color: 'rgba(255, 157, 160, 0.4)', width: 1, style: 3 } },
        rightPriceScale: { visible: true, borderVisible: false, scaleMargins: { top: 0.1, bottom: 0.1 } },
        timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
        handleScroll: false,
        handleScale: false,
        width: containerRef.current.clientWidth,
        height,
      });

      const series = chart.addSeries(AreaSeries, {
        lineColor: '#ff9da0',
        topColor: 'rgba(255, 157, 160, 0.4)',
        bottomColor: 'rgba(255, 157, 160, 0.02)',
        lineWidth: 2,
        lineType: LineType.Curved,
        crosshairMarkerBackgroundColor: '#ff9da0',
        crosshairMarkerBorderColor: '#ff9da0',
        priceFormat: { type: 'custom', formatter: formatPriceSubscript, minMove: 0.0001 },
      });

      chartRef.current = chart;
      seriesRef.current = series;
      setChartReady(true);

      const ro = new ResizeObserver(entries => {
        const w = entries[0]?.contentRect?.width;
        if (w && chart) chart.applyOptions({ width: w });
      });
      ro.observe(containerRef.current);
      roRef.current = ro;
    });

    return () => { disposed = true; roRef.current?.disconnect(); roRef.current = null; chartRef.current?.remove(); chartRef.current = null; seriesRef.current = null; setChartReady(false); };
  }, [height]);

  useEffect(() => {
    if (!chartReady || !seriesRef.current || !data?.length) return;
    seriesRef.current.setData(data);
    chartRef.current?.timeScale().fitContent();
    if (containerRef.current) chartRef.current?.applyOptions({ width: containerRef.current.clientWidth });
  }, [data, chartReady]);

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
        {isLoading && !chartReady && <div className="skeleton rounded" style={{ height }} />}
        {error && <p className="text-error text-small p-4">{error}</p>}
      </div>
    </div>
  );
}
