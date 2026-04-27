// src/lib/radix/validators.ts — Validator directory via Radix Gateway

import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { getGatewayUrl, RADIX_CONFIG } from './config';

export interface Validator {
  address: string;
  name: string;
  iconUrl?: string;
  totalStake: number;
  fee: number;
  isRegistered: boolean;
  ownerStake: number;
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

function parseValidator(item: any): Validator | null {
  if (!item?.address) return null;
  const stakeBalance = parseFloat(item?.stake_vault?.balance ?? '0');
  const ownerVault = parseFloat(item?.locked_owner_stake_unit_vault?.balance ?? '0');
  const state = item?.state ?? {};
  const feeRaw = state?.validator_fee_factor ?? state?.current_epoch_effective_fee_factor?.current?.fee_factor;
  const fee = parseFloat(feeRaw ?? '0');
  const name = readMetadata(item.metadata, 'name') || item.address.slice(0, 16);
  const iconUrl = readMetadata(item.metadata, 'icon_url');

  return {
    address: item.address,
    name,
    iconUrl,
    totalStake: isFinite(stakeBalance) ? stakeBalance : 0,
    fee: isFinite(fee) ? fee : 0,
    isRegistered: state?.is_registered !== false,
    ownerStake: isFinite(ownerVault) ? ownerVault : 0,
  };
}

async function fetchAllValidators(): Promise<any[]> {
  const url = `${getGatewayUrl(RADIX_CONFIG.networkId)}/state/validators/list`;
  const items: any[] = [];
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
      const wrapper = data?.validators ?? {};
      if (Array.isArray(wrapper.items)) items.push(...wrapper.items);
      cursor = wrapper.next_cursor ?? data?.next_cursor ?? undefined;
    } while (cursor);
  } catch (err) {
    console.error('[validators] error', err);
  }
  return items;
}

const _getValidators = unstable_cache(
  async (): Promise<Validator[]> => {
    const items = await fetchAllValidators();
    return items
      .map(parseValidator)
      .filter((v): v is Validator => v !== null)
      .sort((a, b) => b.totalStake - a.totalStake);
  },
  ['radix-validators-v2'],
  { revalidate: 300, tags: ['charts'] },
);

export const getValidators = cache(_getValidators);
