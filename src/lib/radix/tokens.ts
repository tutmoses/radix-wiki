// src/lib/radix/tokens.ts — Token data via OciSwap + Gateway

import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { getGatewayUrl, RADIX_CONFIG } from './config';

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

function readMetadata(metadata: any, key: string): string | undefined {
  if (!metadata?.items) return undefined;
  const item = metadata.items.find((i: any) => i.key === key);
  const typed = item?.value?.typed;
  if (!typed) return undefined;
  if (typeof typed.value === 'string') return typed.value;
  if (Array.isArray(typed.values) && typeof typed.values[0] === 'string') return typed.values[0];
  return undefined;
}

function parseOciToken(t: any): TokenSummary | null {
  const address = t?.address ?? t?.resource_address;
  if (!address || typeof address !== 'string') return null;
  const priceNow = parseFloat(t?.price?.usd?.now ?? '0');
  const price24h = parseFloat(t?.price?.usd?.['24h'] ?? '0');
  const change = price24h > 0 && priceNow > 0 ? ((priceNow - price24h) / price24h) * 100 : undefined;
  const volume = parseFloat(t?.volume?.usd?.['24h'] ?? '0');
  const tvl = parseFloat(t?.tvl?.usd?.now ?? '0');
  const marketCap = parseFloat(t?.market_cap?.circulating?.usd?.now ?? t?.market_cap?.usd?.now ?? '0');

  return {
    address,
    symbol: t?.symbol ?? '',
    name: t?.name ?? '',
    iconUrl: t?.icon_url ?? undefined,
    price: isFinite(priceNow) ? priceNow : 0,
    change24h: change !== undefined && isFinite(change) ? change : undefined,
    volume24h: isFinite(volume) && volume > 0 ? volume : undefined,
    marketCap: isFinite(marketCap) && marketCap > 0 ? marketCap : undefined,
    tvl: isFinite(tvl) && tvl > 0 ? tvl : undefined,
  };
}

async function _fetchTopTokens(limit: number): Promise<TokenSummary[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`https://api.ociswap.com/tokens?limit=${limit}`, {
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error(`[top-tokens] OciSwap ${res.status}`);
      return [];
    }
    const data = await res.json();
    const items: any[] = Array.isArray(data?.data) ? data.data : Array.isArray(data?.tokens) ? data.tokens : Array.isArray(data) ? data : [];
    return items
      .map(parseOciToken)
      .filter((t): t is TokenSummary => t !== null && t.price > 0);
  } catch (err) {
    console.error('[top-tokens] error', err);
    return [];
  } finally {
    clearTimeout(timer);
  }
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

async function gatewayEntity(address: string): Promise<any | null> {
  try {
    const res = await fetch(`${getGatewayUrl(RADIX_CONFIG.networkId)}/state/entity/details`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addresses: [address] }),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.items?.[0] ?? null;
  } catch {
    return null;
  }
}

async function ociSwapToken(address: string): Promise<any | null> {
  try {
    const res = await fetch(`https://api.ociswap.com/tokens/${address}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function _getTokenDetailRaw(address: string): Promise<TokenDetail | null> {
  return (async () => {
    if (!address.startsWith('resource_')) return null;
    const [oci, entity] = await Promise.all([ociSwapToken(address), gatewayEntity(address)]);

    const summary = oci ? parseOciToken(oci) : null;
    const symbol = summary?.symbol || readMetadata(entity?.metadata, 'symbol') || '';
    const name = summary?.name || readMetadata(entity?.metadata, 'name') || symbol || address.slice(0, 24);
    const iconUrl = summary?.iconUrl || readMetadata(entity?.metadata, 'icon_url');
    const description = readMetadata(entity?.metadata, 'description');
    const infoUrl = readMetadata(entity?.metadata, 'info_url');
    const totalSupply = parseFloat(entity?.details?.total_supply ?? '0');
    const divisibility = entity?.details?.divisibility;

    if (!summary && !entity) return null;

    return {
      address,
      symbol,
      name,
      iconUrl,
      price: summary?.price ?? 0,
      change24h: summary?.change24h,
      volume24h: summary?.volume24h,
      marketCap: summary?.marketCap,
      tvl: summary?.tvl,
      totalSupply: isFinite(totalSupply) && totalSupply > 0 ? totalSupply : undefined,
      divisibility: typeof divisibility === 'number' ? divisibility : undefined,
      description,
      infoUrl,
      ociswapUrl: `https://ociswap.com/tokens/${address}`,
      dashboardUrl: `https://dashboard.radixdlt.com/resource/${address}`,
    };
  })();
}

export const getTokenDetail = cache(
  unstable_cache(_getTokenDetailRaw, ['radix-token-detail'], { revalidate: 60, tags: ['charts'] }),
);
