import 'reflect-metadata';
import { PrismaClient } from '@prisma/client';
import { ClaimStatus, GitPOAPStatus } from '@generated/type-graphql';
import {
  ClaimFactory,
  FeaturedPOAPFactory,
  GitPOAPFactory,
  OrganizationFactory,
  ProfileFactory,
  ProjectFactory,
  RedeemCodeFactory,
  RepoFactory,
  UserFactory,
} from './factories';
import { DateTime } from 'luxon';
import { ADDRESSES, GH_HANDLES, GH_IDS } from './constants';
import {
  event1,
  event2,
  event3,
  event19375,
  event29009,
  event34634,
  event36568,
  event36569,
  event36570,
  event36571,
  event36572,
  event36573,
  event36574,
  event36575,
  event37428,
  event37429,
  event37430,
} from '../.dockerfiles/fake-poap-api/data';

export const prisma = new PrismaClient();

async function main() {
  console.log('Starting DB seeding...');

  /* Create Users */
  const vitalik = await UserFactory.createUser(1, GH_HANDLES.vitalik);
  const colfax = await UserFactory.createUser(2, GH_HANDLES.colfax);
  const jay = await UserFactory.createUser(GH_IDS.jay, GH_HANDLES.jay);
  const burz = await UserFactory.createUser(GH_IDS.burz, GH_HANDLES.burz);
  const aldo = await UserFactory.createUser(GH_IDS.aldo, GH_HANDLES.aldo);
  const tyler = await UserFactory.createUser(GH_IDS.tyler, GH_HANDLES.tyler);
  const burz2 = await UserFactory.createUser(6, 'burzzzzz');

  /* Create Projects */
  const frontendProject = await ProjectFactory.createProject();
  const backendProject = await ProjectFactory.createProject();
  const repo7Project = await ProjectFactory.createProject();
  const repo34Project = await ProjectFactory.createProject();
  const repo568Project = await ProjectFactory.createProject();
  const dopexProject = await ProjectFactory.createProject();
  const wagyuInstallerProject = await ProjectFactory.createProject();
  const botTestProject = await ProjectFactory.createProject();

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
  const org5 = await OrganizationFactory.createOrganization(GH_IDS.burz, 'burz');
  const org6 = await OrganizationFactory.createOrganization(81711181, 'stake-house');

  /* Create Repos */
  const gitpoapFeRepo = await RepoFactory.createRepo('gitpoap-fe', 439490658, org4.id, frontendProject.id); // real id
  const gitpoapBackendRepo = await RepoFactory.createRepo('gitpoap-backend', 416584564, org4.id, backendProject.id); // real id
  const repo7 = await RepoFactory.createRepo('repo7', 7, org2.id, repo7Project.id);
  const repo34 = await RepoFactory.createRepo('repo34', 34, org1.id, repo34Project.id);
  const repo568 = await RepoFactory.createRepo('repo568', 568, org3.id, repo568Project.id);
  const repoDopex = await RepoFactory.createRepo('dopex', 127534193, org5.id, dopexProject.id);
  const repoWagyuInstaller = await RepoFactory.createRepo('wagyu-installer', 336862756, org6.id, wagyuInstallerProject.id);
  const gitpoapBotTestRepo = await RepoFactory.createRepo('gitpoap-bot-test-repo', 502133931, org4.id, botTestProject.id); // real id

  /* Create GitPOAPs */
  const gitpoap1 = await GitPOAPFactory.createGitPOAPFromEvent(repo34Project.id, event1, GitPOAPStatus.APPROVED);
  const gitpoap2 = await GitPOAPFactory.createGitPOAPFromEvent(repo7Project.id, event2, GitPOAPStatus.APPROVED);
  const gitpoap3 = await GitPOAPFactory.createGitPOAPFromEvent(repo568Project.id, event3, GitPOAPStatus.APPROVED);
  // For GitPOAP FE Repo ~ Using generic GitPOAP related POAP for now ~ eventID: 19375
  const gitpoap4 = await GitPOAPFactory.createGitPOAPFromEvent(frontendProject.id, event19375, GitPOAPStatus.APPROVED);
  // For GitPOAP BE Repo ~ Using GitPOAP Strategy Meeting POAP for now ~ eventID: 29009
  const gitpoap5 = await GitPOAPFactory.createGitPOAPFromEvent(backendProject.id, event29009, GitPOAPStatus.APPROVED);
  // For burz/dopex repo ~ eventID: 34634
  const gitpoap6 = await GitPOAPFactory.createGitPOAPFromEvent(dopexProject.id, event34634);

  // For the gitpoaps created for the bug bash -~- March 2022
  const gitpoap7 = await GitPOAPFactory.createGitPOAPFromEvent(frontendProject.id, event36568, GitPOAPStatus.APPROVED);
  const gitpoap8 = await GitPOAPFactory.createGitPOAPFromEvent(frontendProject.id, event36569, GitPOAPStatus.APPROVED, false, 2, 2);
  const gitpoap9 = await GitPOAPFactory.createGitPOAPFromEvent(backendProject.id, event36570, GitPOAPStatus.APPROVED);
  const gitpoap10 = await GitPOAPFactory.createGitPOAPFromEvent(backendProject.id, event36571, GitPOAPStatus.APPROVED, false, 2, 2);
  const gitpoap11 = await GitPOAPFactory.createGitPOAPFromEvent(backendProject.id, event36572, GitPOAPStatus.APPROVED, false, 3, 3);
  // Not the real POAP secret!
  const gitpoap12 = await GitPOAPFactory.createGitPOAPFromEvent(wagyuInstallerProject.id, event37428, GitPOAPStatus.UNAPPROVED, true);
  const gitpoap13 = await GitPOAPFactory.createGitPOAPFromEvent(wagyuInstallerProject.id, event37429, GitPOAPStatus.UNAPPROVED, true, 2, 2);
  const gitpoap14 = await GitPOAPFactory.createGitPOAPFromEvent(wagyuInstallerProject.id, event37430, GitPOAPStatus.UNAPPROVED, true, 3, 3);

  // For gitpoap-bot-test-repo (uses random POAP IDs)
  const gitpoap15 = await GitPOAPFactory.createGitPOAPFromEvent(botTestProject.id, event36573, GitPOAPStatus.APPROVED, true);
  const gitpoap16 = await GitPOAPFactory.createGitPOAPFromEvent(botTestProject.id, event36574, GitPOAPStatus.APPROVED, true, 2, 2);
  // Add one that is NOT enabled
  const gitpoap17 = await GitPOAPFactory.createGitPOAPFromEvent(botTestProject.id, event36575, GitPOAPStatus.APPROVED, true, 3, 3, false);

  /* Add codes */
  await RedeemCodeFactory.addRedeemCodes(['6j8wda', 'tqaq9y', 'd4tdh0', 'o9uorf', 'eeyewe', '09wqld', 'tsl7wt', 'i52wvt', 'mshofb', 'v9cbcd'], gitpoap7.id);
  await RedeemCodeFactory.addRedeemCodes(['7s4dn3', 'q9237f', 'd0e21q', 'qzaj5c', 'ozy2c9', 'p7yqjo', 'cgsevm', 'hou5kq', 'j6sxom', '058qv8'], gitpoap8.id);
  await RedeemCodeFactory.addRedeemCodes(['plw7uf', 'rea9f5', '1etkax', 'l4uulx', '8hnrqa', '2mfo3x', 'me3qfx', 's8znfh', 'gelwgm', 'ebafk6'], gitpoap9.id);
  await RedeemCodeFactory.addRedeemCodes(['492wr5', 'zzxoaa', 'fnc0cn', 'hrir8p', 'v1258v', 'i7lt58', 'erxgdb', 'za5od3', 'v8a1wg', 'uazjii'], gitpoap10.id);
  await RedeemCodeFactory.addRedeemCodes(['hh3zf2', 'ivnnil', 'wylm9j', 'c8i5qj', '8inyd8', 'xyrepl', 'q4564p', 'aienlq', 'ohgtbi', 'qtr3ju'], gitpoap11.id);

  /* Create Claims */
  // GitPOAP 1
  const claim1 = await ClaimFactory.createClaim(gitpoap1.id, vitalik.id, ClaimStatus.CLAIMED, ADDRESSES.test1, 'thunderdome', DateTime.utc(2020, 1, 1).toJSDate());
  const claim2 = await ClaimFactory.createClaim(gitpoap1.id, jay.id, ClaimStatus.CLAIMED, ADDRESSES.jay, '4068606', DateTime.utc(2020, 1, 2).toJSDate());
  const claim3 = await ClaimFactory.createClaim(gitpoap1.id, tyler.id);

  // GitPOAP 2
  const claim4 = await ClaimFactory.createClaim(gitpoap2.id, vitalik.id, ClaimStatus.CLAIMED, ADDRESSES.test1, 'ethdenver', DateTime.utc(2020, 1, 3).toJSDate());
  const claim5 = await ClaimFactory.createClaim(gitpoap2.id, jay.id, ClaimStatus.CLAIMED, ADDRESSES.jay, '4078452', DateTime.utc(2020, 1, 4).toJSDate());
  const claim6 = await ClaimFactory.createClaim(gitpoap2.id, burz.id);
  const claim7 = await ClaimFactory.createClaim(gitpoap2.id, tyler.id);

  // GitPOAP 3
  const claim8 = await ClaimFactory.createClaim(gitpoap3.id, burz.id, ClaimStatus.CLAIMED, ADDRESSES.burz, 'pizza-pie', DateTime.utc(2022, 4, 5).toJSDate());
  const claim9 = await ClaimFactory.createClaim(gitpoap3.id, jay.id, ClaimStatus.CLAIMED, ADDRESSES.jay, '4082459', DateTime.utc(2020, 1, 5).toJSDate());
  const claim10 = await ClaimFactory.createClaim(gitpoap3.id, tyler.id);

  // GitPOAP 4 - GitPOAP FE Repo
  const claim11 = await ClaimFactory.createClaim(gitpoap4.id, burz.id);
  const claim12 = await ClaimFactory.createClaim(gitpoap4.id, colfax.id);
  const claim13 = await ClaimFactory.createClaim(gitpoap4.id, vitalik.id);
  const claim14 = await ClaimFactory.createClaim(gitpoap4.id, jay.id, ClaimStatus.CLAIMED, ADDRESSES.jay, '3217451', DateTime.utc(2020, 1, 6).toJSDate());
  const claim15 = await ClaimFactory.createClaim(gitpoap4.id, tyler.id);

  // GitPOAP 5 - GitPOAP BE Repo
  const claim16 = await ClaimFactory.createClaim(gitpoap5.id, burz.id, ClaimStatus.CLAIMED, ADDRESSES.burz, '3973554', DateTime.utc(2020, 1, 7).toJSDate());
  const claim17 = await ClaimFactory.createClaim(gitpoap5.id, colfax.id, ClaimStatus.CLAIMED, ADDRESSES.colfax, '4126448', DateTime.utc(2020, 1, 8).toJSDate());
  const claim18 = await ClaimFactory.createClaim(gitpoap5.id, jay.id);
  const claim19 = await ClaimFactory.createClaim(gitpoap5.id, tyler.id);
  const claim20 = await ClaimFactory.createClaim(gitpoap5.id, vitalik.id);
  const claim21 = await ClaimFactory.createClaim(gitpoap5.id, burz2.id, ClaimStatus.CLAIMED, ADDRESSES.burz2, '123456789', DateTime.utc(2020, 1, 9).toJSDate());

  // GitPOAPs 7, 8, 9, 10, 11, 12 - GitPOAP BugBash Repos
  const claim7A = await ClaimFactory.createClaim(gitpoap7.id, jay.id);
  const claim7B = await ClaimFactory.createClaim(gitpoap7.id, burz.id);
  const claim7C = await ClaimFactory.createClaim(gitpoap7.id, colfax.id);
  const claim7D = await ClaimFactory.createClaim(gitpoap7.id, aldo.id);

  const claim8A = await ClaimFactory.createClaim(gitpoap8.id, jay.id);
  const claim8B = await ClaimFactory.createClaim(gitpoap8.id, burz.id);
  const claim8C = await ClaimFactory.createClaim(gitpoap8.id, colfax.id);
  const claim8D = await ClaimFactory.createClaim(gitpoap8.id, aldo.id);

  const claim9A = await ClaimFactory.createClaim(gitpoap9.id, jay.id);
  const claim9B = await ClaimFactory.createClaim(gitpoap9.id, burz.id, ClaimStatus.CLAIMED, ADDRESSES.burz, '1234567891', DateTime.utc(2020, 1, 9).toJSDate());
  const claim9C = await ClaimFactory.createClaim(gitpoap9.id, colfax.id, ClaimStatus.CLAIMED, ADDRESSES.colfax, '1234567892', DateTime.utc(2020, 1, 9).toJSDate());
  const claim9D = await ClaimFactory.createClaim(gitpoap9.id, aldo.id);

  const claim10A = await ClaimFactory.createClaim(gitpoap10.id, jay.id);
  const claim10B = await ClaimFactory.createClaim(gitpoap10.id, burz.id);
  const claim10C = await ClaimFactory.createClaim(gitpoap10.id, colfax.id, ClaimStatus.CLAIMED, ADDRESSES.colfax, '1234567893', DateTime.utc(2020, 1, 9).toJSDate());
  const claim10D = await ClaimFactory.createClaim(gitpoap10.id, aldo.id);

  const claim11A = await ClaimFactory.createClaim(gitpoap11.id, jay.id);
  const claim11B = await ClaimFactory.createClaim(gitpoap11.id, burz.id);
  const claim11C = await ClaimFactory.createClaim(gitpoap11.id, colfax.id);
  const claim11D = await ClaimFactory.createClaim(gitpoap11.id, aldo.id, ClaimStatus.CLAIMED, ADDRESSES.aldo, '1234567894', DateTime.utc().minus({ days: 2 }).toJSDate());

  /* Create Profiles */
  const profile1 = await ProfileFactory.createProfile(ADDRESSES.colfax, 'I like brisket.');
  const profile2 = await ProfileFactory.createProfile('0x89dab21047e6de0e77deee5f4f286d72be50b942', 'I like bbq.');
  const profileJay = await ProfileFactory.createProfile(ADDRESSES.jay, 'I like factorio.', 'Jay PB', '0xpeebeejay', 'jaypb1', 'https://s.jay.gg');
  const profile4 = await ProfileFactory.createProfile(ADDRESSES.burz, 'I am addicted to POAPs', 'Anna Burzillo');
  const profile5 = await ProfileFactory.createProfile(ADDRESSES.burz2, 'I am not real');
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
