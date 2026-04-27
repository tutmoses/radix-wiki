// src/components/charts/ValidatorsTable.tsx — Sortable validator table

'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { cn, shortenAddress } from '@/lib/utils';
import { formatXrd, formatPercent } from './format';
import type { Validator } from '@/lib/radix/validators';

type SortKey = 'rank' | 'name' | 'totalStake' | 'fee' | 'ownerStake';

export function ValidatorsTable({ validators, limit }: { validators: Validator[]; limit?: number }) {
  const [sortKey, setSortKey] = useState<SortKey>('totalStake');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sorted = useMemo(() => {
    const arr = [...validators];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortKey === 'totalStake') cmp = a.totalStake - b.totalStake;
      else if (sortKey === 'fee') cmp = a.fee - b.fee;
      else if (sortKey === 'ownerStake') cmp = a.ownerStake - b.ownerStake;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return limit ? arr.slice(0, limit) : arr;
  }, [validators, sortKey, sortDir, limit]);

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
            <SortHead k="name" label="Validator" />
            <SortHead k="totalStake" label="Total Stake" className="text-right" />
            <SortHead k="fee" label="Fee" className="text-right hidden-mobile" />
            <SortHead k="ownerStake" label="Owner Stake" className="text-right hidden-mobile" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((v, i) => (
            <tr key={v.address} className="data-table-row">
              <td className="data-table-td text-text-muted">{i + 1}</td>
              <td className="data-table-td">
                <div className="row">
                  {v.iconUrl ? (
                    <Image src={v.iconUrl} alt={v.name} width={20} height={20} className="rounded-full shrink-0" unoptimized />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-surface-2 shrink-0" />
                  )}
                  <span className="font-medium truncate">{v.name}</span>
                  {!v.isRegistered && <span className="badge badge-warning">unreg</span>}
                </div>
                <div className="text-xs text-text-muted">{shortenAddress(v.address)}</div>
              </td>
              <td className="data-table-td text-right font-medium">{formatXrd(v.totalStake)}</td>
              <td className="data-table-td text-right hidden-mobile">{formatPercent(v.fee * 100)}</td>
              <td className="data-table-td text-right hidden-mobile">{formatXrd(v.ownerStake)}</td>
            </tr>
          ))}
          {!sorted.length && (
            <tr>
              <td colSpan={5} className="data-table-td text-center text-text-muted py-8">No validators found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
