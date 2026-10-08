// src/app/api/cron/ledger-days/route.ts – the daily catch-up for ledger_days (vercel.json crons).
//
// Vercel sends `Authorization: Bearer $CRON_SECRET`. With no secret set the route answers
// 404 to everyone, so an unconfigured deployment has no way to start a stream read.

import { revalidateTag } from 'next/cache';
import { json, errors } from '@/lib/api';
import { syncLedgerDays } from '@/lib/radix/activity';

export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return errors.notFound();
  }
  try {
    // A minute short of maxDuration: a day cut off by the deadline is not stored and is
    // read again tomorrow, so stopping early loses nothing.
    const written = await syncLedgerDays(Date.now() + 240_000);
    if (written) revalidateTag('ledger-days', { expire: 0 });
    return json({ written });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 503);
  }
}
