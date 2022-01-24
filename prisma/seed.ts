import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const userData: Prisma.UserCreateInput[] = [
  {
    githubId: 123,
    githubHandle: 'vdersar1',
    oauthToken: 'tokentoken',
  },
];

async function main() {
  console.log('Starting DB seeding...');
  for (const u of userData) {
    const user = await prisma.user.create({
      data: u,
    });
    console.log(`Creating user with id: ${user.id}`);
  }
  console.log('DB Seeding complete. ');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
