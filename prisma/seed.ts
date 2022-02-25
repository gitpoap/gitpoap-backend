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

const orgData: Prisma.OrganizationCreateInput[] = [
  {
    githubOrgId: 43,
    name: 'org43',
  },
  {
    githubOrgId: 7,
    name: 'seven-heaven',
  },
  {
    githubOrgId: 34343,
    name: 'some-other-org',
  },
];

const repoData: Prisma.RepoCreateInput[] = [
  {
    name: 'repo34',
    githubRepoId: 34,
    Organization: {
      connect: {
        id: 1,
      },
    },
  },
  {
    name: 'repo7',
    githubRepoId: 7,
    Organization: {
      connect: {
        id: 2,
      },
    },
  },
  {
    name: 'repo568',
    githubRepoId: 568,
    Organization: {
      connect: {
        id: 3,
      },
    },
  },
];

const poapData: Prisma.GitPOAPCreateInput[] = [
  {
    year: 2022,
    poapEventId: 80,
    repo: {
      connect: {
        id: 1,
      },
    },
  },
  {
    year: 2024,
    poapEventId: 345,
    repo: {
      connect: {
        id: 2,
      },
    },
  },
  {
    year: 2015,
    poapEventId: 4,
    repo: {
      connect: {
        id: 3,
      },
    },
  },
];

const claimData: Prisma.ClaimCreateInput[] = [
  {
    gitPOAP: {
      connect: {
        id: 1,
      },
    },
    user: {
      connect: {
        id: 1,
      },
    },
  },
  {
    gitPOAP: {
      connect: {
        id: 2,
      },
    },
    user: {
      connect: {
        id: 2,
      },
    },
  },
  {
    gitPOAP: {
      connect: {
        id: 3,
      },
    },
    user: {
      connect: {
        id: 3,
      },
    },
  },
];

const profileData: Prisma.ProfileCreateInput[] = [
  {
    address: '0x56d389C4E07A48d429035532402301310B8143A0',
    bio: 'I like brisket.',
  },
  {
    address: '0x89DAB21047e6De0e77Deee5F4F286D72Be50B942',
    bio: 'I like bbq.',
  },
  {
    address: '0x304Cf9A8b0856F47cCf9cFd5A5BAD1D67b0576a7',
    bio: 'I like factorio.',
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

  for (const r of orgData) {
    const org = await prisma.organization.create({
      data: r,
    });
    console.log(`Creating organization with id: ${org.id}`);
  }

  for (const r of repoData) {
    const repo = await prisma.repo.create({
      data: r,
    });
    console.log(`Creating repo with id: ${repo.id}`);
  }

  for (const p of poapData) {
    const poap = await prisma.gitPOAP.create({
      data: p,
    });
    console.log(`Creating GitPOAP with id: ${poap.id}`);
  }

  for (const c of claimData) {
    const claim = await prisma.claim.create({
      data: c,
    });
    console.log(`Creating claim with id: ${claim.id}`);
  }

  for (const p of profileData) {
    const profile = await prisma.profile.create({
      data: p,
    });
    console.log(`Creating profile with id: ${profile.id}`);
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
