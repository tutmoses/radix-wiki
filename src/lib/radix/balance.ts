// src/lib/radix/balance.ts

import { XRD_ADDRESS } from './config';
import { paginatedGatewayFetch } from './gateway';
import { prisma } from '@/lib/prisma/client';
import { getXrdRequired, XRD_NOT_A_FEE } from '@/lib/tags';
import { errors, json } from 'wiki-formant/http';
import type { AuthSession } from '@/types';

export type BalanceAction = { type: 'create' | 'edit' | 'comment'; tagPath: string };

/** Total $XRD across every fungible vault an account holds. */
async function getXrdBalance(address: string): Promise<number> {
  const amounts = await paginatedGatewayFetch<number, { items?: { amount: string }[] }>(
    '/state/entity/page/fungible-vaults/',
    { address, resource_address: XRD_ADDRESS },
    (data) => data.items?.map(v => parseFloat(v.amount || '0')) ?? [],
    'balance',
  );
  return amounts.reduce((sum, n) => sum + n, 0);
}

/**
 * What a balance check found. An unread balance is its own outcome, never a
 * balance of zero: that told the holder of 100,000 $XRD, while the Gateway was
 * not answering, that they held none and were short by 50,000.
 */
export type BalanceCheck =
  | { status: 'allowed'; balance: number }
  | { status: 'short'; balance: number; required: number }
  | { status: 'unreadable' }
  | { status: 'no-user' };

export async function checkBalance(session: AuthSession, action: BalanceAction): Promise<BalanceCheck> {
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { radixAddress: true } });
  if (!user) return { status: 'no-user' };
  const required = getXrdRequired(action.type, action.tagPath);
  let balance: number;
  try {
    balance = await getXrdBalance(user.radixAddress);
  } catch {
    return { status: 'unreadable' };
  }
  return balance >= required ? { status: 'allowed', balance } : { status: 'short', balance, required };
}

const ACTION_LABELS: Record<BalanceAction['type'], string> = { edit: 'edit pages', create: 'create pages', comment: 'comment' };

/**
 * The answer to a check that did not pass. A shortfall is the only 403, so a
 * caller can tell a refusal from a check that could not be made.
 */
export function balanceRefusal(check: Exclude<BalanceCheck, { status: 'allowed' }>, action: BalanceAction): Response {
  switch (check.status) {
    case 'no-user':
      return errors.notFound('User not found');
    case 'unreadable':
      return json({ error: 'Your $XRD balance cannot be read right now: the Radix Gateway is not answering. This is not a judgement about your wallet — try again shortly.' }, 503);
    case 'short': {
      const { balance, required } = check;
      const shortfall = required - Math.floor(balance);
      return errors.forbidden(
        `To ${ACTION_LABELS[action.type]}${action.tagPath ? ` in ${action.tagPath}` : ''} you must hold at least ${required.toLocaleString()} XRD in your connected wallet. You currently hold ${Math.floor(balance).toLocaleString()} XRD (${shortfall.toLocaleString()} short). ${XRD_NOT_A_FEE}`,
        { balance, required },
      );
    }
  }
}
