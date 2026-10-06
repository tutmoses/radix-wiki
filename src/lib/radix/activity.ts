// src/lib/radix/activity.ts – Daily ledger activity, summed from the Gateway's transaction stream.
//
// Pinned state reads answer "what was true at time T". They cannot say how many accounts
// moved funds on a day or how much $XRD a day's fees burned: those are sums over
// transactions. So the stream is read once, a UTC day at a time, and each day is kept as
// one `ledger_days` row. Raw transactions are never stored.
//
// The daily cron (/api/cron/ledger-days) and the backfill (scripts/ledger-days.ts) both
// call `syncLedgerDays`, so there is one parser.

import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma/client';
import { GATEWAY_URL, XRD_ADDRESS } from './config';
import { GatewayUnavailableError, num, postGateway, type GatewayPage } from './gateway';

/** The day of the first user transaction on Babylon (state version 670). */
const GENESIS_DAY = new Date('2023-09-28T00:00:00Z');
const DAY_MS = 86_400_000;

// Fee summary for fees and royalties, state changes for the entities a transaction
// created, balance changes for the accounts it touched, the $XRD it burned and the NFTs
// it minted. Events would add ~0.8 MB a page and nothing the three do not already give.
const OPT_INS = { receipt_fee_summary: true, receipt_state_changes: true, balance_changes: true };

type FungibleChange = { entity_address: string; resource_address: string; balance_change: string };

interface StreamTx {
  transaction_status: string;
  state_version: number;
  confirmed_at?: string;
  fee_paid?: string;
  receipt?: {
    fee_summary?: { xrd_total_royalty_cost?: string };
    state_updates?: { new_global_entities?: { entity_address: string }[] };
  };
  balance_changes?: {
    fungible_fee_balance_changes?: FungibleChange[];
    fungible_balance_changes?: FungibleChange[];
    non_fungible_balance_changes?: { entity_address: string; resource_address: string; added: string[]; removed: string[] }[];
  };
}

interface StreamPage { items?: StreamTx[]; next_cursor?: string | null }

export interface DayTotals {
  transactions: number;
  activeAccounts: number;
  newAccounts: number;
  newComponents: number;
  newResources: number;
  nftsMinted: number;
  feesXrd: number;
  burnedXrd: number;
  royaltiesXrd: number;
  stateVersion: number | null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One stream page. The public Gateway answers a fast reader with 429 after ~170 pages, so
 * a rate limit or a passing 5xx is waited out. Returns null once the deadline has passed
 * or a wait would pass it; throws when the Gateway refuses outright or keeps refusing.
 */
async function streamPage(body: Record<string, unknown>, deadline: number): Promise<StreamPage | null> {
  for (let attempt = 0; ; attempt++) {
    if (Date.now() > deadline) return null;
    const res = await fetch(`${GATEWAY_URL}/stream/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(60_000),
    }).catch(() => null);
    if (res?.ok) return await res.json() as StreamPage;
    const transient = !res || res.status === 429 || res.status >= 500;
    if (!transient || attempt >= 9) throw new GatewayUnavailableError('/stream/transactions', `ledger-days ${res?.status ?? 'no response'}`);
    const wait = Math.min(60_000, 2_000 * 2 ** attempt);
    if (Date.now() + wait > deadline) return null;
    await sleep(wait);
  }
}

/** Every user transaction committed in [start, start + 1 day), summed. Null if the deadline came first. */
async function readDay(start: Date, deadline: number): Promise<DayTotals | null> {
  const end = new Date(start.getTime() + DAY_MS);
  const accounts = new Set<string>();
  const totals: DayTotals = {
    transactions: 0, activeAccounts: 0, newAccounts: 0, newComponents: 0, newResources: 0,
    nftsMinted: 0, feesXrd: 0, burnedXrd: 0, royaltiesXrd: 0, stateVersion: null,
  };
  const body: Record<string, unknown> = {
    kind_filter: 'User',
    order: 'Asc',
    limit_per_page: 100,
    from_ledger_state: { timestamp: start.toISOString() },
    at_ledger_state: { timestamp: end.toISOString() },
    opt_ins: OPT_INS,
  };

  do {
    const page = await streamPage(body, deadline);
    if (!page) return null;
    for (const tx of page.items ?? []) {
      // The timestamp lower bound resolves to the last state version at or before
      // midnight, which belongs to the day before.
      const at = Date.parse(tx.confirmed_at ?? '');
      if (!(at >= start.getTime() && at < end.getTime())) continue;

      totals.transactions++;
      totals.stateVersion = tx.state_version;
      totals.feesXrd += num(tx.fee_paid);
      totals.royaltiesXrd += num(tx.receipt?.fee_summary?.xrd_total_royalty_cost);

      for (const { entity_address } of tx.receipt?.state_updates?.new_global_entities ?? []) {
        if (entity_address.startsWith('account_')) totals.newAccounts++;
        else if (entity_address.startsWith('component_')) totals.newComponents++;
        else if (entity_address.startsWith('resource_')) totals.newResources++;
      }

      // A user transaction cannot mint $XRD, so whatever $XRD leaves every vault without
      // arriving in another was burned: half of each network fee, plus any explicit burn.
      const bc = tx.balance_changes;
      for (const c of [...bc?.fungible_fee_balance_changes ?? [], ...bc?.fungible_balance_changes ?? []]) {
        if (c.entity_address.startsWith('account_')) accounts.add(c.entity_address);
        if (c.resource_address === XRD_ADDRESS) totals.burnedXrd -= num(c.balance_change);
      }

      // Likewise an NFT added to a vault without leaving another was minted. A mint and a
      // burn of the same resource in one transaction net out, which undercounts by the burn.
      const netNfts = new Map<string, number>();
      for (const c of bc?.non_fungible_balance_changes ?? []) {
        if (c.entity_address.startsWith('account_')) accounts.add(c.entity_address);
        netNfts.set(c.resource_address, (netNfts.get(c.resource_address) ?? 0) + c.added.length - c.removed.length);
      }
      for (const n of netNfts.values()) totals.nftsMinted += Math.max(0, n);
    }
    body.cursor = page.next_cursor ?? undefined;
  } while (body.cursor);

  totals.activeAccounts = accounts.size;
  return totals;
}

/**
 * Reads every whole day after the last stored one, oldest first, until the deadline.
 * A day counts as whole only once the ledger has a round after it, so neither a lagging
 * Gateway nor a halted network can store an unfinished day as a quiet one. Returns the
 * number of days written.
 */
export async function syncLedgerDays(deadline = Infinity, log: (line: string) => void = () => {}): Promise<number> {
  const tip = (await postGateway<GatewayPage>('/status/gateway-status', {}, 'ledger-days'))?.ledger_state?.proposer_round_timestamp;
  if (!tip) throw new GatewayUnavailableError('/status/gateway-status', 'ledger-days');
  const tipMs = Date.parse(tip);

  const last = await prisma.ledgerDay.findFirst({ orderBy: { day: 'desc' }, select: { day: true } });
  let day = last ? new Date(last.day.getTime() + DAY_MS) : GENESIS_DAY;
  let written = 0;

  while (day.getTime() + DAY_MS <= tipMs && Date.now() < deadline) {
    const totals = await readDay(day, deadline);
    if (!totals) break;
    await prisma.ledgerDay.upsert({ where: { day }, create: { day, ...totals }, update: totals });
    log(`${day.toISOString().slice(0, 10)}  ${totals.transactions} transactions, ${totals.activeAccounts} accounts`);
    written++;
    day = new Date(day.getTime() + DAY_MS);
  }
  return written;
}

/** One stored day, as /charts plots it: `time` in UTC seconds. */
export type LedgerDayPoint = Omit<DayTotals, 'stateVersion'> & { time: number };

export const getLedgerDays = unstable_cache(
  async (): Promise<LedgerDayPoint[]> => {
    const rows = await prisma.ledgerDay.findMany({ orderBy: { day: 'asc' }, omit: { stateVersion: true } });
    return rows.map(({ day, ...totals }) => ({ time: day.getTime() / 1000, ...totals }));
  },
  ['ledger-days-v1'],
  { revalidate: 3600, tags: ['ledger-days'] },
);
