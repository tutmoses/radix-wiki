// src/lib/radix/balance.ts

import { NextResponse } from 'next/server';
import { getGatewayUrl, RADIX_CONFIG, RadixNetworkId } from './config';
import { getXrdRequirements, XRD_DEFAULTS } from '@/lib/tags';
import { prisma } from '@/lib/prisma/client';
import type { AuthSession } from '@/types';

const XRD_RESOURCE: Record<number, string> = {
  [RadixNetworkId.Mainnet]: 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd',
  [RadixNetworkId.Stokenet]: 'resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc',
};

export type BalanceAction =
  | { type: 'editHomepage' }
  | { type: 'edit'; tagPath: string }
  | { type: 'create'; tagPath: string }
  | { type: 'comment'; tagPath: string };

export function getRequirement(action: BalanceAction): number {
  if (action.type === 'editHomepage') {
    return XRD_DEFAULTS.homepage.edit;
  }

  const pathSegments = action.tagPath.split('/').filter(Boolean);
  const tagRequirements = getXrdRequirements(pathSegments);

  switch (action.type) {
    case 'create':
      return tagRequirements.create ?? XRD_DEFAULTS.create;
    case 'edit':
      return tagRequirements.edit ?? XRD_DEFAULTS.edit;
    case 'comment':
      return tagRequirements.comment ?? XRD_DEFAULTS.comment;
  }
}

export async function getXrdBalance(address: string): Promise<number> {
  try {
    const response = await fetch(`${getGatewayUrl(RADIX_CONFIG.networkId)}/state/entity/details`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        addresses: [address],
        aggregation_level: 'Vault',
        opt_ins: { explicit_metadata: [] },
      }),
    });

    if (!response.ok) return 0;

    const data = await response.json();
    const fungibles = data.items?.[0]?.fungible_resources?.items || [];
    const xrd = fungibles.find((r: { resource_address: string }) => 
      r.resource_address === XRD_RESOURCE[RADIX_CONFIG.networkId]
    );

    return xrd?.vaults?.items?.reduce(
      (sum: number, v: { amount: string }) => sum + parseFloat(v.amount || '0'),
      0
    ) || 0;
  } catch {
    return 0;
  }
}

type BalanceResult =
  | { ok: true; user: { id: string; radixAddress: string }; balance: number }
  | { ok: false; response: NextResponse };

export async function requireBalance(session: AuthSession, action: BalanceAction): Promise<BalanceResult> {
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, radixAddress: true },
  });

  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'User not found' }, { status: 404 }) };
  }

  const required = getRequirement(action);
  const balance = await getXrdBalance(user.radixAddress);

  if (balance >= required) {
    return { ok: true, user, balance };
  }

  return {
    ok: false,
    response: NextResponse.json({
      ok: false,
      balance,
      required,
      error: `Insufficient XRD balance. Required: ${required.toLocaleString()} XRD, Available: ${Math.floor(balance).toLocaleString()} XRD`,
    }, { status: 403 }),
  };
}