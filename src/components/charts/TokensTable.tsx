// src/components/charts/TokensTable.tsx — The token columns of the shared DataTable

'use client';

import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { DataTable, type Column } from './DataTable';
import { EntityIcon } from './EntityIcon';
import { formatUsd, formatPercent, formatPriceSubscript } from './format';
import type { TokenSummary } from '@/lib/radix/tokens';

/** A token row, with the wiki article that names it in `assets` where there is one. */
export type TokenRow = TokenSummary & { wikiPath?: string };

const COLUMNS: Column<TokenRow>[] = [
  {
    k: 'name', label: 'Token', text: t => t.symbol || t.name,
    cell: t => (
      <div className="row">
        <Link href={`/charts/tokens/${t.address}`} className="row group min-w-0">
          <EntityIcon src={t.iconUrl} name={t.symbol || t.name} />
          <div className="stack-xs min-w-0">
            <span className="font-medium group-hover:text-accent transition-colors truncate">{t.symbol || t.name}</span>
            {t.symbol && t.name && t.symbol !== t.name && <span className="text-xs text-text-muted truncate">{t.name}</span>}
          </div>
        </Link>
        {t.wikiPath && (
          <Link href={t.wikiPath} className="table-wiki-link" title="Wiki article" aria-label={`${t.symbol || t.name} on the wiki`}>
            <BookOpen size={14} />
          </Link>
        )}
      </div>
    ),
  },
  {
    k: 'price', label: 'Price', className: 'text-right', cellClass: 'font-medium', num: t => t.price,
    // The volume column is hidden on a phone, so the price carries it on a second line there.
    cell: t => (
      <>
        ${formatPriceSubscript(t.price)}
        <div className="show-mobile text-xs text-text-muted font-normal">{formatUsd(t.volume24h)} vol.</div>
      </>
    ),
  },
  {
    // The only column that colours its own cell, by which way the token moved.
    k: 'change24h', label: '24h %', className: 'text-right', num: t => t.change24h ?? -Infinity,
    cellClass: t => (t.change24h === undefined ? undefined : t.change24h >= 0 ? 'text-success' : 'text-error'),
    cell: t => (t.change24h === undefined ? '—' : `${t.change24h >= 0 ? '+' : ''}${formatPercent(t.change24h)}`),
  },
  // OciSwap's pools only: on 13 October 2026 it counted $25 of $XRD volume where CoinGecko, across every venue, counted $18.7K.
  { k: 'volume24h', label: 'OciSwap vol. 24h', className: 'text-right hidden-mobile', num: t => t.volume24h ?? 0, cell: t => formatUsd(t.volume24h) },
];

export function TokensTable({ tokens, limit }: { tokens: TokenRow[]; limit?: number }) {
  return <DataTable rows={tokens} columns={COLUMNS} defaultKey="volume24h" rowKey={t => t.address} limit={limit} empty="OciSwap did not answer, so there are no prices to show. Try again in a minute." />;
}
