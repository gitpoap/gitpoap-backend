import 'reflect-metadata';
import { PrismaClient } from '@prisma/client';
import { ClaimStatus } from '@generated/type-graphql';
import {
  ClaimFactory,
  UserFactory,
  OrganizationFactory,
  RepoFactory,
  GitPOAPFactory,
  ProfileFactory,
  FeaturedPOAPFactory,
} from './factories';

export const prisma = new PrismaClient();

const ADDRESSES = {
  test1: '0xae95f7e7fb2fcf86148ef832faed2752ae5a358a' as const,
  jay: '0xaE32D159BB3ABFcAdFaBE7aBB461C2AB4805596D'.toLowerCase(),
  anthony: '0xAe95f7e7fb2FCF86148ef832FAeD2752Ae5A358a'.toLowerCase(),
  anthony2: '0x206e554084BEeC98e08043397be63C5132Cc01A1'.toLowerCase(),
  colfax: '0x56d389C4E07A48d429035532402301310B8143A0'.toLowerCase(),
  vitalik: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'.toLowerCase(),
};

const GH_HANDLES = {
  jay: 'jaypb1',
  anthony: 'burz',
  colfax: 'colfax23',
  vitalik: 'vbuterin',
};

async function main() {
  console.log('Starting DB seeding...');

  /* Create Users */
  const vitalik = await UserFactory.createUser(1, GH_HANDLES.vitalik);
  const colfax = await UserFactory.createUser(2, GH_HANDLES.colfax);
  const jay = await UserFactory.createUser(8076957, GH_HANDLES.jay);
  const anthony = await UserFactory.createUser(1555326, GH_HANDLES.anthony);
  const johnz = await UserFactory.createUser(5, 'johnz');
  const anthony2 = await UserFactory.createUser(6, 'burzzzzz');

  /* Create Organizations */
  const org1 = await OrganizationFactory.createOrganization(43, 'org43');
  const org2 = await OrganizationFactory.createOrganization(7, 'seven-heaven');
  const org3 = await OrganizationFactory.createOrganization(34343, 'some-other-org');
  const org4 = await OrganizationFactory.createOrganization(
    1,
    'gitpoap',
    'An open source and non-custodial liquidity protocol for earning interest on deposits and borrowing assets.',
    'gitpoap',
    'http://gitpoap.io',
  );
  const org5 = await OrganizationFactory.createOrganization(1555326, 'burz');

  /* Create Repos */
  const repo1 = await RepoFactory.createRepo('GitPOAP Frontend', 1, org4.id);
  const repo2 = await RepoFactory.createRepo('GitPOAP Backend', 2, org4.id);
  const repo7 = await RepoFactory.createRepo('repo7', 7, org2.id);
  const repo34 = await RepoFactory.createRepo('repo34', 34, org1.id);
  const repo568 = await RepoFactory.createRepo('repo568', 568, org3.id);
  const repoDopex = await RepoFactory.createRepo('dopex', 127534193, org5.id);

  /* Create GitPOAPs */
  const gitpoap1 = await GitPOAPFactory.createGitPOAP(2022, 1, repo34.id, '012345', true);
  const gitpoap2 = await GitPOAPFactory.createGitPOAP(2024, 2, repo7.id, '123456', true);
  const gitpoap3 = await GitPOAPFactory.createGitPOAP(2015, 3, repo568.id, '234567', true);
  // For GitPOAP FE Repo ~ Using generic GitPOAP related POAP for now ~ eventID: 19375
  const gitpoap4 = await GitPOAPFactory.createGitPOAP(2020, 19375, repo1.id, '345678', true);
  // For GitPOAP BE Repo ~ Using GitPOAP Strategy Meeting POAP for now ~ eventID: 29009
  const gitpoap5 = await GitPOAPFactory.createGitPOAP(2020, 29009, repo2.id, '456789', true);
  // For burz/dopex repo ~ eventID: 34634
  const gitpoap6 = await GitPOAPFactory.createGitPOAP(2022, 34634, repoDopex.id, '304374');

  /* Create Claims */
  // GitPOAP 1
  const claim1 = await ClaimFactory.createClaim(gitpoap1.id, vitalik.id, ClaimStatus.CLAIMED, ADDRESSES.test1, 'thunderdome');
  const claim2 = await ClaimFactory.createClaim(gitpoap1.id, jay.id, ClaimStatus.CLAIMED, ADDRESSES.jay, '4068606');
  const claim3 = await ClaimFactory.createClaim(gitpoap1.id, johnz.id);

  // GitPOAP 2
  const claim4 = await ClaimFactory.createClaim(gitpoap2.id, vitalik.id, ClaimStatus.CLAIMED, ADDRESSES.test1, 'ethdenver');
  const claim5 = await ClaimFactory.createClaim(gitpoap2.id, jay.id, ClaimStatus.CLAIMED, ADDRESSES.jay, '4078452');
  const claim6 = await ClaimFactory.createClaim(gitpoap2.id, anthony.id);
  const claim7 = await ClaimFactory.createClaim(gitpoap2.id, johnz.id);

  // GitPOAP 3
  const claim8 = await ClaimFactory.createClaim(gitpoap3.id, anthony.id);
  const claim9 = await ClaimFactory.createClaim(gitpoap3.id, jay.id, ClaimStatus.CLAIMED, ADDRESSES.jay, '4082459');
  const claim10 = await ClaimFactory.createClaim(gitpoap3.id, johnz.id);

  // GitPOAP 4 - GitPOAP FE Repo
  const claim11 = await ClaimFactory.createClaim(gitpoap4.id, anthony.id);
  const claim12 = await ClaimFactory.createClaim(gitpoap4.id, colfax.id);
  const claim13 = await ClaimFactory.createClaim(gitpoap4.id, vitalik.id);
  const claim14 = await ClaimFactory.createClaim(gitpoap4.id, jay.id, ClaimStatus.CLAIMED, ADDRESSES.jay, '3217451');
  const claim15 = await ClaimFactory.createClaim(gitpoap4.id, johnz.id);

  // GitPOAP 5 - GitPOAP BE Repo
  const claim16 = await ClaimFactory.createClaim(gitpoap5.id, anthony.id, ClaimStatus.CLAIMED, ADDRESSES.anthony, '3973554');
  const claim17 = await ClaimFactory.createClaim(gitpoap5.id, colfax.id, ClaimStatus.CLAIMED, ADDRESSES.colfax, '4126448');
  const claim18 = await ClaimFactory.createClaim(gitpoap5.id, jay.id);
  const claim19 = await ClaimFactory.createClaim(gitpoap5.id, johnz.id);
  const claim20 = await ClaimFactory.createClaim(gitpoap5.id, vitalik.id);
  const claim21 = await ClaimFactory.createClaim(gitpoap5.id, anthony2.id, ClaimStatus.CLAIMED, ADDRESSES.anthony2, '123456789');

  /* Create Profiles */
  const profile1 = await ProfileFactory.createProfile(ADDRESSES.colfax, 'I like brisket.');
  const profile2 = await ProfileFactory.createProfile('0x89dab21047e6de0e77deee5f4f286d72be50b942', 'I like bbq.');
  const profileJay = await ProfileFactory.createProfile(ADDRESSES.jay, 'I like factorio.', 'Jay PB', '0xpeebeejay', 'https://s.jay.gg');
  const profile4 = await ProfileFactory.createProfile(ADDRESSES.anthony, 'I am addicted to POAPs', 'Anthony Burzillo');
  const profile5 = await ProfileFactory.createProfile(ADDRESSES.anthony2, 'I am not real');
  const profile6 = await ProfileFactory.createProfile(ADDRESSES.vitalik, 'I like unicorns');

  /* Create Featured POAPs */
  const featured1 = await FeaturedPOAPFactory.createFeaturedPOAP(claim14.poapTokenId!, profileJay.id); // Featured GitPOAP
  const featured2 = await FeaturedPOAPFactory.createFeaturedPOAP(claim9.poapTokenId!, profileJay.id); // Featured GitPOAP
  const featured3 = await FeaturedPOAPFactory.createFeaturedPOAP('3976027', profileJay.id); // Featured Classic POAP - Bangia Night

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
