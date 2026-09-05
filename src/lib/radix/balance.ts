// src/lib/radix/balance.ts

import { NextResponse } from 'next/server';
import { XRD_ADDRESS } from './config';
import { paginatedGatewayFetch } from './gateway';
import { prisma } from '@/lib/prisma/client';
import { getXrdRequired, XRD_NOT_A_FEE } from '@/lib/tags';
import type { AuthSession } from '@/types';

export type BalanceAction = { type: 'create' | 'edit' | 'comment'; tagPath: string };

/** Total XRD across every fungible vault an account holds. */
export async function getXrdBalance(address: string, label = 'balance'): Promise<number> {
  const amounts = await paginatedGatewayFetch<number, { items?: { amount: string }[] }>(
    '/state/entity/page/fungible-vaults/',
    { address, resource_address: XRD_ADDRESS },
    (data) => data.items?.map(v => parseFloat(v.amount || '0')) ?? [],
    label,
  );
  return amounts.reduce((sum, n) => sum + n, 0);
}

const TREASURY_ADDRESS = process.env.WIKI_TREASURY_ADDRESS || '';

export function getTreasuryAddress(): string {
  return TREASURY_ADDRESS;
}

export async function getTreasuryBalance(): Promise<number> {
  return TREASURY_ADDRESS ? getXrdBalance(TREASURY_ADDRESS, 'treasury') : 0;
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
