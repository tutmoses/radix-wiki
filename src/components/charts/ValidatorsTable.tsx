// src/components/charts/ValidatorsTable.tsx — Sortable validator table

'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { shortenAddress } from '@/lib/utils';
import { SortHead, type SortColumn } from './SortHead';
import { formatXrd, formatPercent } from './format';
import type { Validator } from '@/lib/radix/validators';
import { useTableSort } from 'wiki-formant/react';

// `rank` was in this union with no column to select it and no branch in the
// sort — the same dead key the sibling table carried, copied along with the
// state machine. The shared hook's exhaustive comparator record surfaced both.
type SortKey = 'name' | 'totalStake' | 'fee' | 'ownerStake';

const COLUMNS: SortColumn<SortKey>[] = [
  { k: 'name', label: 'Validator' },
  { k: 'totalStake', label: 'Total Stake', className: 'text-right' },
  { k: 'fee', label: 'Fee', className: 'text-right hidden-mobile' },
  { k: 'ownerStake', label: 'Owner Stake', className: 'text-right hidden-mobile' },
];

export function ValidatorsTable({ validators, limit }: { validators: Validator[]; limit?: number }) {
  // `useTableSort` from `wiki-formant/react` — the same state machine that was
  // inlined here and in TokensTable, differing only in the seed and the payload.
  const { sorted: all, sortKey, direction: sortDir, toggle: handleSort } = useTableSort(validators, {
    defaultKey: 'totalStake' as SortKey,
    comparators: {
      name: (a, b) => a.name.localeCompare(b.name),
      totalStake: (a, b) => a.totalStake - b.totalStake,
      fee: (a, b) => a.fee - b.fee,
      ownerStake: (a, b) => a.ownerStake - b.ownerStake,
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
