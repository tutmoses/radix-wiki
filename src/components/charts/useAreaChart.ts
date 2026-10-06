// src/components/charts/useAreaChart.ts – one lightweight-charts area series, themed for /charts

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';

export type ChartPoint = { time: number; value: number };

/**
 * Creates the chart on mount, sized to its container and resized with it. `show` replaces
 * the series and fits the time scale to it. `timeVisible` is off for daily data, where an
 * hour on the axis means nothing. Pass a module-level `formatter`: a new one rebuilds the chart.
 */
export function useAreaChart(height: number, formatter: (n: number) => string, timeVisible = true) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;
    let ro: ResizeObserver | null = null;

    import('lightweight-charts').then(({ createChart, AreaSeries, ColorType, LineType, CrosshairMode }) => {
      if (disposed || !containerRef.current) return;

      const chart = createChart(containerRef.current, {
        layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#8b8fa3', fontFamily: 'inherit', fontSize: 10 },
        grid: { vertLines: { color: 'rgba(139, 143, 163, 0.1)' }, horzLines: { color: 'rgba(139, 143, 163, 0.1)' } },
        crosshair: { mode: CrosshairMode.Magnet, vertLine: { color: 'rgba(255, 157, 160, 0.4)', width: 1, style: 3 }, horzLine: { color: 'rgba(255, 157, 160, 0.4)', width: 1, style: 3 } },
        rightPriceScale: { visible: true, borderVisible: false, scaleMargins: { top: 0.1, bottom: 0.1 } },
        timeScale: { borderVisible: false, timeVisible, secondsVisible: false },
        handleScroll: false,
        handleScale: false,
        width: containerRef.current.clientWidth,
        height,
      });

      seriesRef.current = chart.addSeries(AreaSeries, {
        lineColor: '#ff9da0',
        topColor: 'rgba(255, 157, 160, 0.4)',
        bottomColor: 'rgba(255, 157, 160, 0.02)',
        lineWidth: 2,
        lineType: LineType.Curved,
        crosshairMarkerBackgroundColor: '#ff9da0',
        crosshairMarkerBorderColor: '#ff9da0',
        priceFormat: { type: 'custom', formatter, minMove: 0.0001 },
      });
      chartRef.current = chart;
      setReady(true);

      ro = new ResizeObserver(entries => {
        const w = entries[0]?.contentRect?.width;
        if (w) chart.applyOptions({ width: w });
      });
      ro.observe(containerRef.current);
    });

    return () => { disposed = true; ro?.disconnect(); chartRef.current?.remove(); chartRef.current = null; seriesRef.current = null; setReady(false); };
  }, [height, formatter, timeVisible]);

  const show = useCallback((points: ChartPoint[]) => {
    if (containerRef.current) chartRef.current?.applyOptions({ width: containerRef.current.clientWidth });
    seriesRef.current?.setData(points.map(p => ({ time: p.time as UTCTimestamp, value: p.value })));
    chartRef.current?.timeScale().fitContent();
  }, []);

  return { containerRef, ready, show };
}
