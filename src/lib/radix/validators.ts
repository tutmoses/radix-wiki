// src/lib/radix/validators.ts — Validator directory via Radix Gateway

import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { getGatewayUrl, RADIX_CONFIG } from './config';

export interface Validator {
  address: string;
  name: string;
  iconUrl?: string;
  totalStake: number;
  /** Fee actually charged this epoch. This is the number to display. */
  fee: number;
  /** Fee recorded in the validator's substate. Diverges from `fee` for ~78 validators. */
  storedFee: number;
  isRegistered: boolean;
  isActive: boolean;
  ownerStake: number;
  /** Set only when a fee change is still pending; past requests are never cleared on-ledger. */
  feeChange?: { epoch: number; fee: number };
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

function num(value: unknown): number {
  const n = parseFloat(String(value ?? '0'));
  return isFinite(n) ? n : 0;
}

function parseValidator(item: any, currentEpoch: number): Validator | null {
  if (!item?.address) return null;
  const state = item?.state ?? {};

  // The charged fee lives at the top level; `state.validator_fee_factor` is the stored
  // substate value, which is not rewritten when a fee change takes effect. Reading the
  // stored one made /charts show DefiPlaza at 0% while it charges 100%.
  const stored = num(state.validator_fee_factor);
  const effective = item?.effective_fee_factor?.current?.fee_factor;
  const fee = effective == null ? stored : num(effective);

  // Requests are left in place after they land, so only a future epoch is pending.
  const request = state.validator_fee_change_request;
  const requestEpoch = Number(request?.epoch_effective);
  const feeChange =
    request && isFinite(requestEpoch) && requestEpoch > currentEpoch
      ? { epoch: requestEpoch, fee: num(request.new_fee_factor) }
      : undefined;

  return {
    address: item.address,
    name: readMetadata(item.metadata, 'name') || item.address.slice(0, 16),
    iconUrl: readMetadata(item.metadata, 'icon_url'),
    totalStake: num(item?.stake_vault?.balance),
    fee,
    storedFee: stored,
    isRegistered: state?.is_registered !== false,
    isActive: !!item?.active_in_epoch,
    ownerStake: num(item?.locked_owner_stake_unit_vault?.balance),
    ...(feeChange ? { feeChange } : {}),
  };
}

async function fetchAllValidators(): Promise<{ items: any[]; epoch: number }> {
  const url = `${getGatewayUrl(RADIX_CONFIG.networkId)}/state/validators/list`;
  const items: any[] = [];
  let epoch = 0;
  let cursor: string | undefined;
  try {
    do {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cursor ? { cursor } : {}),
        cache: 'no-store',
      });
      if (!res.ok) {
        console.error(`[validators] Gateway ${res.status}`);
        break;
      }
      const data = await res.json();
      epoch = Number(data?.ledger_state?.epoch) || epoch;
      const wrapper = data?.validators ?? {};
      if (Array.isArray(wrapper.items)) items.push(...wrapper.items);
      cursor = wrapper.next_cursor ?? data?.next_cursor ?? undefined;
    } while (cursor);
  } catch (err) {
    console.error('[validators] error', err);
  }
  return { items, epoch };
}

const _getValidators = unstable_cache(
  async (): Promise<Validator[]> => {
    const { items, epoch } = await fetchAllValidators();
    return items
      .map((item) => parseValidator(item, epoch))
      .filter((v): v is Validator => v !== null)
      .sort((a, b) => b.totalStake - a.totalStake);
  },
  ['radix-validators-v3'],
  { revalidate: 300, tags: ['charts'] },
);

export const getValidators = cache(_getValidators);
