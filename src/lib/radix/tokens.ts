// src/lib/radix/tokens.ts – Token data via OciSwap + Gateway

import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { GatewayUnavailableError, num, postGateway, readMetadata, type GatewayEntity } from './gateway';
import { DASHBOARD_URL, OCISWAP_API } from './config';

export interface TokenSummary {
  address: string;
  symbol: string;
  name: string;
  iconUrl?: string;
  price: number;
  change24h?: number;
  volume24h?: number;
  marketCap?: number;
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
    const res = await fetch(`${OCISWAP_API}${path}`, { cache: 'no-store', signal: controller.signal });
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

// OciSwap's token objects carry no TVL. /charts sorted its token table by a `tvl` field
// that was empty on every row until September 2026.
function parseOciToken(t: any): TokenSummary | null {
  const address = t?.address ?? t?.resource_address;
  if (!address || typeof address !== 'string') return null;
  const price = num(t?.price?.usd?.now);
  const price24h = num(t?.price?.usd?.['24h']);
  const volume = num(t?.volume?.usd?.['24h']);
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
  };
}

/** OciSwap has shipped the token list under three different keys; accept all. */
type OciTokenList = { data?: unknown[]; tokens?: unknown[] } & unknown[];

/**
 * OciSwap's 100 highest-ranked tokens, less the ones nobody traded. Its API ignores sort
 * parameters, so this is one list for every page: /charts fetched 50 and /charts/tokens 100,
 * and their top tens differed.
 */
export const TOP_TOKENS_LIMIT = 100;

async function _fetchTopTokens(): Promise<TokenSummary[]> {
  const data = await ociswap<OciTokenList>(`/tokens?limit=${TOP_TOKENS_LIMIT}`, 'top-tokens');
  const items: unknown[] = Array.isArray(data?.data) ? data.data : Array.isArray(data?.tokens) ? data.tokens : Array.isArray(data) ? data : [];
  return items
    .map(parseOciToken)
    // A quoted price with no trading behind it is a stale artifact, not a price. This
    // is what put xLINK at $670bn (and a $6.5tn market cap) atop the table on zero volume.
    .filter((t): t is TokenSummary => t !== null && t.price > 0 && (t.volume24h ?? 0) > 0);
}

// Cache successful results only: don't poison the cache with [] on transient failures.
const _getTopTokensCached = unstable_cache(_fetchTopTokens, ['radix-top-tokens-v5'], { revalidate: 60, tags: ['charts'] });

export const getTopTokens = cache(async (): Promise<TokenSummary[]> => {
  const cached = await _getTopTokensCached();
  if (cached.length > 0) return cached;
  // Cache returned empty (likely a previous failure): retry once outside the cache.
  return _fetchTopTokens();
});

async function _getTokenDetailRaw(address: string): Promise<TokenDetail | null> {
  if (!address.startsWith('resource_')) return null;
  const [oci, ledger] = await Promise.all([
    ociswap<Record<string, unknown>>(`/tokens/${address}`, 'token-detail'),
    postGateway<{ items?: GatewayEntity[] }>('/state/entity/details', { addresses: [address] }, 'token-entity'),
  ]);

  const summary = oci ? parseOciToken(oci) : null;
  const entity = ledger?.items?.[0];
  if (!summary && !entity) {
    // Only the ledger can say a resource does not exist: OciSwap answers 500 for an address
    // it has never seen. When neither source answered, a returned null was cached and served
    // ASTRL's page as a 404 on 17 September 2026. Thrown, so the cache keeps no failure.
    if (!ledger) throw new GatewayUnavailableError('/state/entity/details', 'token-detail');
    return null;
  }

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
    totalSupply: totalSupply > 0 ? totalSupply : undefined,
    divisibility: typeof divisibility === 'number' ? divisibility : undefined,
    description: readMetadata(entity?.metadata, 'description'),
    infoUrl: readMetadata(entity?.metadata, 'info_url'),
    ociswapUrl: `https://ociswap.com/tokens/${address}`,
    dashboardUrl: `${DASHBOARD_URL}/resource/${address}`,
  };
}

export const getTokenDetail = cache(
  unstable_cache(_getTokenDetailRaw, ['radix-token-detail-v2'], { revalidate: 60, tags: ['charts'] }),
);

export interface TokenHolder {
  address: string;
  /** Tokens held, or for a non-fungible resource, the number of NFTs. */
  amount: number;
}

export interface TokenHolders {
  total: number;
  top: TokenHolder[];
}

type HoldersPage = {
  total_count?: number;
  items?: { holder_address: string; amount?: string; non_fungible_ids_count?: number }[];
};

/** How many accounts and components hold a resource, and the 25 largest, from the Gateway's holder index. */
async function _fetchTokenHolders(address: string): Promise<TokenHolders> {
  const page = await postGateway<HoldersPage>(
    '/extensions/resource-holders/page',
    { resource_address: address, limit_per_page: 25 },
    'token-holders',
  );
  // Thrown rather than returned, so the cache keeps no failure and no holder count of 0.
  if (typeof page?.total_count !== 'number') throw new GatewayUnavailableError('/extensions/resource-holders/page', 'token-holders');
  return {
    total: page.total_count,
    top: (page.items ?? []).map((h) => ({ address: h.holder_address, amount: num(h.amount ?? h.non_fungible_ids_count) })),
  };
}

export const getTokenHolders = cache(
  unstable_cache(_fetchTokenHolders, ['radix-token-holders-v1'], { revalidate: 300, tags: ['charts'] }),
);

export interface DexStats {
  /** Ociswap only: CaviarNine, DefiPlaza, Surge and Astrolescent are not in these figures. */
  volume7dXrd: number;
  swaps7d: number;
  tvlXrd: number;
  newPools7d: number;
}

const XRD_MAX_SUPPLY = 24e9;

/** Only the four figures the dashboard reads; OciSwap sends far more. */
type XrdSeries = Record<string, unknown>;
type OciStatistics = {
  volume?: { xrd?: XrdSeries };
  total_value_locked?: { xrd?: XrdSeries };
  event_counts?: { swap?: XrdSeries; instantiate_pool?: XrdSeries };
};

async function _fetchDexStats(): Promise<DexStats> {
  const d = await ociswap<OciStatistics>('/statistics', 'dex-stats');
  // Thrown rather than returned, so the cache keeps no failure for its five minutes.
  if (!d) throw new Error('OciSwap did not answer /statistics');
  // $XRD-denominated throughout: the native unit needs no price oracle to be true later.
  // A week's volume above the 24B maximum supply is Ociswap mispricing a pool, not trade:
  // on 13 September 2026 it reported 11 quadrillion XRD on 1,296 swaps. NaN serialises as null.
  const volume = num(d?.volume?.xrd?.['7d']);
  return {
    volume7dXrd: volume > XRD_MAX_SUPPLY ? NaN : volume,
    swaps7d: num(d?.event_counts?.swap?.['7d']),
    tvlXrd: num(d?.total_value_locked?.xrd?.now),
    newPools7d: num(d?.event_counts?.instantiate_pool?.['7d']),
  };
}

const _getDexStatsCached = unstable_cache(_fetchDexStats, ['radix-dex-stats-v2'], { revalidate: 300, tags: ['charts'] });

/** Ociswap's week, or null when it did not answer: the weekly snapshot records that week without it. */
export const getDexStats = cache((): Promise<DexStats | null> => _getDexStatsCached().catch(() => null));
