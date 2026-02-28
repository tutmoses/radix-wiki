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
  const url = `${getGatewayUrl(RADIX_CONFIG.networkId)}/state/entity/page/fungible-vaults/`;
  const resource_address = XRD_RESOURCE[RADIX_CONFIG.networkId];
  let total = 0;
  let cursor: string | undefined;

  try {
    do {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, resource_address, ...(cursor && { cursor }) }),
        cache: 'no-store',
      });

      if (!response.ok) {
        console.error(`[balance] Gateway ${response.status} for ${address.slice(0, 20)}…: ${await response.text().catch(() => '')}`);
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
    console.error(`[balance] Gateway error for ${address.slice(0, 20)}…:`, err);
  }

  return total;
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
