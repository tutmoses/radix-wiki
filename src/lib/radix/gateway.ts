// src/lib/radix/gateway.ts — Shared Radix Gateway fetch helpers (raw HTTP).

import { getGatewayUrl, RADIX_CONFIG } from './config';

const DEFAULT_TIMEOUT_MS = 10_000;

interface PaginatedResponse {
  next_cursor?: string | null;
}

/** Single POST to the Radix Gateway. Returns parsed JSON, or null on failure. */
export async function postGateway<T>(
  path: string,
  body: Record<string, unknown>,
  label: string,
  { timeoutMs = DEFAULT_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${getGatewayUrl(RADIX_CONFIG.networkId)}${path}`, {
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
export async function paginatedGatewayFetch<TItem>(
  path: string,
  body: Record<string, unknown>,
  extract: (data: unknown) => TItem[],
  label: string,
): Promise<TItem[]> {
  const items: TItem[] = [];
  let cursor: string | undefined;

  do {
    const data = await postGateway<PaginatedResponse>(
      path,
      { ...body, ...(cursor && { cursor }) },
      label,
    );
    if (!data) return items;
    items.push(...extract(data));
    cursor = data.next_cursor ?? undefined;
  } while (cursor);

  return items;
}
