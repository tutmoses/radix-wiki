// src/lib/prisma/client.ts

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { shortenAddress } from '@/lib/utils';

function createPool(): pg.Pool {
  if (globalForPrisma.pool) {
    return globalForPrisma.pool;
  }

  const connectionString = process.env.DATABASE_URL;

  // For serverless (Neon/Supabase), use minimal pool
  const pool = new pg.Pool({
    connectionString,
    max: 1,
    idleTimeoutMillis: 20000,
    connectionTimeoutMillis: 30000,
  });

  // Always cache the pool to prevent multiple instances
  globalForPrisma.pool = pool;

  return pool;
}

function buildClient() {
  const pool = createPool();
  const adapter = new PrismaPg(pool);

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

type ExtendedPrismaClient = ReturnType<typeof buildClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined;
  pool: pg.Pool | undefined;
};

function createPrismaClient(): ExtendedPrismaClient {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  const prisma = buildClient();

  // Always cache to prevent multiple instances
  globalForPrisma.prisma = prisma;

  return prisma;
}

export const prisma = createPrismaClient();

export default prisma;
