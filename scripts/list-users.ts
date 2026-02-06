import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, displayName: true, radixAddress: true } });
  console.log(JSON.stringify(users, null, 2));
  await prisma.$disconnect();
  pool.end();
}

main();
