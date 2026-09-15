// src/lib/radix/validators.ts – Validator directory via Radix Gateway

import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import {
  chunks, entityDetailsAt, GatewayUnavailableError, num, paginatedGatewayFetch, postGateway, readMetadata,
  type GatewayPage, type LedgerState,
} from './gateway';

/** `/state/validators/list` is the one endpoint that nests its page a level down. */
interface ValidatorPage extends GatewayPage {
  validators?: { items?: unknown[]; next_cursor?: string | null };
}

interface UptimePage extends GatewayPage {
  validators?: { items?: { address: string; proposals_made?: number; proposals_missed?: number }[] };
}

/** An epoch lasts five minutes: mainnet ran 288 between midnight on 13 and 14 September 2026. */
const EPOCH_MS = 5 * 60_000;
const WEEK_MS = 7 * 86_400_000;

export interface Validator {
  address: string;
  name: string;
  iconUrl?: string;
  totalStake: number;
  /** Fraction of all staked $XRD. */
  stakeShare: number;
  /** Fee actually charged this epoch. This is the number to display. */
  fee: number;
  /** Fee recorded in the validator's substate. Diverges from `fee` for ~78 validators. */
  storedFee: number;
  isRegistered: boolean;
  isActive: boolean;
  /**
   * The owner's locked stake in $XRD. The vault holds stake units, each worth more $XRD every
   * epoch as rewards accrue; publishing the unit count showed Jazzer9F's 1.87m $XRD as 1.52m
   * on 15 September 2026. Unset when the unit supply could not be read.
   */
  ownerStake?: number;
  /** Proposals made over proposals due in the last seven days. Unset when none were due or the read failed. */
  uptime?: number;
  /**
   * Set only when a fee change is still pending; past requests are never cleared on-ledger.
   * `around` is the date the epoch should arrive (YYYY-MM-DD), at five minutes an epoch.
   */
  feeChange?: { epoch: number; fee: number; around?: string };
}

/** The directory and the ledger state it was read at. */
export interface ValidatorSet {
  validators: Validator[];
  epoch: number;
  stateVersion: number;
}

/** A validator before the reads that need the whole list: stake-unit supply and uptime. */
type Parsed = Omit<Validator, 'stakeShare' | 'ownerStake' | 'uptime'> & { ownerUnits: number; unitResource?: string };

function parseValidator(item: any, ledger: LedgerState): Parsed | null {
  if (!item?.address) return null;
  const state = item?.state ?? {};
  const currentEpoch = Number(ledger.epoch) || 0;

  // The charged fee lives at the top level; `state.validator_fee_factor` is the stored
  // substate value, which is not rewritten when a fee change takes effect. Reading the
  // stored one made /charts show DefiPlaza at 0% while it charges 100%.
  const stored = num(state.validator_fee_factor);
  const effective = item?.effective_fee_factor?.current?.fee_factor;
  const fee = effective == null ? stored : num(effective);

  // Requests are left in place after they land, so only a future epoch is pending.
  const request = state.validator_fee_change_request;
  const requestEpoch = Number(request?.epoch_effective);
  const roundAt = Date.parse(ledger.proposer_round_timestamp ?? '');
  const feeChange =
    request && isFinite(requestEpoch) && requestEpoch > currentEpoch
      ? {
        epoch: requestEpoch,
        fee: num(request.new_fee_factor),
        ...(isFinite(roundAt) && { around: new Date(roundAt + (requestEpoch - currentEpoch) * EPOCH_MS).toISOString().slice(0, 10) }),
      }
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
    ownerUnits: num(item?.locked_owner_stake_unit_vault?.balance),
    unitResource: state?.stake_unit_resource_address,
    ...(feeChange ? { feeChange } : {}),
  };
}

/** Proposals made over proposals due in the week before `ledger`, by validator. Null if the Gateway did not answer. */
async function getUptimes(addresses: string[], ledger: LedgerState): Promise<Map<string, number> | null> {
  const roundAt = Date.parse(ledger.proposer_round_timestamp ?? '');
  if (!isFinite(roundAt)) return null;
  const pages = await Promise.all(chunks(addresses, 200).map((batch) => postGateway<UptimePage>(
    '/statistics/validators/uptime',
    {
      validator_addresses: batch,
      from_ledger_state: { timestamp: new Date(roundAt - WEEK_MS).toISOString() },
      at_ledger_state: { state_version: ledger.state_version },
    },
    'validator-uptime',
  )));
  if (pages.some((page) => !page)) return null;
  const uptimes = new Map<string, number>();
  for (const item of pages.flatMap((page) => page?.validators?.items ?? [])) {
    const made = num(item.proposals_made);
    const due = made + num(item.proposals_missed);
    if (due > 0) uptimes.set(item.address, made / due);
  }
  return uptimes;
}

const _getValidatorSet = unstable_cache(
  async (): Promise<ValidatorSet> => {
    let ledger: LedgerState = {};
    const parsed = await paginatedGatewayFetch<Parsed, ValidatorPage>(
      '/state/validators/list',
      {},
      (data) => {
        // Pages after the first are pinned to its state version, so any page's stamp is the set's.
        ledger = data.ledger_state ?? ledger;
        return (data.validators?.items ?? [])
          .map((item) => parseValidator(item, ledger))
          .filter((v): v is Parsed => v !== null);
      },
      'validators',
      (data) => data.validators?.next_cursor ?? data.next_cursor,
    );
    const epoch = Number(ledger.epoch);
    const stateVersion = Number(ledger.state_version);
    if (!epoch || !stateVersion) throw new GatewayUnavailableError('/state/validators/list', 'validators');

    // A stake unit is worth the validator's stake over its unit supply, so owner stake needs
    // each validator's supply, read at the same state version as the stake.
    const unitResources = [...new Set(parsed.flatMap((v) => (v.ownerUnits > 0 && v.unitResource ? [v.unitResource] : [])))];
    const [supplies, uptimes] = await Promise.all([
      entityDetailsAt(unitResources, stateVersion, 'stake-units').catch(() => null),
      getUptimes(parsed.map((v) => v.address), ledger),
    ]);
    const totalStake = parsed.reduce((sum, v) => sum + v.totalStake, 0);

    const validators = parsed.map(({ ownerUnits, unitResource, ...v }): Validator => {
      const supply = unitResource ? num(supplies?.get(unitResource)?.details?.total_supply) : 0;
      const uptime = uptimes?.get(v.address);
      return {
        ...v,
        stakeShare: totalStake > 0 ? v.totalStake / totalStake : 0,
        ...(ownerUnits === 0 ? { ownerStake: 0 } : supply > 0 ? { ownerStake: (ownerUnits * v.totalStake) / supply } : {}),
        ...(uptime === undefined ? {} : { uptime }),
      };
    });
    return { validators: validators.sort((a, b) => b.totalStake - a.totalStake), epoch, stateVersion };
  },
  ['radix-validators-v4'],
  { revalidate: 300, tags: ['charts'] },
);

export const getValidatorSet = cache(_getValidatorSet);

/** What the directory adds up to. Every consumer counts from this, so /charts and the weekly snapshot cannot disagree. */
export interface StakingSummary {
  totalStake: number;
  /** Stake behind the active set: the validators validating this epoch, at most 100. */
  activeStake: number;
  active: number;
  /** Registered and holding stake: the wider set the active one is drawn from. */
  registered: number;
  /** The fewest active validators holding more than a third of active stake, enough to halt consensus. */
  nakamoto: number;
  /** Percent of active stake held by the ten largest active validators, to two decimals. */
  top10Share: number;
  /** The fee charged on the average $XRD of active stake. */
  weightedFee: number;
  pendingFeeChanges: number;
}

function nakamoto(stakes: number[]): number {
  const third = stakes.reduce((a, b) => a + b, 0) / 3;
  let running = 0;
  for (let i = 0; i < stakes.length; i++) {
    running += stakes[i]!;
    if (running > third) return i + 1;
  }
  return 0;
}

export function summarizeStaking(validators: Validator[]): StakingSummary {
  const active = validators.filter((v) => v.isActive);
  const stakes = active.map((v) => v.totalStake).sort((a, b) => b - a);
  const activeStake = stakes.reduce((a, b) => a + b, 0);
  return {
    totalStake: validators.reduce((sum, v) => sum + v.totalStake, 0),
    activeStake,
    active: active.length,
    registered: validators.filter((v) => v.isRegistered && v.totalStake > 0).length,
    nakamoto: nakamoto(stakes),
    top10Share: activeStake > 0 ? Number(((stakes.slice(0, 10).reduce((a, b) => a + b, 0) / activeStake) * 100).toFixed(2)) : 0,
    weightedFee: activeStake > 0 ? active.reduce((sum, v) => sum + v.fee * v.totalStake, 0) / activeStake : 0,
    pendingFeeChanges: validators.filter((v) => v.feeChange).length,
  };
}
