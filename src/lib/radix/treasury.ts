// src/lib/radix/treasury.ts

import { RADIX_CONFIG, XRD_RESOURCE } from './config';
import { paginatedGatewayFetch } from './gateway';

const TREASURY_ADDRESS = process.env.WIKI_TREASURY_ADDRESS || '';

export function getTreasuryAddress(): string {
  return TREASURY_ADDRESS;
}

export async function getTreasuryBalance(): Promise<number> {
  if (!TREASURY_ADDRESS) return 0;

  const resource_address = XRD_RESOURCE[RADIX_CONFIG.networkId];
  const amounts = await paginatedGatewayFetch<number>(
    '/state/entity/page/fungible-vaults/',
    { address: TREASURY_ADDRESS, resource_address },
    (data) => (data as { items?: { amount: string }[] }).items?.map(v => parseFloat(v.amount || '0')) ?? [],
    'treasury',
  );
  return amounts.reduce((sum, n) => sum + n, 0);
}
