// src/components/charts/ValidatorsTable.tsx — The validator columns of the shared DataTable

'use client';

import Image from 'next/image';
import { shortenAddress } from '@/lib/utils';
import { DataTable, type Column } from './DataTable';
import { formatXrd, formatPercent } from './format';
import type { Validator } from '@/lib/radix/validators';

const COLUMNS: Column<Validator>[] = [
  {
    k: 'name', label: 'Validator', text: v => v.name,
    cell: v => (
      <>
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
      </>
    ),
  },
  { k: 'totalStake', label: 'Total Stake', className: 'text-right', cellClass: 'font-medium', num: v => v.totalStake, cell: v => formatXrd(v.totalStake) },
  { k: 'fee', label: 'Fee', className: 'text-right hidden-mobile', num: v => v.fee, cell: v => formatPercent(v.fee * 100) },
  { k: 'ownerStake', label: 'Owner Stake', className: 'text-right hidden-mobile', num: v => v.ownerStake, cell: v => formatXrd(v.ownerStake) },
];

export function ValidatorsTable({ validators, limit }: { validators: Validator[]; limit?: number }) {
  return <DataTable rows={validators} columns={COLUMNS} defaultKey="totalStake" rowKey={v => v.address} limit={limit} empty="No validators found." />;
}
