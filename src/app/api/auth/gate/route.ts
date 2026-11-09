// src/app/api/auth/gate/route.ts — pre-flight $XRD balance check so the editor
// can state the gate before any writing happens, not as a 403 after save.

import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { checkBalance, balanceRefusal, type BalanceAction } from '@/lib/radix/balance';
import { errors, handleRoute, json } from 'wiki-formant/http';

const GATE_TYPES = new Set(['create', 'edit', 'comment']);

/** The write routes' own answers: 200, a shortfall's 403, or a check that could not be made. */
export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const session = await getSession(request);
    if (!session) return errors.unauthorized();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') ?? '';
    const tagPath = searchParams.get('tagPath') ?? '';
    if (!GATE_TYPES.has(type)) return errors.badRequest('Invalid gate type');

    const action = { type, tagPath } as BalanceAction;
    const check = await checkBalance(session, action);
    return check.status === 'allowed' ? json({ balance: check.balance }) : balanceRefusal(check, action);
  }, 'Gate check failed');
}
