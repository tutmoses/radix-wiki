// src/lib/radix/gateway.ts — Shared Radix Gateway fetch helpers (raw HTTP).

import { GATEWAY_URL } from './config';

const TIMEOUT_MS = 10_000;

/**
 * A parsed Gateway response. The shape differs per endpoint, so the fields
 * every caller reaches for are declared and the rest stays `unknown` — callers
 * that need more pass their own page type to `paginatedGatewayFetch`.
 */
export interface GatewayPage {
  next_cursor?: string | null;
  items?: unknown[];
  ledger_state?: { epoch?: number; state_version?: number; network?: string };
  [key: string]: unknown;
}

/** A Gateway `metadata` object, as far as `readMetadata` reads it. */
export interface GatewayMetadata {
  items?: { key: string; value?: { typed?: { value?: unknown; values?: unknown[] } } }[];
}

/** One `/state/entity/details` item, as far as this app reads it. */
export interface GatewayEntity {
  metadata?: GatewayMetadata;
  details?: { total_supply?: string;[key: string]: unknown };
  [key: string]: unknown;
}

/** Single POST to the Radix Gateway. Returns parsed JSON, or null on failure. */
export async function postGateway<T>(
  path: string,
  body: Record<string, unknown>,
  label: string,
): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${GATEWAY_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error(`[${label}] Gateway ${res.status}: ${await res.text().catch(() => '')}`);
      return null;
    }
    return await res.json() as T;
  } catch (err) {
    console.error(`[${label}] Gateway error:`, err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Paginated POST to Radix Gateway. Accumulates results across pages. */
export async function paginatedGatewayFetch<TItem, TPage extends GatewayPage = GatewayPage>(
  path: string,
  body: Record<string, unknown>,
  extract: (data: TPage) => TItem[],
  label: string,
  // `/state/validators/list` nests its page under `validators`; every other
  // endpoint carries the cursor at the top level.
  nextCursor: (data: TPage) => string | null | undefined = (data) => data.next_cursor,
): Promise<TItem[]> {
  const items: TItem[] = [];
  let cursor: string | undefined;

  do {
    const data = await postGateway<TPage>(path, { ...body, ...(cursor && { cursor }) }, label);
    if (!data) return items;
    items.push(...extract(data));
    cursor = nextCursor(data) ?? undefined;
  } while (cursor);

  return items;
}

/** `/state/entity/details` for one address, unwrapped to its single item. */
export async function entityDetails(address: string, label: string): Promise<GatewayEntity | null> {
  const data = await postGateway<{ items?: GatewayEntity[] }>('/state/entity/details', { addresses: [address] }, label);
  return data?.items?.[0] ?? null;
}

/** A string metadata value: plain, or the first entry of a string array. */
export function readMetadata(metadata: GatewayMetadata | undefined, key: string): string | undefined {
  const typed = metadata?.items?.find(i => i.key === key)?.value?.typed;
  if (typeof typed?.value === 'string') return typed.value;
  if (Array.isArray(typed?.values) && typeof typed.values[0] === 'string') return typed.values[0];
  return undefined;
}

/** Gateway amounts arrive as decimal strings; anything unparseable reads as 0. */
export function num(value: unknown): number {
  const n = parseFloat(String(value ?? '0'));
  return isFinite(n) ? n : 0;
}
