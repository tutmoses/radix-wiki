// src/components/charts/TokenChart.tsx – a token's USD price from OciSwap, as wiki-formant's TimeChart

'use client';

import { useCallback } from 'react';
import { TimeChart, type ChartRange, type ChartResolution } from 'wiki-formant/chart';
import { formatPriceSubscript } from './format';
import { OCISWAP_API } from '@/lib/radix/config';

/** OciSwap's UDF resolution for each one the chart asks for. */
const UDF_RESOLUTION: Record<ChartResolution, string> = { hour: '60', '4h': '240', day: '1D' };

// The UDF response is columnar – parallel time, open, high, low, close and volume
// arrays, prices and volume as decimal strings – or `no_data` for a span without a
// trade, or an error.
type Column = (string | number)[];
type UdfResponse = { s?: string; t?: number[]; o?: Column; h?: Column; l?: Column; c?: Column; v?: Column };

export function TokenChart({ resourceAddress, defaultTimeframe = '30d', height = 260 }: { resourceAddress: string; defaultTimeframe?: ChartRange; height?: number }) {
  const load = useCallback(async (resolution: ChartResolution, from: number) => {
    const to = Math.floor(Date.now() / 1000);
    const res = await fetch(`${OCISWAP_API}/udf/history?symbol=${resourceAddress}&resolution=${UDF_RESOLUTION[resolution]}&from=${from}&to=${to}&countback=5000&currencyCode=USD`);
    const json: UdfResponse = await res.json();
    if (json.s === 'no_data') return [];
    if (json.s !== 'ok' || !Array.isArray(json.t)) throw new Error('No chart data');
    const at = (column: Column | undefined, i: number) => (column ? parseFloat(String(column[i])) || 0 : undefined);
    return json.t.map((time, i) => ({ time, value: at(json.c, i) ?? 0, open: at(json.o, i), high: at(json.h, i), low: at(json.l, i), volume: at(json.v, i) }));
  }, [resourceAddress]);

  return <TimeChart series={load} label="Price in USD" range={defaultTimeframe} format={formatPriceSubscript} height={height} />;
}
