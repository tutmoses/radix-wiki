// src/lib/radix/validators.ts — Validator directory via Radix Gateway

import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { num, paginatedGatewayFetch, readMetadata, type GatewayPage } from './gateway';

/** `/state/validators/list` is the one endpoint that nests its page a level down. */
interface ValidatorPage extends GatewayPage {
  validators?: { items?: unknown[]; next_cursor?: string | null };
}

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

const _getValidators = unstable_cache(
  async (): Promise<Validator[]> => {
    // The epoch that makes a pending fee change "pending" ships with each page, so
    // validators are parsed page by page rather than collected and parsed after.
    const validators = await paginatedGatewayFetch<Validator, ValidatorPage>(
      '/state/validators/list',
      {},
      (data) => {
        const epoch = Number(data.ledger_state?.epoch) || 0;
        return (data.validators?.items ?? [])
          .map((item) => parseValidator(item, epoch))
          .filter((v): v is Validator => v !== null);
      },
      'validators',
      (data) => data.validators?.next_cursor ?? data.next_cursor,
    );
    return validators.sort((a, b) => b.totalStake - a.totalStake);
  },
  ['radix-validators-v3'],
  { revalidate: 300, tags: ['charts'] },
);

export const getValidators = cache(_getValidators);
