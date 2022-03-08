import 'reflect-metadata';
import { PrismaClient, Prisma } from '@prisma/client';
import { ClaimStatus } from '@generated/type-graphql';
import { ClaimFactory } from './factories';

const prisma = new PrismaClient();

const addresses = {
  test1: '0xae95f7e7fb2fcf86148ef832faed2752ae5a358a' as const,
  jay: '0xaE32D159BB3ABFcAdFaBE7aBB461C2AB4805596D'.toLowerCase(),
};

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
    githubHandle: 'jaypb1',
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

const gitPOAPData: Prisma.GitPOAPCreateInput[] = [
  {
    year: 2022,
    poapEventId: 1,
    repo: {
      connect: {
        id: 1,
      },
    },
  },
  {
    year: 2024,
    poapEventId: 2,
    repo: {
      connect: {
        id: 2,
      },
    },
  },
  {
    year: 2015,
    poapEventId: 3,
    repo: {
      connect: {
        id: 3,
      },
    },
  },
];

const claimData: Prisma.ClaimCreateInput[] = [
  /* GitPOAP 1 */
  ClaimFactory.createClaim(1, 1, ClaimStatus.CLAIMED, addresses.test1, 'thunderdome'),
  ClaimFactory.createClaim(1, 3, ClaimStatus.CLAIMED, addresses.jay, '4068606'),
  /* GitPOAP 2 */
  ClaimFactory.createClaim(2, 1, ClaimStatus.CLAIMED, addresses.test1, 'ethdenver'),
  ClaimFactory.createClaim(2, 3, ClaimStatus.CLAIMED, addresses.jay, '4078452'),
  ClaimFactory.createClaim(2, 1),
  /* GitPOAP 3 */
  ClaimFactory.createClaim(3, 3),
  ClaimFactory.createClaim(3, 3, ClaimStatus.CLAIMED, addresses.jay, '4082459'),
];

const profileData: Prisma.ProfileCreateInput[] = [
  {
    address: '0x56d389c4e07a48d429035532402301310b8143a0',
    bio: 'I like brisket.',
  },
  {
    address: '0x89dab21047e6de0e77deee5f4f286d72be50b942',
    bio: 'I like bbq.',
  },
  {
    address: addresses.jay,
    bio: 'I like factorio.',
    name: 'Jay PB',
  },
  {
    address: '0xae95f7e7fb2fcf86148ef832faed2752ae5a358a',
    bio: 'I am addicted to POAPs',
    name: 'Anthony Burzillo',
  },
  {
    address: '0x206e554084beec98e08043397be63c5132cc01a1',
    bio: 'I am not real',
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

  for (const gp of gitPOAPData) {
    const gitPOAP = await prisma.gitPOAP.create({
      data: gp,
    });
    console.log(`Creating GitPOAP with id: ${gitPOAP.id}`);
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
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
