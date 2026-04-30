// src/components/charts/TokenDetailView.tsx — /charts/tokens/<address>

import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { getTokenDetail } from '@/lib/radix/tokens';
import { TokenChart } from './TokenChart';
import { formatUsd, formatPercent, formatCompact, formatPriceSubscript } from './format';
import { cn, shortenAddress } from '@/lib/utils';

export default async function TokenDetailView({ address }: { address: string }) {
  const token = await getTokenDetail(address);
  if (!token) notFound();

  const change = token.change24h;
  const positive = (change ?? 0) >= 0;

  return (
    <div className="stack">
      <Link href="/charts/tokens" className="charts-section-link"><ArrowLeft size={14} /> Tokens</Link>

      <div className="token-detail-header">
        <div className="row">
          {token.iconUrl ? (
            <Image src={token.iconUrl} alt={token.symbol || token.name} width={48} height={48} className="rounded-full shrink-0" unoptimized />
          ) : (
            <div className="w-12 h-12 rounded-full bg-surface-2 shrink-0" />
          )}
          <div className="stack-xs min-w-0">
            <h1 className="truncate">{token.name || token.symbol}</h1>
            {token.symbol && <span className="text-text-muted">{token.symbol}</span>}
          </div>
        </div>
        <div className="token-detail-price">
          {token.price > 0 ? (
            <>
              <span className="text-h2 font-semibold">${formatPriceSubscript(token.price)}</span>
              {change !== undefined && (
                <span className={cn('font-medium', positive ? 'text-success' : 'text-error')}>
                  {positive ? '↑' : '↓'} {formatPercent(Math.abs(change))}
                </span>
              )}
            </>
          ) : (
            <span className="text-text-muted">No price data</span>
          )}
        </div>
      </div>

      {token.price > 0 && <TokenChart resourceAddress={token.address} defaultTimeframe="30d" height={320} />}

      {token.description && (
        <div className="surface p-4">
          <p className="text-small">{token.description}</p>
        </div>
      )}

      <div className="token-detail-meta">
        <div className="surface p-3 stack-xs">
          <span className="text-small text-text-muted">Market Cap</span>
          <span className="font-medium">{formatUsd(token.marketCap)}</span>
        </div>
        <div className="surface p-3 stack-xs">
          <span className="text-small text-text-muted">24h Volume</span>
          <span className="font-medium">{formatUsd(token.volume24h)}</span>
        </div>
        <div className="surface p-3 stack-xs">
          <span className="text-small text-text-muted">TVL</span>
          <span className="font-medium">{formatUsd(token.tvl)}</span>
        </div>
        <div className="surface p-3 stack-xs">
          <span className="text-small text-text-muted">Total Supply</span>
          <span className="font-medium">{token.totalSupply ? formatCompact(token.totalSupply) : '—'}</span>
        </div>
      </div>

      <div className="surface p-4 stack-sm">
        <span className="text-small text-text-muted">Resource address</span>
        <code className="text-small break-all">{token.address}</code>
        <span className="text-small text-text-muted">{shortenAddress(token.address)}</span>
      </div>

      <div className="row-md wrap">
        <a href={token.ociswapUrl} target="_blank" rel="noopener" className="charts-section-link">
          OciSwap <ExternalLink size={14} />
        </a>
        <a href={token.dashboardUrl} target="_blank" rel="noopener" className="charts-section-link">
          Radix Dashboard <ExternalLink size={14} />
        </a>
        {token.infoUrl && (
          <a href={token.infoUrl} target="_blank" rel="noopener" className="charts-section-link">
            Project site <ExternalLink size={14} />
          </a>
        )}
      </div>
    </div>
  );
}
