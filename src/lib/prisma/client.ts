// src/lib/prisma/client.ts

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { shortenAddress } from '@/lib/utils';

function buildClient() {
  // Sized by which pooler the URL names, because the ceiling belongs to the
  // pooler and not to us. Port 5432 is Supabase's SESSION pooler, capped at 15
  // clients per project and shared with the build's workers. Port 6543 is the
  // TRANSACTION pooler, which exists to hold many short-lived clients.
  //
  // `max: 1` was not "minimal", it was serial. `pg` reports an exhausted pool
  // as "timeout exceeded when trying to connect", which reads as a network
  // fault and is not one: connecting takes well under a second, while an
  // acquire queued behind the one busy client waits the full 30s. Any page or
  // agent call that issues two queries at once paid for it, and on acuiq2 the
  // same setting made the first MCP call after a restart fail outright.
  const transactionPooler = (process.env.DATABASE_URL ?? '').includes(':6543');
  const adapter = new PrismaPg(new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: transactionPooler ? 10 : 3,
    idleTimeoutMillis: 20000,
    // The acquire timeout, despite the message it fails with.
    connectionTimeoutMillis: 30000,
  }));

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  }).$extends({
    // Public payloads carry a display-safe truncation of the wallet address, never
    // the full one — computed at the query layer so no select can leak it. The full
    // address stays server-side (auth, rewards CSV) via the radixAddress column.
    result: {
      user: {
        shortAddress: {
          needs: { radixAddress: true },
          compute: (user) => shortenAddress(user.radixAddress),
        },
      },
    },
  });
}

// Cached on globalThis so a warm invocation — or an HMR reload — reuses the one
// client, and with it the one pool. The client owns the pool, so caching it is
// the whole of the caching.
const globalForPrisma = globalThis as unknown as { prisma: ReturnType<typeof buildClient> | undefined };

export const prisma = globalForPrisma.prisma ?? buildClient();
globalForPrisma.prisma = prisma;
