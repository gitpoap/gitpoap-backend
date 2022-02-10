import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const userData: Prisma.UserCreateInput[] = [
  {
    githubId: 1,
    githubHandle: 'vitalikb',
    oauthToken: 'test.test.1',
  },
  {
    githubId: 2,
    githubHandle: 'colfaxs',
    oauthToken: 'test.test.2',
  },
  {
    githubId: 3,
    githubHandle: 'jaypb',
    oauthToken: 'test.test.3',
  },
  {
    githubId: 4,
    githubHandle: 'anthonyb',
    oauthToken: 'test.test.4',
  },
  {
    githubId: 5,
    githubHandle: 'johnz',
    oauthToken: 'test.test.5',
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
