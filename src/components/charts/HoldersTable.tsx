// src/components/charts/HoldersTable.tsx – the holder columns of the shared DataTable

'use client';

import { shortenAddress } from '@/lib/utils';
import { DataTable, type Column } from './DataTable';
import { formatCompact, formatPercent } from './format';

export type HolderRow = {
  address: string;
  /** Set for a validator, whose name the validator table already shows. Accounts name themselves, so they stay addresses. */
  name?: string;
  kind: string;
  href: string;
  amount: number;
  /** Fraction of total supply; unset when the supply was not read. */
  share?: number;
};

const COLUMNS: Column<HolderRow>[] = [
  {
    k: 'holder', label: 'Holder', text: h => h.name ?? h.address,
    cell: h => (
      <>
        <a href={h.href} target="_blank" rel="noopener" className="font-medium hover:text-accent">{h.name ?? shortenAddress(h.address)}</a>
        <div className="text-xs text-text-muted">{h.name ? `${h.kind} · ${shortenAddress(h.address)}` : h.kind}</div>
      </>
    ),
  },
  { k: 'amount', label: 'Amount', className: 'text-right', cellClass: 'font-medium', num: h => h.amount, cell: h => formatCompact(h.amount) },
  { k: 'share', label: 'Share of supply', className: 'text-right hidden-mobile', num: h => h.share ?? -1, cell: h => formatPercent(h.share === undefined ? undefined : h.share * 100) },
];

export function HoldersTable({ holders }: { holders: HolderRow[] }) {
  return <DataTable rows={holders} columns={COLUMNS} defaultKey="amount" rowKey={h => h.address} empty="No holders found." />;
}
