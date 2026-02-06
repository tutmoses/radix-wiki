import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const count = await prisma.page.count({ where: { tagPath: 'ecosystem' } });
  console.log(`Total ecosystem pages in DB: ${count}`);

  const pages = await prisma.page.findMany({
    where: { tagPath: 'ecosystem' },
    select: { slug: true, title: true },
    orderBy: { title: 'asc' },
  });
  pages.forEach(p => console.log(`  ${p.slug} — ${p.title}`));

  await prisma.$disconnect();
  pool.end();
}

main();
