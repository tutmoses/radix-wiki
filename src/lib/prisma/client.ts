// src/lib/prisma/client.ts

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { shortenAddress } from '@/lib/utils';

function buildClient() {
  // For serverless (Neon/Supabase), use minimal pool
  const adapter = new PrismaPg(new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    idleTimeoutMillis: 20000,
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
