// src/lib/radix/weight.ts – what an account holds in $XRD, staked $XRD included.

import { XRD_ADDRESS } from './config';
import { GatewayUnavailableError, num, paginatedGatewayFetch } from './gateway';
import { getValidatorSet } from './validators';

const FUNGIBLES = '/state/entity/page/fungibles/';

/**
 * An account's $XRD: its liquid balance plus every stake unit it holds, each at
 * what its validator redeems it for. Stake is most of what a holder has (86% across
 * the accounts that voted on the July 2026 proposals), so a liquid-only weight
 * reads a staker as holding almost nothing.
 *
 * Stake being unstaked is a claim NFT and is not counted. Throws
 * `GatewayUnavailableError` when the account, or the rate of a stake unit it
 * holds, could not be read: an unread weight is never a weight of zero.
 */
export async function xrdWeight(address: string): Promise<number> {
  const [held, { validators }] = await Promise.all([
    paginatedGatewayFetch<{ resource: string; amount: number }, { items?: { resource_address: string; amount?: string }[] }>(
      FUNGIBLES,
      { address, aggregation_level: 'Global' },
      (data) => data.items?.map((item) => ({ resource: item.resource_address, amount: num(item.amount) })) ?? [],
      'weight',
    ),
    getValidatorSet(),
  ]);
  const rates = new Map(validators.flatMap((v) => (v.unitResource ? [[v.unitResource, v.xrdPerUnit] as const] : [])));

  return held.reduce((sum, { resource, amount }) => {
    if (resource === XRD_ADDRESS) return sum + amount;
    if (!rates.has(resource) || amount === 0) return sum;
    const rate = rates.get(resource);
    if (rate === undefined) throw new GatewayUnavailableError(FUNGIBLES, 'weight');
    return sum + amount * rate;
  }, 0);
}
