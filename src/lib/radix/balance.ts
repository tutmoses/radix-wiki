// src/lib/radix/balance.ts

import { NextResponse } from 'next/server';
import { RADIX_CONFIG, XRD_RESOURCE } from './config';
import { paginatedGatewayFetch } from './gateway';
import { prisma } from '@/lib/prisma/client';
import { getXrdRequired, XRD_NOT_A_FEE } from '@/lib/tags';
import type { AuthSession } from '@/types';

export type BalanceAction = { type: 'create' | 'edit' | 'comment'; tagPath: string };

async function getXrdBalance(address: string): Promise<number> {
  const resource_address = XRD_RESOURCE[RADIX_CONFIG.networkId];
  const amounts = await paginatedGatewayFetch<number>(
    '/state/entity/page/fungible-vaults/',
    { address, resource_address },
    (data) => (data as { items?: { amount: string }[] }).items?.map(v => parseFloat(v.amount || '0')) ?? [],
    'balance',
  );
  return amounts.reduce((sum, n) => sum + n, 0);
}

type BalanceResult =
  | { ok: true; user: { id: string; radixAddress: string }; balance: number }
  | { ok: false; response: NextResponse };

const ACTION_LABELS: Record<BalanceAction['type'], string> = { edit: 'edit pages', create: 'create pages', comment: 'comment' };

const AGENT_WHITELIST = new Set(
  (process.env.AGENT_WHITELIST ?? '').split(',').map(a => a.trim()).filter(Boolean),
);

export async function requireBalance(session: AuthSession, action: BalanceAction): Promise<BalanceResult> {
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, radixAddress: true },
  });

  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'User not found' }, { status: 404 }) };
  }

  if (AGENT_WHITELIST.has(user.radixAddress)) {
    return { ok: true, user, balance: 0 };
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
      error: `To ${ACTION_LABELS[action.type]}${action.tagPath ? ` in ${action.tagPath}` : ''} you must hold at least ${required.toLocaleString()} XRD in your connected wallet. You currently hold ${Math.floor(balance).toLocaleString()} XRD (${shortfall.toLocaleString()} short). ${XRD_NOT_A_FEE}`,
    }, { status: 403 }),
  };
}
