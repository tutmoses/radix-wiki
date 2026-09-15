// src/lib/radix/network.ts – Network-level stats via Radix Gateway

import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { XRD_ADDRESS } from './config';
import { entityDetailsAt, GatewayUnavailableError, num, postGateway, type GatewayPage } from './gateway';
import { getValidatorSet, summarizeStaking, type StakingSummary, type ValidatorSet } from './validators';

/** The validator directory, what it adds up to, and the $XRD supply, all read at one state version. */
export interface NetworkStats extends ValidatorSet {
  staking: StakingSummary;
  xrdSupply: number;
}

/** Where the ledger stands, from the one endpoint that answers while state reads do not. */
export interface LedgerStatus {
  epoch: number;
  stateVersion: number;
  network: string;
  /** Timestamp of the last round the network agreed. Dates a halt to the second. */
  lastRoundAt?: string;
}

/** `/status/gateway-status` alone: no state reads, so it survives a halted network. */
export const getLedgerStatus = cache(async (): Promise<LedgerStatus | null> => {
  const state = (await postGateway<GatewayPage>('/status/gateway-status', {}, 'gateway-status'))?.ledger_state;
  if (!state) return null;
  return {
    epoch: state.epoch ?? 0,
    stateVersion: state.state_version ?? 0,
    network: state.network ?? 'mainnet',
    lastRoundAt: state.proposer_round_timestamp,
  };
});

const _getNetworkStats = unstable_cache(
  async (): Promise<NetworkStats> => {
    const set = await getValidatorSet();
    // Read at the directory's state version, so the epoch and state version /charts prints
    // are the ones every figure beside them was read at. A supply that did not arrive throws:
    // this used to publish 0 beside a real epoch.
    const xrd = (await entityDetailsAt([XRD_ADDRESS], set.stateVersion, 'xrd-entity')).get(XRD_ADDRESS);
    const xrdSupply = num(xrd?.details?.total_supply);
    if (xrdSupply <= 0) throw new GatewayUnavailableError('/state/entity/details', 'xrd-entity');
    return { ...set, staking: summarizeStaking(set.validators), xrdSupply };
  },
  ['radix-network-stats-v5'],
  { revalidate: 300, tags: ['charts'] },
);

export const getNetworkStats = cache(_getNetworkStats);
