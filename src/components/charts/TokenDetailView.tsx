// src/components/charts/TokenDetailView.tsx – /charts/tokens/<address>

import type { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ArrowLeft, Globe } from 'lucide-react';
import { getTokenDetail, getTokenHolders, type TokenDetail, type TokenHolders, type TokenRole } from '@/lib/radix/tokens';
import { getNetworkStats } from '@/lib/radix/network';
import { dashboardEntity } from '@/lib/radix/config';
import { TokenChart } from './TokenChart';
import { HoldersTable, type HolderRow } from './HoldersTable';
import { CopyAddress } from './CopyAddress';
import { formatUsd, formatPercent, formatAmount, formatPriceSubscript } from './format';
import { cn, pagePath, shortenAddress, slugify } from '@/lib/utils';

interface WikiPageRef {
  tagPath: string;
  slug: string;
  title: string;
}

type Row = [label: string, value: ReactNode];

/**
 * Holders as the table shows them. A validator holds the $XRD staked with it, and 59 of the
 * 100 largest $XRD holders were validators in September 2026, so a validator gets the name
 * the validator table shows. Accounts and components name themselves and stay addresses.
 */
async function holderRows(holders: TokenHolders, supply: number | undefined): Promise<HolderRow[]> {
  const stats = holders.top.some((h) => h.address.startsWith('validator_')) ? await getNetworkStats().catch(() => null) : null;
  const names = new Map(stats?.validators.map((v) => [v.address, v.name]));
  return holders.top.map((h) => ({
    ...h,
    ...dashboardEntity(h.address),
    name: names.get(h.address),
    share: supply ? h.amount / supply : undefined,
  }));
}

function external(href: string, label: ReactNode) {
  return <a href={href} target="_blank" rel="noopener">{label}</a>;
}

const ADDRESS = /^([a-z]+)_(rdx|tdx)/;

/** A metadata value: a resource opens its token page, another address its Dashboard page, a URL itself. */
function metadataValue(value: string) {
  const prefix = ADDRESS.exec(value)?.[1];
  if (prefix === 'resource') return <Link href={`/charts/tokens/${value}`}>{shortenAddress(value)}</Link>;
  if (prefix) return external(dashboardEntity(value).href, shortenAddress(value));
  if (/^https?:\/\//.test(value)) return external(value, value.replace(/^https?:\/\//, ''));
  return value;
}

function roleValue({ rule, badge, locked }: TokenRole) {
  return (
    <>
      {rule}
      {locked && <span className="text-text-muted"> · locked</span>}
      {badge && <div className="text-small">Badge <Link href={`/charts/tokens/${badge}`}>{shortenAddress(badge)}</Link></div>}
    </>
  );
}

/** Rows whose value was read. An unread figure is left out, not shown as a dash. */
const known = (...rows: Row[]): Row[] => rows.filter(([, value]) => value != null && value !== '');
const amount = (n: number | undefined) => n === undefined ? undefined : formatAmount(n);
const usd = (n: number | undefined) => n === undefined ? undefined : formatUsd(n);

function InfoTable({ title, rows }: { title: string; rows: Row[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="stack-xs">
      <h2 id={slugify(title)} className="infobox-heading">{title}</h2>
      <table>
        <tbody>
          {rows.map(([label, value]) => <tr key={label}><th>{label}</th><td>{value}</td></tr>)}
        </tbody>
      </table>
    </section>
  );
}

/** The ledger's account of the resource, in the wiki's article infobox. */
function TokenInfobox({ token, wikiPage }: { token: TokenDetail; wikiPage?: WikiPageRef | null }) {
  return (
    <aside className="infobox stack">
      <InfoTable title="Resource" rows={known(
        ['Type', <span className="badge badge-accent">{token.kind}</span>],
        ['Name', token.name],
        ['Symbol', token.symbol],
        ['Divisibility', token.divisibility?.toString()],
      )} />
      <InfoTable title="Supply" rows={known(
        ['Total supply', amount(token.totalSupply)],
        ['Minted', amount(token.totalMinted)],
        ['Burned', amount(token.totalBurned)],
      )} />
      <InfoTable title="Market" rows={known(
        ['Market cap', usd(token.marketCap)],
        ['24h volume', usd(token.volume24h)],
      )} />
      <InfoTable title="Metadata" rows={token.metadata.map(({ key, values }) => [
        key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()).replace(/^Dapp/, 'dApp'),
        values.map((v, i) => <div key={i}>{metadataValue(v)}</div>),
      ])} />
      <InfoTable title="Permissions" rows={token.roles.map((role) => [role.label, roleValue(role)])} />
      <InfoTable title="Links" rows={known(
        ['Wiki', wikiPage && <Link href={pagePath(wikiPage.tagPath, wikiPage.slug)}>{wikiPage.title}</Link>],
        ['Trade', external(token.ociswapUrl, 'OciSwap')],
        ['Explorer', external(token.dashboardUrl, 'Radix Dashboard')],
      )} />
    </aside>
  );
}

export default async function TokenDetailView({ address, wikiPage }: { address: string; wikiPage?: WikiPageRef | null }) {
  const [token, holders] = await Promise.all([getTokenDetail(address), getTokenHolders(address).catch(() => null)]);
  if (!token) notFound();
  const rows = holders ? await holderRows(holders, token.totalSupply) : null;
  const top10 = holders && token.totalSupply ? holders.top.slice(0, 10).reduce((sum, h) => sum + h.amount, 0) / token.totalSupply : undefined;

  const change = token.change24h;
  const positive = (change ?? 0) >= 0;

  return (
    <div className="stack">
      <Link href="/charts/tokens" className="charts-section-link"><ArrowLeft size={14} /> Tokens</Link>

      <div className="token-page">
        <div className="token-summary">
          <div className="token-card token-identity">
            <div className="row">
              {token.iconUrl ? (
                <Image src={token.iconUrl} alt={token.symbol || token.name} width={48} height={48} className="rounded-full shrink-0" unoptimized />
              ) : (
                <div className="w-12 h-12 rounded-full bg-surface-2 shrink-0" />
              )}
              <div className="stack-xs min-w-0">
                <h1 id={slugify(token.name || token.symbol) || 'token'} className="token-name">
                  {token.name || token.symbol}
                  {token.symbol && token.symbol !== token.name && <span className="text-text-muted"> ({token.symbol})</span>}
                </h1>
                <CopyAddress address={token.address} />
              </div>
            </div>
            {token.description && <p className="text-small mb-0">{token.description}</p>}
            {token.infoUrl && (
              <a href={token.infoUrl} target="_blank" rel="noopener" className="charts-section-link">
                <Globe size={14} /> {token.infoUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              </a>
            )}
          </div>

          <div className="token-card">
            <span className="text-small text-text-muted">Price</span>
            {token.price > 0 ? (
              <>
                <span className="stat-value">${formatPriceSubscript(token.price)}</span>
                {change !== undefined && (
                  <span className={cn('text-small font-medium', positive ? 'text-success' : 'text-error')}>
                    {positive ? '↑' : '↓'} {formatPercent(Math.abs(change))} in 24h
                  </span>
                )}
              </>
            ) : (
              <span className="text-small text-text-muted">Not traded on OciSwap</span>
            )}
          </div>

          <div className="token-card">
            <span className="text-small text-text-muted">Holders</span>
            <span className="stat-value">{holders ? holders.total.toLocaleString('en-US') : '—'}</span>
            {top10 !== undefined && (
              <span className="text-small text-text-muted">Largest 10 hold {formatPercent(top10 * 100, 1)}</span>
            )}
          </div>
        </div>

        <TokenInfobox token={token} wikiPage={wikiPage} />

        <div className="token-body stack">
          {token.price > 0 && <TokenChart resourceAddress={token.address} defaultTimeframe="30d" height={320} />}
          {rows && rows.length > 0 && (
            <section className="stack-sm">
              <h2 id="largest-holders" className="charts-section-title">Largest holders</h2>
              <HoldersTable holders={rows} />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
