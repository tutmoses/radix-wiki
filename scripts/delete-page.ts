import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const deleted = await prisma.page.delete({ where: { tagPath_slug: { tagPath: 'ecosystem', slug: 'template' } } });
  console.log(`Deleted: ${deleted.title} (${deleted.id})`);
  await prisma.$disconnect();
  pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
