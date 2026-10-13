// src/components/charts/ValidatorsTable.tsx — The validator columns of the shared DataTable

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { cn, shortenAddress } from '@/lib/utils';
import { DataTable, type Column } from './DataTable';
import { EntityIcon } from './EntityIcon';
import { formatXrd, formatPercent } from './format';
import type { Validator } from '@/lib/radix/validators';

/** A validator row: its wiki page where one documents it, and the staker's estimated APR where it is active. */
export type ValidatorRow = Validator & { wikiPath?: string; apr?: number };

/** Below this a validator is likely to miss whole epochs' emissions, since one missed proposal forfeits an epoch. */
const RELIABLE_UPTIME = 0.999;
const LOW_FEE = 0.01;

const COLUMNS: Column<ValidatorRow>[] = [
  {
    k: 'name', label: 'Validator', text: v => v.name,
    cell: v => (
      <>
        <div className="row">
          <EntityIcon src={v.iconUrl} name={v.name} />
          <span className="font-medium truncate">{v.name}</span>
          {!v.isRegistered && <span className="badge badge-warning">unreg</span>}
          {v.wikiPath && (
            <Link href={v.wikiPath} className="table-wiki-link" title="Wiki article" aria-label={`${v.name} on the wiki`}>
              <BookOpen size={14} />
            </Link>
          )}
        </div>
        <a href={`https://dashboard.radixdlt.com/network-staking/${v.address}`} target="_blank" rel="noopener" className="text-xs text-text-muted hover:text-accent">{shortenAddress(v.address)}</a>
      </>
    ),
  },
  { k: 'totalStake', label: 'Total Stake', className: 'text-right', cellClass: 'font-medium', num: v => v.totalStake, cell: v => formatXrd(v.totalStake) },
  { k: 'stakeShare', label: 'Share', className: 'text-right hidden-mobile', num: v => v.stakeShare, cell: v => formatPercent(v.stakeShare * 100) },
  {
    k: 'fee', label: 'Fee', className: 'text-right hidden-mobile', num: v => v.fee, ascending: true,
    cell: v => (
      <>
        {formatPercent(v.fee * 100)}
        {v.feeChange && (
          <div className="text-xs text-warning" title={`Takes effect at epoch ${v.feeChange.epoch.toLocaleString('en-US')}`}>
            → {formatPercent(v.feeChange.fee * 100)}{v.feeChange.around && ` around ${v.feeChange.around}`}
          </div>
        )}
      </>
    ),
  },
  { k: 'apr', label: 'Staker APR', className: 'text-right hidden-mobile', num: v => v.apr ?? -1, cell: v => formatPercent(v.apr === undefined ? undefined : v.apr * 100) },
  {
    k: 'uptime', label: 'Uptime 7d', className: 'text-right hidden-mobile', num: v => v.uptime ?? -1,
    cellClass: v => (v.uptime !== undefined && v.uptime < RELIABLE_UPTIME ? 'text-warning' : undefined),
    cell: v => formatPercent(v.uptime === undefined ? undefined : v.uptime * 100),
  },
  { k: 'ownerStake', label: 'Owner Stake', className: 'text-right hidden-mobile', num: v => v.ownerStake ?? -1, cell: v => formatXrd(v.ownerStake) },
];

/** `filterable` adds the low-fee, reliable filter: the full directory has one, the top ten does not need it. */
export function ValidatorsTable({ validators, limit, filterable }: { validators: ValidatorRow[]; limit?: number; filterable?: boolean }) {
  const [reliable, setReliable] = useState(false);
  const rows = reliable ? validators.filter(v => v.isActive && v.fee <= LOW_FEE && (v.uptime ?? 0) >= RELIABLE_UPTIME && !v.feeChange) : validators;
  return (
    <div className="stack-sm">
      {filterable && (
        <div className="row text-small">
          <button type="button" aria-pressed={reliable} onClick={() => setReliable(r => !r)} className={cn('toggle-option normal-case', reliable && 'toggle-option-active')}>
            Fee 1% or less, 7-day uptime 99.9% or more
          </button>
          {reliable && <span className="text-text-muted">{rows.length} of {validators.length}, active and with no fee rise pending</span>}
        </div>
      )}
      <DataTable rows={rows} columns={COLUMNS} defaultKey="totalStake" rowKey={v => v.address} rowId={v => v.address} limit={limit} empty="No validators found." />
    </div>
  );
}
