// src/lib/radix/gateway.ts — Shared paginated Gateway API helper

import { getGatewayUrl, RADIX_CONFIG } from './config';

interface PaginatedResponse {
  next_cursor?: string | null;
}

/** Generic paginated POST to Radix Gateway. Accumulates results across pages. */
export async function paginatedGatewayFetch<TItem>(
  path: string,
  body: Record<string, unknown>,
  extract: (data: unknown) => TItem[],
  label: string,
): Promise<TItem[]> {
  const url = `${getGatewayUrl(RADIX_CONFIG.networkId)}${path}`;
  const items: TItem[] = [];
  let cursor: string | undefined;

  try {
    do {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, ...(cursor && { cursor }) }),
        cache: 'no-store',
      });

      if (!response.ok) {
        console.error(`[${label}] Gateway ${response.status}: ${await response.text().catch(() => '')}`);
        return items;
      }

      const data = await response.json() as PaginatedResponse;
      items.push(...extract(data));
      cursor = data.next_cursor ?? undefined;
    } while (cursor);
  } catch (err) {
    console.error(`[${label}] Gateway error:`, err);
  }

  return items;
}
