// src/lib/radix/tokens.ts — Token data via OciSwap + Gateway

import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { entityDetails, num, readMetadata } from './gateway';

export interface TokenSummary {
  address: string;
  symbol: string;
  name: string;
  iconUrl?: string;
  price: number;
  change24h?: number;
  volume24h?: number;
  marketCap?: number;
  tvl?: number;
}

export interface TokenDetail extends TokenSummary {
  totalSupply?: number;
  divisibility?: number;
  description?: string;
  infoUrl?: string;
  ociswapUrl: string;
  dashboardUrl: string;
}

/** Single GET against the OciSwap public API. Returns parsed JSON, or null. */
async function ociswap<T>(path: string, label: string): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`https://api.ociswap.com${path}`, { cache: 'no-store', signal: controller.signal });
    if (!res.ok) {
      console.error(`[${label}] OciSwap ${res.status}`);
      return null;
    }
    return await res.json() as T;
  } catch (err) {
    console.error(`[${label}] error`, err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function parseOciToken(t: any): TokenSummary | null {
  const address = t?.address ?? t?.resource_address;
  if (!address || typeof address !== 'string') return null;
  const price = num(t?.price?.usd?.now);
  const price24h = num(t?.price?.usd?.['24h']);
  const volume = num(t?.volume?.usd?.['24h']);
  const tvl = num(t?.tvl?.usd?.now);
  const marketCap = num(t?.market_cap?.circulating?.usd?.now ?? t?.market_cap?.usd?.now);

  return {
    address,
    symbol: t?.symbol ?? '',
    name: t?.name ?? '',
    iconUrl: t?.icon_url ?? undefined,
    price,
    change24h: price24h > 0 && price > 0 ? ((price - price24h) / price24h) * 100 : undefined,
    volume24h: volume > 0 ? volume : undefined,
    marketCap: marketCap > 0 ? marketCap : undefined,
    tvl: tvl > 0 ? tvl : undefined,
  };
}

/** OciSwap has shipped the token list under three different keys; accept all. */
type OciTokenList = { data?: unknown[]; tokens?: unknown[] } & unknown[];

async function _fetchTopTokens(limit: number): Promise<TokenSummary[]> {
  const data = await ociswap<OciTokenList>(`/tokens?limit=${limit}`, 'top-tokens');
  const items: unknown[] = Array.isArray(data?.data) ? data.data : Array.isArray(data?.tokens) ? data.tokens : Array.isArray(data) ? data : [];
  return items
    .map(parseOciToken)
    // A quoted price with no trading behind it is a stale artifact, not a price. This
    // is what put xLINK at $670bn (and a $6.5tn market cap) atop the table on zero volume.
    .filter((t): t is TokenSummary => t !== null && t.price > 0 && (t.volume24h ?? 0) > 0);
}

// Cache successful results only — don't poison the cache with [] on transient failures.
const _getTopTokensCached = unstable_cache(
  async (limit: number) => _fetchTopTokens(limit),
  ['radix-top-tokens-v4'],
  { revalidate: 60, tags: ['charts'] },
);

const _getTopTokens = async (limit = 100): Promise<TokenSummary[]> => {
  const cached = await _getTopTokensCached(limit);
  if (cached.length > 0) return cached;
  // Cache returned empty (likely a previous failure): retry once outside the cache.
  return _fetchTopTokens(limit);
};

export const getTopTokens = cache(_getTopTokens);

async function _getTokenDetailRaw(address: string): Promise<TokenDetail | null> {
  if (!address.startsWith('resource_')) return null;
  const [oci, entity] = await Promise.all([
    ociswap<Record<string, unknown>>(`/tokens/${address}`, 'token-detail'),
    entityDetails(address, 'token-entity'),
  ]);

  const summary = oci ? parseOciToken(oci) : null;
  if (!summary && !entity) return null;

  const symbol = summary?.symbol || readMetadata(entity?.metadata, 'symbol') || '';
  const totalSupply = num(entity?.details?.total_supply);
  const divisibility = entity?.details?.divisibility;

  return {
    address,
    symbol,
    name: summary?.name || readMetadata(entity?.metadata, 'name') || symbol || address.slice(0, 24),
    iconUrl: summary?.iconUrl || readMetadata(entity?.metadata, 'icon_url'),
    price: summary?.price ?? 0,
    change24h: summary?.change24h,
    volume24h: summary?.volume24h,
    marketCap: summary?.marketCap,
    tvl: summary?.tvl,
    totalSupply: totalSupply > 0 ? totalSupply : undefined,
    divisibility: typeof divisibility === 'number' ? divisibility : undefined,
    description: readMetadata(entity?.metadata, 'description'),
    infoUrl: readMetadata(entity?.metadata, 'info_url'),
    ociswapUrl: `https://ociswap.com/tokens/${address}`,
    dashboardUrl: `https://dashboard.radixdlt.com/resource/${address}`,
  };
}

export const getTokenDetail = cache(
  unstable_cache(_getTokenDetailRaw, ['radix-token-detail'], { revalidate: 60, tags: ['charts'] }),
);

export interface DexStats {
  /** Ociswap only — CaviarNine, DefiPlaza, Surge and Astrolescent are not in these figures. */
  volume7dXrd: number;
  swaps7d: number;
  tvlXrd: number;
  newPools7d: number;
}

/** Only the four figures the dashboard reads; OciSwap sends far more. */
type XrdSeries = Record<string, unknown>;
type OciStatistics = {
  volume?: { xrd?: XrdSeries };
  total_value_locked?: { xrd?: XrdSeries };
  event_counts?: { swap?: XrdSeries; instantiate_pool?: XrdSeries };
};

async function _fetchDexStats(): Promise<DexStats | null> {
  const d = await ociswap<OciStatistics>('/statistics', 'dex-stats');
  if (!d) return null;
  // XRD-denominated throughout: the native unit needs no price oracle to be true later.
  return {
    volume7dXrd: num(d?.volume?.xrd?.['7d']),
    swaps7d: num(d?.event_counts?.swap?.['7d']),
    tvlXrd: num(d?.total_value_locked?.xrd?.now),
    newPools7d: num(d?.event_counts?.instantiate_pool?.['7d']),
  };
}

export const getDexStats = cache(
  unstable_cache(_fetchDexStats, ['radix-dex-stats-v1'], { revalidate: 300, tags: ['charts'] }),
);
