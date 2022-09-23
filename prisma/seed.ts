import 'reflect-metadata';
import { PrismaClient } from '@prisma/client';
import { seed as seedDev } from './seed-dev';
import { seed as seedTest } from './seed-test';

export const prisma = new PrismaClient();

async function main() {
  if (process.env.TEST_ENV === 'integration') {
    console.log('Seeding DB via integration test script...');
    await seedTest(prisma);
  } else {
    console.log('Seeding DB via default seed script...');
    await seedDev(prisma);
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
