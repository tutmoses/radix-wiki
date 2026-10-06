// scripts/ledger-days.ts – fills ledger_days from the last stored day up to yesterday.
//
//   npx tsx scripts/ledger-days.ts            # run until caught up
//   npx tsx scripts/ledger-days.ts --for 600  # stop after ten minutes
//
// The first run is the backfill from Babylon genesis: about 110k stream pages at the
// public Gateway's rate limit, so a day or more. Every day is stored as it completes and
// a run resumes after the last one, so stopping it costs only the day in progress. After
// that the daily cron (/api/cron/ledger-days) keeps the table current.

import { config } from 'dotenv';

config({ quiet: true });

// The Prisma client connects on import, so it is loaded only once the env is.
const { syncLedgerDays } = await import('@/lib/radix/activity');
const seconds = Number(process.argv[process.argv.indexOf('--for') + 1]);
const deadline = process.argv.includes('--for') && seconds > 0 ? Date.now() + seconds * 1000 : Infinity;

const written = await syncLedgerDays(deadline, console.log);
console.log(`${written} days written`);
process.exit(0);
