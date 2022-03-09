import 'reflect-metadata';
import { PrismaClient } from '@prisma/client';
import { ClaimStatus } from '@generated/type-graphql';
import { ClaimFactory, UserFactory, OrganizationFactory, RepoFactory, GitPOAPFactory, ProfileFactory } from './factories';

export const prisma = new PrismaClient();

const ADDRESSES = {
  test1: '0xae95f7e7fb2fcf86148ef832faed2752ae5a358a' as const,
  jay: '0xaE32D159BB3ABFcAdFaBE7aBB461C2AB4805596D'.toLowerCase(),
};

async function main() {
  console.log('Starting DB seeding...');

  /* Create Users */
  const user1 = await UserFactory.createUser(1, 'vitalikb', 'test.oauth.1');
  const user2 = await UserFactory.createUser(2, 'colfaxs', 'test.oauth.2');
  const user3 = await UserFactory.createUser(3, 'jaypb1', 'test.oauth.3');
  const user4 = await UserFactory.createUser(4, 'anthonyb', 'test.oauth.4');
  const user5 = await UserFactory.createUser(5, 'johnz', 'test.oauth.5');

  /* Create Organizations */
  const org1 = await OrganizationFactory.createOrganization(43, 'org43');
  const org2 = await OrganizationFactory.createOrganization(7, 'seven-heaven');
  const org3 = await OrganizationFactory.createOrganization(34343, 'some-other-org');

  /* Create Repos */
  const repo34 = await RepoFactory.createRepo('repo34', 34, org1.id);
  const repo7 = await RepoFactory.createRepo('repo7', 7, org2.id);
  const repo568 = await RepoFactory.createRepo('repo568', 568, org3.id);

  /* Create GitPOAPs */
  const gitpoap1 = await GitPOAPFactory.createGitPOAP(2022, 1, repo34.id, 'secret1', 'hash-browns-1');
  const gitpoap2 = await GitPOAPFactory.createGitPOAP(2024, 2, repo7.id, 'secret2', 'hash-browns-2');
  const gitpoap3 = await GitPOAPFactory.createGitPOAP(2015, 3, repo568.id, 'secret3', 'hash-browns-3');

  /* Create Claims */
  // GitPOAP 1
  const claim1 = await ClaimFactory.createClaim(gitpoap1.id, user1.id, ClaimStatus.CLAIMED, ADDRESSES.test1, 'thunderdome');
  const claim2 = await ClaimFactory.createClaim(gitpoap1.id, user3.id, ClaimStatus.CLAIMED, ADDRESSES.jay, '4068606');

  // GitPOAP 2
  const claim3 = await ClaimFactory.createClaim(gitpoap2.id, user1.id, ClaimStatus.CLAIMED, ADDRESSES.test1, 'ethdenver');
  const claim4 = await ClaimFactory.createClaim(gitpoap2.id, user3.id, ClaimStatus.CLAIMED, ADDRESSES.jay, '4078452');
  const claim5 = await ClaimFactory.createClaim(gitpoap2.id, user1.id);
  // GitPOAP 3
  const claim6 = await ClaimFactory.createClaim(gitpoap3.id, user3.id);
  const claim7 = await ClaimFactory.createClaim(gitpoap3.id, user3.id, ClaimStatus.CLAIMED, ADDRESSES.jay, '4082459');

  /* Create Profiles */
  const profile1 = ProfileFactory.createProfile('0x56d389c4e07a48d429035532402301310b8143a0', 'I like brisket.');
  const profile2 = ProfileFactory.createProfile('0x89dab21047e6de0e77deee5f4f286d72be50b942', 'I like bbq.');
  const profile3 = ProfileFactory.createProfile(ADDRESSES.jay, 'I like factorio.', 'Jay PB');
  const profile4 = ProfileFactory.createProfile('0xae95f7e7fb2fcf86148ef832faed2752ae5a358a', 'I am addicted to POAPs', 'Anthony Burzillo');
  const profile5 = ProfileFactory.createProfile('0x206e554084beec98e08043397be63c5132cc01a1', 'I am not real');

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
