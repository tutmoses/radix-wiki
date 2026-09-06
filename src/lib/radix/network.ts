// src/lib/radix/network.ts — Network-level stats via Radix Gateway

import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { XRD_ADDRESS } from './config';
import { entityDetails, num, postGateway, type GatewayPage } from './gateway';
import { getValidators } from './validators';

export interface NetworkStats {
  totalStake: number;
  xrdSupply: number;
  validatorCount: number;
  /** The consensus active set — the validators actually validating this epoch. */
  activeValidatorCount: number;
  /** The wider set that has registered and holds stake. Always larger than the active set. */
  registeredValidatorCount: number;
  currentEpoch: number;
  ledgerStateVersion: number;
  network: string;
  lastUpdated: string;
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
  const status = await postGateway<GatewayPage>('/status/gateway-status', {}, 'gateway-status');
  const state = status?.ledger_state as (GatewayPage['ledger_state'] & { proposer_round_timestamp?: string }) | undefined;
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
    const [validators, status, xrd] = await Promise.all([
      getValidators(),
      postGateway<GatewayPage>('/status/gateway-status', {}, 'gateway-status'),
      entityDetails(XRD_ADDRESS, 'xrd-entity'),
    ]);

    return {
      totalStake: validators.reduce((sum, v) => sum + v.totalStake, 0),
      xrdSupply: num(xrd?.details?.total_supply),
      validatorCount: validators.length,
      // Registered-and-staked is not the active set: Radix validates with the top 100 by
      // stake, and the chart labelled the wider number "Active validators" for both.
      activeValidatorCount: validators.filter(v => v.isActive).length,
      registeredValidatorCount: validators.filter(v => v.isRegistered && v.totalStake > 0).length,
      currentEpoch: status?.ledger_state?.epoch ?? 0,
      ledgerStateVersion: status?.ledger_state?.state_version ?? 0,
      network: status?.ledger_state?.network ?? 'mainnet',
      lastUpdated: new Date().toISOString(),
    };
  },
  ['radix-network-stats-v4'],
  { revalidate: 300, tags: ['charts'] },
);

export const getNetworkStats = cache(_getNetworkStats);
