// src/components/charts/TokensTable.tsx — Sortable token table

'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { SortHead, type SortColumn } from './SortHead';
import { formatUsd, formatPercent, formatPriceSubscript } from './format';
import type { TokenSummary } from '@/lib/radix/tokens';
import { useTableSort } from 'wiki-formant/react';

// `rank` used to be in this union with no column to select it and no branch in
// the sort — it fell through to cmp = 0. The shared hook takes an exhaustive
// comparator record, which is what surfaced it.
type SortKey = 'name' | 'price' | 'change24h' | 'volume24h' | 'marketCap' | 'tvl';

const COLUMNS: SortColumn<SortKey>[] = [
  { k: 'name', label: 'Token' },
  { k: 'price', label: 'Price', className: 'text-right' },
  { k: 'change24h', label: '24h %', className: 'text-right' },
  { k: 'volume24h', label: 'Volume 24h', className: 'text-right hidden-mobile' },
  { k: 'tvl', label: 'TVL', className: 'text-right hidden-mobile' },
];

export function TokensTable({ tokens, limit }: { tokens: TokenSummary[]; limit?: number }) {
  // The sort state machine is `useTableSort` from `wiki-formant/react`. It was
  // inlined here and, four lines apart, in ValidatorsTable. The comparator record
  // replaces the if-chain both copies used.
  const { sorted: all, sortKey, direction: sortDir, toggle: handleSort } = useTableSort(tokens, {
    defaultKey: 'tvl' as SortKey,
    comparators: {
      name: (a, b) => (a.symbol || a.name).localeCompare(b.symbol || b.name),
      price: (a, b) => a.price - b.price,
      change24h: (a, b) => (a.change24h ?? -Infinity) - (b.change24h ?? -Infinity),
      volume24h: (a, b) => (a.volume24h ?? 0) - (b.volume24h ?? 0),
      marketCap: (a, b) => (a.marketCap ?? 0) - (b.marketCap ?? 0),
      tvl: (a, b) => (a.tvl ?? 0) - (b.tvl ?? 0),
    },
    // A name column opens A–Z; every numeric column opens largest first.
    defaultDirection: key => (key === 'name' ? 'asc' : 'desc'),
  });
  const sorted = useMemo(() => (limit ? all.slice(0, limit) : all), [all, limit]);

  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th className="data-table-th w-12">#</th>
            {COLUMNS.map(c => (
              <SortHead key={c.k} {...c} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((t, i) => {
            const change = t.change24h;
            const pos = (change ?? 0) >= 0;
            return (
              <tr key={t.address} className="data-table-row">
                <td className="data-table-td text-text-muted">{i + 1}</td>
                <td className="data-table-td">
                  <Link href={`/charts/tokens/${t.address}`} className="row group">
                    {t.iconUrl ? (
                      <Image src={t.iconUrl} alt={t.symbol || t.name} width={20} height={20} className="rounded-full shrink-0" unoptimized />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-surface-2 shrink-0" />
                    )}
                    <div className="stack-xs min-w-0">
                      <span className="font-medium group-hover:text-accent transition-colors truncate">{t.symbol || t.name}</span>
                      {t.symbol && t.name && t.symbol !== t.name && <span className="text-xs text-text-muted truncate">{t.name}</span>}
                    </div>
                  </Link>
                </td>
                <td className="data-table-td text-right font-medium">${formatPriceSubscript(t.price)}</td>
                <td className={cn('data-table-td text-right', change !== undefined && (pos ? 'text-success' : 'text-error'))}>
                  {change !== undefined ? `${pos ? '+' : ''}${formatPercent(change)}` : '—'}
                </td>
                <td className="data-table-td text-right hidden-mobile">{formatUsd(t.volume24h)}</td>
                <td className="data-table-td text-right hidden-mobile">{formatUsd(t.tvl)}</td>
              </tr>
            );
          })}
          {!sorted.length && (
            <tr>
              <td colSpan={6} className="data-table-td text-center text-text-muted py-8">No tokens found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
