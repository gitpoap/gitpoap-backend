import 'reflect-metadata';
import { PrismaClient } from '@prisma/client';
import { ClaimStatus, GitPOAPStatus } from '@generated/type-graphql';
import {
  ClaimFactory,
  UserFactory,
  OrganizationFactory,
  RepoFactory,
  GitPOAPFactory,
  ProfileFactory,
  FeaturedPOAPFactory,
  RedeemCodeFactory,
} from './factories';

export const prisma = new PrismaClient();

const ADDRESSES = {
  test1: '0xae95f7e7fb2fcf86148ef832faed2752ae5a358a' as const,
  jay: '0xaE32D159BB3ABFcAdFaBE7aBB461C2AB4805596D'.toLowerCase(),
  anthony: '0xAe95f7e7fb2FCF86148ef832FAeD2752Ae5A358a'.toLowerCase(),
  anthony2: '0x206e554084BEeC98e08043397be63C5132Cc01A1'.toLowerCase(),
  colfax: '0x56d389C4E07A48d429035532402301310B8143A0'.toLowerCase(),
  vitalik: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'.toLowerCase(),
  aldo: '0x02738d122e0970aAf8DEADf0c6A217a1923E1e99'.toLowerCase(),
};

const GH_HANDLES = {
  jay: 'jaypb1',
  anthony: 'burz',
  colfax: 'colfax23',
  vitalik: 'vbuterin',
  aldo: 'aldolamb',
};

async function main() {
  console.log('Starting DB seeding...');

  /* Create Users */
  const vitalik = await UserFactory.createUser(1, GH_HANDLES.vitalik);
  const colfax = await UserFactory.createUser(2, GH_HANDLES.colfax);
  const jay = await UserFactory.createUser(8076957, GH_HANDLES.jay);
  const anthony = await UserFactory.createUser(1555326, GH_HANDLES.anthony);
  const aldo = await UserFactory.createUser(16078, GH_HANDLES.aldo);
  const johnz = await UserFactory.createUser(5, 'johnz');
  const anthony2 = await UserFactory.createUser(6, 'burzzzzz');

  /* Create Organizations */
  const org1 = await OrganizationFactory.createOrganization(43, 'org43');
  const org2 = await OrganizationFactory.createOrganization(7, 'seven-heaven');
  const org3 = await OrganizationFactory.createOrganization(34343, 'some-other-org');
  const org4 = await OrganizationFactory.createOrganization(
    1,
    'gitpoap',
    'A recognition platform for recognizing and rewarding your contributors through POAPs.',
    'gitpoap',
    'http://gitpoap.io',
  );
  const org5 = await OrganizationFactory.createOrganization(1555326, 'burz labz');
  const org6 = await OrganizationFactory.createOrganization(81711181, 'stake-house');

  /* Create Repos */
  const gitpoapFeRepo = await RepoFactory.createRepo('gitpoap-fe', 439490658, org4.id); // real id
  const gitpoapBackendRepo = await RepoFactory.createRepo('gitpoap-backend', 416584564, org4.id); // real id
  const repo7 = await RepoFactory.createRepo('repo7', 7, org2.id);
  const repo34 = await RepoFactory.createRepo('repo34', 34, org1.id);
  const repo568 = await RepoFactory.createRepo('repo568', 568, org3.id);
  const repoDopex = await RepoFactory.createRepo('dopex', 127534193, org5.id);
  const repoWagyuInstaller = await RepoFactory.createRepo('wagyu-installer', 336862756, org6.id);
  const gitpoapBotTestRepo = await RepoFactory.createRepo('gitpoap-bot-test-repo', 502133931, org4.id); // real id

  /* Create GitPOAPs */
  const gitpoap1 = await GitPOAPFactory.createGitPOAP(2022, 1, repo34.id, '012345', GitPOAPStatus.APPROVED);
  const gitpoap2 = await GitPOAPFactory.createGitPOAP(2024, 2, repo7.id, '123456', GitPOAPStatus.APPROVED);
  const gitpoap3 = await GitPOAPFactory.createGitPOAP(2015, 3, repo568.id, '234567', GitPOAPStatus.APPROVED);
  // For GitPOAP FE Repo ~ Using generic GitPOAP related POAP for now ~ eventID: 19375
  const gitpoap4 = await GitPOAPFactory.createGitPOAP(2020, 19375, gitpoapFeRepo.id, '345678', GitPOAPStatus.APPROVED);
  // For GitPOAP BE Repo ~ Using GitPOAP Strategy Meeting POAP for now ~ eventID: 29009
  const gitpoap5 = await GitPOAPFactory.createGitPOAP(2020, 29009, gitpoapBackendRepo.id, '456789', GitPOAPStatus.APPROVED);
  // For burz/dopex repo ~ eventID: 34634
  const gitpoap6 = await GitPOAPFactory.createGitPOAP(2022, 34634, repoDopex.id, '304374');

  // For the gitpoaps created for the bug bash -~- March 2022
  const gitpoap7 = await GitPOAPFactory.createGitPOAP(2022, 36568, gitpoapFeRepo.id, '669250', GitPOAPStatus.APPROVED);
  const gitpoap8 = await GitPOAPFactory.createGitPOAP(2022, 36569, gitpoapFeRepo.id, '102513', GitPOAPStatus.APPROVED);
  const gitpoap9 = await GitPOAPFactory.createGitPOAP(2022, 36570, gitpoapBackendRepo.id, '929862', GitPOAPStatus.APPROVED);
  const gitpoap10 = await GitPOAPFactory.createGitPOAP(2022, 36571, gitpoapBackendRepo.id, '252134', GitPOAPStatus.APPROVED);
  const gitpoap11 = await GitPOAPFactory.createGitPOAP(2022, 36572, gitpoapBackendRepo.id, '613740', GitPOAPStatus.APPROVED);
  // Not the real POAP secret!
  const gitpoap12 = await GitPOAPFactory.createGitPOAP(2022, 37428, repoWagyuInstaller.id, '324324', GitPOAPStatus.UNAPPROVED, true);
  const gitpoap13 = await GitPOAPFactory.createGitPOAP(2022, 37429, repoWagyuInstaller.id, '324325', GitPOAPStatus.UNAPPROVED, true, 2, 2);
  const gitpoap14 = await GitPOAPFactory.createGitPOAP(2022, 37430, repoWagyuInstaller.id, '324326', GitPOAPStatus.UNAPPROVED, true, 3, 3);

  /* Add codes */
  await RedeemCodeFactory.addRedeemCodes(['6j8wda', 'tqaq9y', 'd4tdh0', 'o9uorf', 'eeyewe', '09wqld', 'tsl7wt', 'i52wvt', 'mshofb', 'v9cbcd'], gitpoap7.id);
  await RedeemCodeFactory.addRedeemCodes(['7s4dn3', 'q9237f', 'd0e21q', 'qzaj5c', 'ozy2c9', 'p7yqjo', 'cgsevm', 'hou5kq', 'j6sxom', '058qv8'], gitpoap8.id);
  await RedeemCodeFactory.addRedeemCodes(['plw7uf', 'rea9f5', '1etkax', 'l4uulx', '8hnrqa', '2mfo3x', 'me3qfx', 's8znfh', 'gelwgm', 'ebafk6'], gitpoap9.id);
  await RedeemCodeFactory.addRedeemCodes(['492wr5', 'zzxoaa', 'fnc0cn', 'hrir8p', 'v1258v', 'i7lt58', 'erxgdb', 'za5od3', 'v8a1wg', 'uazjii'], gitpoap10.id);
  await RedeemCodeFactory.addRedeemCodes(['hh3zf2', 'ivnnil', 'wylm9j', 'c8i5qj', '8inyd8', 'xyrepl', 'q4564p', 'aienlq', 'ohgtbi', 'qtr3ju'], gitpoap11.id);

  /* Create Claims */
  // GitPOAP 1
  const claim1 = await ClaimFactory.createClaim(gitpoap1.id, vitalik.id, ClaimStatus.CLAIMED, ADDRESSES.test1, 'thunderdome', new Date(2020, 1, 1));
  const claim2 = await ClaimFactory.createClaim(gitpoap1.id, jay.id, ClaimStatus.CLAIMED, ADDRESSES.jay, '4068606', new Date(2020, 1, 2));
  const claim3 = await ClaimFactory.createClaim(gitpoap1.id, johnz.id);

  // GitPOAP 2
  const claim4 = await ClaimFactory.createClaim(gitpoap2.id, vitalik.id, ClaimStatus.CLAIMED, ADDRESSES.test1, 'ethdenver', new Date(2020, 1, 3));
  const claim5 = await ClaimFactory.createClaim(gitpoap2.id, jay.id, ClaimStatus.CLAIMED, ADDRESSES.jay, '4078452', new Date(2020, 1, 4));
  const claim6 = await ClaimFactory.createClaim(gitpoap2.id, anthony.id);
  const claim7 = await ClaimFactory.createClaim(gitpoap2.id, johnz.id);

  // GitPOAP 3
  const claim8 = await ClaimFactory.createClaim(gitpoap3.id, anthony.id);
  const claim9 = await ClaimFactory.createClaim(gitpoap3.id, jay.id, ClaimStatus.CLAIMED, ADDRESSES.jay, '4082459', new Date(2020, 1, 5));
  const claim10 = await ClaimFactory.createClaim(gitpoap3.id, johnz.id);

  // GitPOAP 4 - GitPOAP FE Repo
  const claim11 = await ClaimFactory.createClaim(gitpoap4.id, anthony.id);
  const claim12 = await ClaimFactory.createClaim(gitpoap4.id, colfax.id);
  const claim13 = await ClaimFactory.createClaim(gitpoap4.id, vitalik.id);
  const claim14 = await ClaimFactory.createClaim(gitpoap4.id, jay.id, ClaimStatus.CLAIMED, ADDRESSES.jay, '3217451', new Date(2020, 1, 6));
  const claim15 = await ClaimFactory.createClaim(gitpoap4.id, johnz.id);

  // GitPOAP 5 - GitPOAP BE Repo
  const claim16 = await ClaimFactory.createClaim(gitpoap5.id, anthony.id, ClaimStatus.CLAIMED, ADDRESSES.anthony, '3973554', new Date(2020, 1, 7));
  const claim17 = await ClaimFactory.createClaim(gitpoap5.id, colfax.id, ClaimStatus.CLAIMED, ADDRESSES.colfax, '4126448', new Date(2020, 1, 8));
  const claim18 = await ClaimFactory.createClaim(gitpoap5.id, jay.id);
  const claim19 = await ClaimFactory.createClaim(gitpoap5.id, johnz.id);
  const claim20 = await ClaimFactory.createClaim(gitpoap5.id, vitalik.id);
  const claim21 = await ClaimFactory.createClaim(gitpoap5.id, anthony2.id, ClaimStatus.CLAIMED, ADDRESSES.anthony2, '123456789', new Date(2020, 1, 9));

  // GitPOAPs 7, 8, 9, 10, 11, 12 - GitPOAP BugBash Repos
  const claim7A = await ClaimFactory.createClaim(gitpoap7.id, jay.id);
  const claim7B = await ClaimFactory.createClaim(gitpoap7.id, anthony.id);
  const claim7C = await ClaimFactory.createClaim(gitpoap7.id, colfax.id);
  const claim7D = await ClaimFactory.createClaim(gitpoap7.id, aldo.id);

  const claim8A = await ClaimFactory.createClaim(gitpoap8.id, jay.id);
  const claim8B = await ClaimFactory.createClaim(gitpoap8.id, anthony.id);
  const claim8C = await ClaimFactory.createClaim(gitpoap8.id, colfax.id);
  const claim8D = await ClaimFactory.createClaim(gitpoap8.id, aldo.id);

  const claim9A = await ClaimFactory.createClaim(gitpoap9.id, jay.id);
  const claim9B = await ClaimFactory.createClaim(gitpoap9.id, anthony.id, ClaimStatus.CLAIMED, ADDRESSES.anthony, '1234567891', new Date(2020, 1, 9));
  const claim9C = await ClaimFactory.createClaim(gitpoap9.id, colfax.id, ClaimStatus.CLAIMED, ADDRESSES.colfax, '1234567892', new Date(2020, 1, 9));
  const claim9D = await ClaimFactory.createClaim(gitpoap9.id, aldo.id);

  const claim10A = await ClaimFactory.createClaim(gitpoap10.id, jay.id);
  const claim10B = await ClaimFactory.createClaim(gitpoap10.id, anthony.id);
  const claim10C = await ClaimFactory.createClaim(gitpoap10.id, colfax.id, ClaimStatus.CLAIMED, ADDRESSES.colfax, '1234567893', new Date(2020, 1, 9));
  const claim10D = await ClaimFactory.createClaim(gitpoap10.id, aldo.id);

  const claim11A = await ClaimFactory.createClaim(gitpoap11.id, jay.id);
  const claim11B = await ClaimFactory.createClaim(gitpoap11.id, anthony.id);
  const claim11C = await ClaimFactory.createClaim(gitpoap11.id, colfax.id);
  const claim11D = await ClaimFactory.createClaim(gitpoap11.id, aldo.id);

  /* Create Profiles */
  const profile1 = await ProfileFactory.createProfile(ADDRESSES.colfax, 'I like brisket.');
  const profile2 = await ProfileFactory.createProfile('0x89dab21047e6de0e77deee5f4f286d72be50b942', 'I like bbq.');
  const profileJay = await ProfileFactory.createProfile(ADDRESSES.jay, 'I like factorio.', 'Jay PB', '0xpeebeejay', 'jaypb1', 'https://s.jay.gg');
  const profile4 = await ProfileFactory.createProfile(ADDRESSES.anthony, 'I am addicted to POAPs', 'Anthony Burzillo');
  const profile5 = await ProfileFactory.createProfile(ADDRESSES.anthony2, 'I am not real');
  const profile6 = await ProfileFactory.createProfile(ADDRESSES.vitalik, 'I like unicorns');
  const profile7 = await ProfileFactory.createProfile(ADDRESSES.aldo, 'I like surfing', 'Aldo Lamberti');

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
