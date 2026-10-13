// src/components/charts/rows.ts – the server-side half of the /charts tables: each row gains
// the wiki article it belongs to, so a reader can go from a figure to what it is about.

import { getAssetPages, getValidatorPages } from '@/lib/wiki';
import { stakerApr } from '@/lib/radix/validators';
import { pagePath } from '@/lib/utils';
import type { NetworkStats } from '@/lib/radix/network';
import type { TokenSummary } from '@/lib/radix/tokens';
import type { TokenRow } from './TokensTable';
import type { ValidatorRow } from './ValidatorsTable';

export async function tokenRows(tokens: TokenSummary[]): Promise<TokenRow[]> {
  const pages = await getAssetPages().catch(() => ({}) as Awaited<ReturnType<typeof getAssetPages>>);
  return tokens.map(t => {
    const page = pages[t.address];
    return page ? { ...t, wikiPath: pagePath(page.tagPath, page.slug) } : t;
  });
}

export async function validatorRows({ validators, staking }: NetworkStats): Promise<ValidatorRow[]> {
  const pages = await getValidatorPages().catch(() => ({}) as Awaited<ReturnType<typeof getValidatorPages>>);
  return validators.map(v => {
    const page = pages[v.address];
    return {
      ...v,
      ...(page && { wikiPath: pagePath(page.tagPath, page.slug) }),
      ...(v.isActive && { apr: stakerApr(v.fee, staking.activeStake) }),
    };
  });
}
