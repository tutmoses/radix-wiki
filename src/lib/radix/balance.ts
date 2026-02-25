// src/lib/radix/balance.ts

import { NextResponse } from 'next/server';
import { getGatewayUrl, RADIX_CONFIG, RadixNetworkId } from './config';
import { prisma } from '@/lib/prisma/client';
import { getXrdRequired } from '@/lib/tags';
import type { AuthSession } from '@/types';

const XRD_RESOURCE: Record<number, string> = {
  [RadixNetworkId.Mainnet]: 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd',
  [RadixNetworkId.Stokenet]: 'resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc',
};

export type BalanceAction = { type: 'create' | 'edit' | 'comment'; tagPath: string };

async function getXrdBalance(address: string): Promise<number> {
  try {
    const response = await fetch(`${getGatewayUrl(RADIX_CONFIG.networkId)}/state/entity/page/fungible-vaults/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_address: address, resource_address: XRD_RESOURCE[RADIX_CONFIG.networkId] }),
    });
    if (!response.ok) return 0;

    const data = await response.json();
    return (data.items as { amount: string }[])?.reduce((sum, v) => sum + parseFloat(v.amount || '0'), 0) || 0;
  } catch {
    return 0;
  }
}

type BalanceResult =
  | { ok: true; user: { id: string; radixAddress: string }; balance: number }
  | { ok: false; response: NextResponse };

const ACTION_LABELS: Record<BalanceAction['type'], string> = { edit: 'edit pages', create: 'create pages', comment: 'comment' };

export async function requireBalance(session: AuthSession, action: BalanceAction): Promise<BalanceResult> {
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, radixAddress: true },
  });

  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'User not found' }, { status: 404 }) };
  }

  const required = getXrdRequired(action.type, action.tagPath);
  const balance = await getXrdBalance(user.radixAddress);

  if (balance >= required) return { ok: true, user, balance };

  const shortfall = required - Math.floor(balance);

  return {
    ok: false,
    response: NextResponse.json({
      ok: false,
      balance,
      required,
      error: `You need ${required.toLocaleString()} XRD to ${ACTION_LABELS[action.type]}${action.tagPath ? ` in ${action.tagPath}` : ''}. You have ${Math.floor(balance).toLocaleString()} XRD (${shortfall.toLocaleString()} XRD short).`,
    }, { status: 403 }),
  };
}
