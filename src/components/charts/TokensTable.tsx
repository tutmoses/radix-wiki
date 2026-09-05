// src/components/charts/TokensTable.tsx — The token columns of the shared DataTable

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { DataTable, type Column } from './DataTable';
import { formatUsd, formatPercent, formatPriceSubscript } from './format';
import type { TokenSummary } from '@/lib/radix/tokens';

const COLUMNS: Column<TokenSummary>[] = [
  {
    k: 'name', label: 'Token', text: t => t.symbol || t.name,
    cell: t => (
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
    ),
  },
  { k: 'price', label: 'Price', className: 'text-right', cellClass: 'font-medium', num: t => t.price, cell: t => <>${formatPriceSubscript(t.price)}</> },
  {
    // The only column that colours its own cell, by which way the token moved.
    k: 'change24h', label: '24h %', className: 'text-right', num: t => t.change24h ?? -Infinity,
    cellClass: t => (t.change24h === undefined ? undefined : t.change24h >= 0 ? 'text-success' : 'text-error'),
    cell: t => (t.change24h === undefined ? '—' : `${t.change24h >= 0 ? '+' : ''}${formatPercent(t.change24h)}`),
  },
  { k: 'volume24h', label: 'Volume 24h', className: 'text-right hidden-mobile', num: t => t.volume24h ?? 0, cell: t => formatUsd(t.volume24h) },
  { k: 'tvl', label: 'TVL', className: 'text-right hidden-mobile', num: t => t.tvl ?? 0, cell: t => formatUsd(t.tvl) },
];

export function TokensTable({ tokens, limit }: { tokens: TokenSummary[]; limit?: number }) {
  return <DataTable rows={tokens} columns={COLUMNS} defaultKey="tvl" rowKey={t => t.address} limit={limit} empty="No tokens found." />;
}
