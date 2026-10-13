// src/components/charts/MetricChart.tsx – one of several series at a time, with its headline and its events.
//
// The metric, range and step live in the query string (`?m=newAccounts&m-range=all`), so a
// link opens the view it was copied from. They are read after mount and written with
// replaceState: awaiting `searchParams` in the catch-all would make every article dynamic.

'use client';

import { useCallback, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import Link from 'next/link';
import { TimeChart, chartSteps, formatChartValue, type ChartMarker, type ChartRange, type ChartStep, type ChartView } from 'wiki-formant/chart';
import { cn } from '@/lib/utils';
import type { NetworkEvent } from '@/lib/radix/events';

export type Metric<K extends string> = { key: K; label: string; percent?: boolean };
type Point<K extends string> = { time: number } & Record<K, number | null>;

const DAY = 86_400;
const SPAN: Partial<Record<ChartRange, number>> = { '30d': 30 * DAY, '90d': 90 * DAY, '1y': 365 * DAY };
const RANGES: ChartRange[] = ['30d', '90d', '1y', 'all'];
const STEPS: ChartStep[] = ['day', 'week', 'month'];

const longDay = (time: number) => new Date(time * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const shortDay = (time: number) => new Date(time * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** The step the chart opens a range on, so a URL carries a step only when the reader chose another. */
function fallbackStep(times: number[], range: ChartRange): ChartStep {
  const end = times.at(-1) ?? 0;
  const span = SPAN[range];
  const start = span === undefined ? times[0] : times.find(t => t > Date.now() / 1000 - span);
  return chartSteps(end - (start ?? end)).fallback;
}

// The query string as an external store. Nothing subscribes: the page writes it with
// replaceState, which fires no event, and only the first client read opens a view.
const subscribe = () => () => {};
const readSearch = () => window.location.search;

function writeQuery(patch: Record<string, string | null>) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  if (url.href !== window.location.href) window.history.replaceState(window.history.state, '', url);
}

export function MetricChart<K extends string>({ points, metrics, param, period, compare, range: defaultRange = '1y', single, markers, events, caption }: {
  points: Point<K>[];
  metrics: Metric<K>[];
  /** The query key for the metric; the range and step take `<param>-range` and `<param>-step`. */
  param: string;
  /** What one point is, for the headline: a day's figure or a week's reading. */
  period: 'day' | 'week';
  /** The headline compares the latest point with the mean of this many before it. */
  compare: { points: number; label: string };
  range?: ChartRange;
  /** Every point at once, no range buttons: a short series. */
  single?: boolean;
  markers?: ChartMarker[];
  events?: NetworkEvent[];
  caption?: ReactNode;
}) {
  // `null` on the server and through hydration, so the prerendered page is the default view.
  const search = useSyncExternalStore(subscribe, readSearch, () => null);
  const query = useMemo(() => {
    if (search === null) return null;
    const q = new URLSearchParams(search);
    const m = q.get(param), r = q.get(`${param}-range`) as ChartRange | null, s = q.get(`${param}-step`) as ChartStep | null;
    return {
      metric: metrics.find(x => x.key === m)?.key,
      range: r && RANGES.includes(r) ? r : defaultRange,
      ...(s && STEPS.includes(s) && { step: s }),
    };
  }, [search, param, metrics, defaultRange]);
  const [picked, setPicked] = useState<K | null>(null);
  const metric = picked ?? query?.metric ?? metrics[0]!.key;
  const current = metrics.find(m => m.key === metric)!;

  const series = useMemo(
    () => points.flatMap(p => (typeof p[metric] === 'number' && isFinite(p[metric]) ? [{ time: p.time, value: p[metric] }] : [])),
    [points, metric],
  );
  const format = useCallback((n: number) => (current.percent ? `${n.toFixed(1)}%` : formatChartValue(n)), [current.percent]);

  const pick = (key: K) => {
    setPicked(key);
    writeQuery({ [param]: key === metrics[0]!.key ? null : key });
  };
  const onView = useCallback(({ range, step }: ChartView) => {
    // The server-rendered chart reports on mount too: until the query string has been read,
    // a report would erase the view the client chart is about to open on.
    if (single || !step || !query) return;
    const times = series.map(p => p.time);
    writeQuery({
      [`${param}-range`]: range === defaultRange ? null : range,
      [`${param}-step`]: step === fallbackStep(times, range) ? null : step,
    });
  }, [single, series, param, defaultRange, query]);

  const headline = useMemo(() => {
    const last = series.at(-1);
    if (!last) return null;
    const before = series.slice(-1 - compare.points, -1);
    const mean = before.reduce((sum, p) => sum + p.value, 0) / (before.length || 1);
    const change = before.length && mean > 0 ? ((last.value - mean) / mean) * 100 : undefined;
    const high = series.reduce((top, p) => (p.value > top.value ? p : top), last);
    return { last, change, high };
  }, [series, compare.points]);

  const first = points[0]?.time;
  const shownEvents = events?.filter(e => first !== undefined && Date.parse(e.date) / 1000 >= first);

  return (
    <div className="stack-sm">
      <div className="metric-pills" role="group" aria-label="Metric">
        {metrics.map(m => (
          <button key={m.key} type="button" aria-pressed={metric === m.key} onClick={() => pick(m.key)} className={cn('toggle-option', metric === m.key && 'toggle-option-active')}>
            {m.label}
          </button>
        ))}
      </div>

      {headline && (
        <div className="metric-headline">
          <span className="stat-value">{format(headline.last.value)}</span>
          <span className="text-small text-text-muted">
            {current.label}, {period === 'week' ? 'week of ' : ''}{longDay(headline.last.time)}
          </span>
          {headline.change !== undefined && !current.percent && (
            <span className={cn('text-small font-medium', headline.change >= 0 ? 'text-success' : 'text-error')}>
              {headline.change >= 0 ? '↑' : '↓'} {Math.abs(headline.change).toFixed(1)}% vs {compare.label}
            </span>
          )}
          {headline.high !== headline.last && (
            <span className="text-small text-text-muted">All-time high {format(headline.high.value)} on {shortDay(headline.high.time)}</span>
          )}
        </div>
      )}

      <TimeChart
        // Remounted once, when the client reads the query string; later writes change no key.
        key={query ? 'client' : 'server'}
        series={series}
        label={current.label}
        ranges={single ? ['all'] : RANGES}
        range={single ? 'all' : query?.range ?? defaultRange}
        step={query?.step}
        onView={onView}
        aggregate="mean"
        fromZero={!current.percent}
        format={format}
        markers={markers}
        height={300}
      />

      {shownEvents && shownEvents.length > 0 && (
        <p className="metric-events">
          <span className="text-text-muted">Marked: </span>
          {shownEvents.map((e, i) => (
            <span key={e.date}>
              {i > 0 && ' · '}
              <Link href={e.href}>{e.title}</Link> <span className="text-text-muted">{shortDay(Date.parse(e.date) / 1000)}</span>
            </span>
          ))}
        </p>
      )}
      {caption && <p className="text-small text-text-muted">{caption}</p>}
    </div>
  );
}
