// src/lib/radix/network.ts — Network-level stats via Radix Gateway

import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { RADIX_CONFIG, XRD_RESOURCE } from './config';
import { postGateway } from './gateway';
import { getValidators } from './validators';

export interface NetworkStats {
  totalStake: number;
  xrdSupply: number;
  validatorCount: number;
  activeValidatorCount: number;
  currentEpoch: number;
  ledgerStateVersion: number;
  network: string;
  lastUpdated: string;
}

const _getNetworkStats = unstable_cache(
  async (): Promise<NetworkStats> => {
    const xrdAddress = XRD_RESOURCE[RADIX_CONFIG.networkId] ?? XRD_RESOURCE[1]!;

    const [validators, status, xrdEntity] = await Promise.all([
      getValidators(),
      postGateway<any>('/status/gateway-status', {}, 'gateway-status'),
      postGateway<any>('/state/entity/details', { addresses: [xrdAddress] }, 'xrd-entity'),
    ]);

    const totalStake = validators.reduce((sum, v) => sum + v.totalStake, 0);
    const activeValidatorCount = validators.filter(v => v.isRegistered && v.totalStake > 0).length;
    const xrdItem = xrdEntity?.items?.[0];
    const xrdSupply = parseFloat(xrdItem?.details?.total_supply ?? '0');

    return {
      totalStake,
      xrdSupply: isFinite(xrdSupply) ? xrdSupply : 0,
      validatorCount: validators.length,
      activeValidatorCount,
      currentEpoch: status?.ledger_state?.epoch ?? 0,
      ledgerStateVersion: status?.ledger_state?.state_version ?? 0,
      network: status?.ledger_state?.network ?? 'mainnet',
      lastUpdated: new Date().toISOString(),
    };
  },
  ['radix-network-stats-v3'],
  { revalidate: 300, tags: ['charts'] },
);

export const getNetworkStats = cache(_getNetworkStats);
