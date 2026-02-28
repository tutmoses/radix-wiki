// src/lib/radix/treasury.ts

import { getGatewayUrl, RADIX_CONFIG, RadixNetworkId } from './config';

const XRD_RESOURCE: Record<number, string> = {
  [RadixNetworkId.Mainnet]: 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd',
  [RadixNetworkId.Stokenet]: 'resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc',
};

const TREASURY_ADDRESS = process.env.WIKI_TREASURY_ADDRESS || '';

export function getTreasuryAddress(): string {
  return TREASURY_ADDRESS;
}

export async function getTreasuryBalance(): Promise<number> {
  if (!TREASURY_ADDRESS) return 0;

  const url = `${getGatewayUrl(RADIX_CONFIG.networkId)}/state/entity/page/fungible-vaults/`;
  const resource_address = XRD_RESOURCE[RADIX_CONFIG.networkId];
  let total = 0;
  let cursor: string | undefined;

  try {
    do {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: TREASURY_ADDRESS, resource_address, ...(cursor && { cursor }) }),
        cache: 'no-store',
      });

      if (!response.ok) {
        console.error(`[treasury] Gateway ${response.status}: ${await response.text().catch(() => '')}`);
        return total;
      }

      const data = await response.json() as {
        items?: { amount: string }[];
        next_cursor?: string | null;
      };

      total += data.items?.reduce((sum, v) => sum + parseFloat(v.amount || '0'), 0) ?? 0;
      cursor = data.next_cursor ?? undefined;
    } while (cursor);
  } catch (err) {
    console.error('[treasury] Gateway error:', err);
  }

  return total;
}
