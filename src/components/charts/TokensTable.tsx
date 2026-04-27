// src/components/charts/TokensTable.tsx — Sortable token table

'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatUsd, formatPercent, formatPriceSubscript } from './format';
import type { TokenSummary } from '@/lib/radix/tokens';

type SortKey = 'rank' | 'name' | 'price' | 'change24h' | 'volume24h' | 'marketCap' | 'tvl';

export function TokensTable({ tokens, limit }: { tokens: TokenSummary[]; limit?: number }) {
  const [sortKey, setSortKey] = useState<SortKey>('tvl');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sorted = useMemo(() => {
    const arr = [...tokens];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') cmp = (a.symbol || a.name).localeCompare(b.symbol || b.name);
      else if (sortKey === 'price') cmp = a.price - b.price;
      else if (sortKey === 'change24h') cmp = (a.change24h ?? -Infinity) - (b.change24h ?? -Infinity);
      else if (sortKey === 'volume24h') cmp = (a.volume24h ?? 0) - (b.volume24h ?? 0);
      else if (sortKey === 'marketCap') cmp = (a.marketCap ?? 0) - (b.marketCap ?? 0);
      else if (sortKey === 'tvl') cmp = (a.tvl ?? 0) - (b.tvl ?? 0);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return limit ? arr.slice(0, limit) : arr;
  }, [tokens, sortKey, sortDir, limit]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'name' ? 'asc' : 'desc'); }
  };

  const SortHead = ({ k, label, className }: { k: SortKey; label: string; className?: string }) => (
    <th className={cn('data-table-th', className)}>
      <button onClick={() => handleSort(k)} className={cn('sort-header', sortKey === k && 'sort-header-active')}>
        {label}
        {sortKey === k && (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
      </button>
    </th>
  );

  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th className="data-table-th w-12">#</th>
            <SortHead k="name" label="Token" />
            <SortHead k="price" label="Price" className="text-right" />
            <SortHead k="change24h" label="24h %" className="text-right" />
            <SortHead k="volume24h" label="Volume 24h" className="text-right hidden-mobile" />
            <SortHead k="tvl" label="TVL" className="text-right hidden-mobile" />
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
