// src/app/api/cron/ledger-days/route.ts – the daily catch-up for ledger_days (vercel.json crons).
//
// Vercel sends `Authorization: Bearer $CRON_SECRET`. With no secret set the route answers
// 404 to everyone, so an unconfigured deployment has no way to start a stream read.

import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { syncLedgerDays } from '@/lib/radix/activity';

export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  try {
    // A minute short of maxDuration: a day cut off by the deadline is not stored and is
    // read again tomorrow, so stopping early loses nothing.
    const written = await syncLedgerDays(Date.now() + 240_000);
    if (written) revalidateTag('ledger-days', { expire: 0 });
    return NextResponse.json({ written });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 503 });
  }
}
