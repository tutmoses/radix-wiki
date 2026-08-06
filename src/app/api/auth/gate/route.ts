// src/app/api/auth/gate/route.ts — pre-flight XRD balance check so the editor
// can state the gate before any writing happens, not as a 403 after save.

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { requireBalance, type BalanceAction } from '@/lib/radix/balance';
import { errors, handleRoute } from '@/lib/api';

const GATE_TYPES = new Set(['create', 'edit', 'comment']);

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const session = await getSession(request);
    if (!session) return errors.unauthorized();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') ?? '';
    const tagPath = searchParams.get('tagPath') ?? '';
    if (!GATE_TYPES.has(type)) return errors.badRequest('Invalid gate type');

    const check = await requireBalance(session, { type, tagPath } as BalanceAction);
    if (check.ok) return NextResponse.json({ allowed: true, balance: check.balance });
    // The 403 body already carries balance/required/error — surface it as gate data.
    const body = await check.response.json();
    return NextResponse.json({ allowed: false, ...body });
  }, 'Gate check failed');
}
