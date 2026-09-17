// src/lib/radix/gateway.ts – Shared Radix Gateway fetch helpers (raw HTTP).

import { GATEWAY_URL } from './config';

const TIMEOUT_MS = 10_000;

/** Where a read was answered from. Every state read carries one. */
export interface LedgerState {
  epoch?: number;
  state_version?: number;
  network?: string;
  proposer_round_timestamp?: string;
}

/**
 * A parsed Gateway response. The shape differs per endpoint, so the fields
 * every caller reaches for are declared and the rest stays `unknown` – callers
 * that need more pass their own page type to `paginatedGatewayFetch`.
 */
export interface GatewayPage {
  next_cursor?: string | null;
  items?: unknown[];
  ledger_state?: LedgerState;
  [key: string]: unknown;
}

/** A Gateway `metadata` object, as far as `readMetadata` reads it. */
export interface GatewayMetadata {
  items?: { key: string; value?: { typed?: { value?: unknown; values?: unknown[] } } }[];
}

/** One `/state/entity/details` item, as far as this app reads it. */
export interface GatewayEntity {
  address?: string;
  metadata?: GatewayMetadata;
  details?: { total_supply?: string;[key: string]: unknown };
  [key: string]: unknown;
}

/**
 * The Gateway declined to answer a read. Distinct from an empty answer: when mainnet
 * halted on 31 August 2026 the Gateway returned 500 `NotSyncedUpError` to every state
 * read, `paginatedGatewayFetch` returned its empty accumulator, and /charts published
 * "0 active validators securing 0 $XRD" stamped with a real epoch and state version,
 * because the stamp came from `/status/gateway-status`, which keeps answering from
 * the frozen ledger. An unavailable read must never be summable.
 */
export class GatewayUnavailableError extends Error {
  constructor(readonly path: string, readonly label: string) {
    super(`Radix Gateway did not answer ${path} (${label})`);
    this.name = 'GatewayUnavailableError';
  }
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

/**
 * Paginated POST to Radix Gateway. Accumulates results across pages.
 * Throws `GatewayUnavailableError` if any page goes unanswered, so a caller can never
 * mistake "the Gateway refused" for "the set is empty", or worse, publish the sum.
 */
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
  let pin: { at_ledger_state: { state_version: number } } | undefined;

  do {
    const data = await postGateway<TPage>(path, { ...body, ...pin, ...(cursor && { cursor }) }, label);
    if (!data) throw new GatewayUnavailableError(path, label);
    // Later pages read the ledger the first page read. Unpinned, one list can span two
    // state versions, and an entry that moves between pages is counted twice or not at all.
    const version = data.ledger_state?.state_version;
    if (!pin && version) pin = { at_ledger_state: { state_version: version } };
    items.push(...extract(data));
    cursor = nextCursor(data) ?? undefined;
  } while (cursor);

  return items;
}

/** Splits a request list to fit a Gateway cap: 20 addresses for entity details, 200 for uptime. */
export function chunks<T>(items: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));
}

/**
 * `/state/entity/details` for any number of addresses, all read at one state version so they
 * agree with the read that named them. Throws if any request goes unanswered.
 */
export async function entityDetailsAt(addresses: string[], stateVersion: number, label: string): Promise<Map<string, GatewayEntity>> {
  const pages = await Promise.all(chunks(addresses, 20).map((batch) => postGateway<{ items?: GatewayEntity[] }>(
    '/state/entity/details',
    { addresses: batch, at_ledger_state: { state_version: stateVersion } },
    label,
  )));
  if (pages.some((page) => !page)) throw new GatewayUnavailableError('/state/entity/details', label);
  return new Map(pages.flatMap((page) => page?.items ?? []).map((entity) => [String(entity.address), entity]));
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
