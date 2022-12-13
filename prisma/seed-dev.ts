/*
 * This file is used to seed your development database & can be freely edited without risk of breaking
 * integration tests.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import 'reflect-metadata';
import { ClaimStatus, GitPOAPStatus, MembershipRole, MembershipAcceptanceStatus } from '@generated/type-graphql';
import { faker } from '@faker-js/faker';
import {
  AddressFactory,
  ClaimFactory,
  EmailFactory,
  FeaturedPOAPFactory,
  GitPOAPFactory,
  GitPOAPRequestFactory,
  GithubUserFactory,
  GithubOrganizationFactory,
  ProfileFactory,
  ProjectFactory,
  RedeemCodeFactory,
  RepoFactory,
  TeamFactory,
  MembershipFactory,
} from './factories';
import { DateTime } from 'luxon';
import { ADDRESSES, GH_HANDLES, GH_IDS } from './constants';
import { TEAM_EMAIL } from '../src/constants';

import * as data from './data';
import { StaffApprovalStatus, GitPOAPType } from '@prisma/client';
import { getS3URL } from '../src/external/s3';
import { context } from '../src/context';

export const seed = async () => {
  console.log('Starting DB seeding...');

  /* Create Users */
  const vitalik = await GithubUserFactory.create(1, GH_HANDLES.vitalik);
  const colfax = await GithubUserFactory.create(2, GH_HANDLES.colfax);
  const jay = await GithubUserFactory.create(GH_IDS.jay, GH_HANDLES.jay);
  const burz = await GithubUserFactory.create(GH_IDS.burz, GH_HANDLES.burz);
  const aldo = await GithubUserFactory.create(GH_IDS.aldo, GH_HANDLES.aldo);
  const tyler = await GithubUserFactory.create(GH_IDS.tyler, GH_HANDLES.tyler);
  const burz2 = await GithubUserFactory.create(6, 'burzzzzz');
  const kayleen = await GithubUserFactory.create(GH_IDS.kayleen, GH_HANDLES.kayleen);

  /* Create email addresses */
  const teamEmail = await EmailFactory.create(TEAM_EMAIL);
  const jayEmail = await EmailFactory.create('jay@gitpoap.io');
  const unvalidatedEmail = await EmailFactory.create('unvalidated@gitpoap.io', undefined, 'testtoken1', false, DateTime.now().plus({ day: 1 }).toJSDate());
  const expiredEmail = await EmailFactory.create('expired@gitpoap.io', undefined, 'testtoken2', false, DateTime.now().minus({ day: 1 }).toJSDate());
  const validatedEmail = await EmailFactory.create('validated@gitpoap.io', undefined, 'testtoken3', true, DateTime.now().minus({ day: 1 }).toJSDate());

  /* Create Address */
  const addressJay = await AddressFactory.create(ADDRESSES.jay, jay.id);
  const addressBurz = await AddressFactory.create(ADDRESSES.burz, burz.id);
  const addressBurz2 = await AddressFactory.create(ADDRESSES.burz2, burz2.id);
  const addressColfax = await AddressFactory.create(ADDRESSES.colfax, colfax.id);
  const addressVitalik = await AddressFactory.create(ADDRESSES.vitalik, vitalik.id);
  const addressAldo = await AddressFactory.create(ADDRESSES.aldo, aldo.id);
  const addressTyler = await AddressFactory.create(ADDRESSES.tyler, tyler.id);
  const addressKayleen = await AddressFactory.create(ADDRESSES.kayleen, kayleen.id);
  const addressRandom1 = await AddressFactory.create(ADDRESSES.random, undefined, teamEmail.id);
  const addressRandom2 = await AddressFactory.create(ADDRESSES.random2);

  /* Create Projects */
  const frontendProject = await ProjectFactory.create();
  const backendProject = await ProjectFactory.create();
  const repo7Project = await ProjectFactory.create();
  const repo34Project = await ProjectFactory.create();
  const repo568Project = await ProjectFactory.create();
  const dopexProject = await ProjectFactory.create();
  const wagyuInstallerProject = await ProjectFactory.create();
  const botTestProject = await ProjectFactory.create();
  const closestCitibikeProject = await ProjectFactory.create();
  const handcuffsProject = await ProjectFactory.create();

  /* Create Github Organizations */
  const org1 = await GithubOrganizationFactory.create(43, 'org43');
  const org2 = await GithubOrganizationFactory.create(7, 'seven-heaven');
  const org3 = await GithubOrganizationFactory.create(34343, 'some-other-org');
  const org4 = await GithubOrganizationFactory.create(1, 'gitpoap');
  const org5 = await GithubOrganizationFactory.create(GH_IDS.burz, 'burz'); // real user
  const org6 = await GithubOrganizationFactory.create(81711181, 'stake-house'); // real org
  const org7 = await GithubOrganizationFactory.create(GH_IDS.jay, 'peebeejay'); // real user

  /* Create Repos */
  const gitpoapFeRepo = await RepoFactory.create('gitpoap-fe', 439490658, org4.id, frontendProject.id); // real id
  const gitpoapBackendRepo = await RepoFactory.create('gitpoap-backend', 416584564, org4.id, backendProject.id); // real id
  const repo7 = await RepoFactory.create('repo7', 7, org2.id, repo7Project.id);
  const repo34 = await RepoFactory.create('repo34', 34, org1.id, repo34Project.id);
  const repo568 = await RepoFactory.create('repo568', 568, org3.id, repo568Project.id);
  const repoDopex = await RepoFactory.create('dopex', 127534193, org5.id, dopexProject.id);
  const repoWagyuInstaller = await RepoFactory.create('wagyu-installer', 336862756, org6.id, wagyuInstallerProject.id);
  const gitpoapBotTestRepo = await RepoFactory.create('gitpoap-bot-test-repo', 502133931, org4.id, botTestProject.id); // real id
  const closestCitibikeRepo = await RepoFactory.create('ClosestCitibike', 59921252, org7.id, closestCitibikeProject.id); // real id
  const handcuffsDashboardRepo = await RepoFactory.create('handcuffs-dash', 343218993, org7.id, handcuffsProject.id); // real id

  /* Create GitPOAPs */
  const gitpoap1 = await GitPOAPFactory.createFromEvent(repo34Project.id, data.event1, GitPOAPStatus.APPROVED);
  const gitpoap2 = await GitPOAPFactory.createFromEvent(repo7Project.id, data.event2, GitPOAPStatus.APPROVED);
  const gitpoap3 = await GitPOAPFactory.createFromEvent(repo568Project.id, data.event3, GitPOAPStatus.APPROVED);
  // For GitPOAP FE Repo ~ Using generic GitPOAP related POAP for now ~ eventID: 19375
  const gitpoap4 = await GitPOAPFactory.createFromEvent(frontendProject.id, data.event19375, GitPOAPStatus.APPROVED);
  // For GitPOAP BE Repo ~ Using GitPOAP Strategy Meeting POAP for now ~ eventID: 29009
  const gitpoap5 = await GitPOAPFactory.createFromEvent(backendProject.id, data.event29009, GitPOAPStatus.APPROVED);
  // For burz/dopex repo ~ eventID: 34634
  const gitpoap6 = await GitPOAPFactory.createFromEvent(dopexProject.id, data.event34634);

  // For the gitpoaps created for the bug bash -~- March 2022
  const gitpoap7 = await GitPOAPFactory.createFromEvent(frontendProject.id, data.event36568, GitPOAPStatus.APPROVED);
  const gitpoap8 = await GitPOAPFactory.createFromEvent(frontendProject.id, data.event36569, GitPOAPStatus.APPROVED, false, 2, 2);
  const gitpoap9 = await GitPOAPFactory.createFromEvent(backendProject.id, data.event36570, GitPOAPStatus.APPROVED);
  const gitpoap10 = await GitPOAPFactory.createFromEvent(backendProject.id, data.event36571, GitPOAPStatus.APPROVED, false, 2, 2);
  const gitpoap11 = await GitPOAPFactory.createFromEvent(backendProject.id, data.event36572, GitPOAPStatus.APPROVED, false, 3, 3);
  // Not the real POAP secret!
  const gitpoap12 = await GitPOAPFactory.createFromEvent(wagyuInstallerProject.id, data.event37428, GitPOAPStatus.UNAPPROVED, true);
  const gitpoap13 = await GitPOAPFactory.createFromEvent(wagyuInstallerProject.id, data.event37429, GitPOAPStatus.UNAPPROVED, true, 2, 2);
  const gitpoap14 = await GitPOAPFactory.createFromEvent(wagyuInstallerProject.id, data.event37430, GitPOAPStatus.UNAPPROVED, true, 3, 3);

  // For gitpoap-bot-test-repo (uses random POAP IDs)
  const gitpoap15 = await GitPOAPFactory.createFromEvent(botTestProject.id, data.event36573, GitPOAPStatus.APPROVED, true);
  const gitpoap16 = await GitPOAPFactory.createFromEvent(botTestProject.id, data.event36574, GitPOAPStatus.APPROVED, true, 2, 2);
  // Add one that is NOT enabled
  const gitpoap17 = await GitPOAPFactory.createFromEvent(botTestProject.id, data.event36575, GitPOAPStatus.APPROVED, true, 3, 3, false);
  // Add one that is deprecated
  const gitpoap18 = await GitPOAPFactory.createFromEvent(botTestProject.id, data.event36576, GitPOAPStatus.DEPRECATED);

  // Add GitPOAPs for closestCitibike repo
  const gitpoap19 = await GitPOAPFactory.createFromEvent(closestCitibikeProject.id, data.event71781, GitPOAPStatus.APPROVED, true);
  const gitpoap20 = await GitPOAPFactory.createFromEvent(closestCitibikeProject.id, data.event71783, GitPOAPStatus.APPROVED, true);
  const gitpoap21 = await GitPOAPFactory.createFromEvent(closestCitibikeProject.id, data.event71784, GitPOAPStatus.APPROVED, true);

  // Add GitPOAPs for yearn repo - but use for peebeejay/handcuffs-dash
  const gitpoap22 = await GitPOAPFactory.createFromEvent(handcuffsProject.id, data.event54112, GitPOAPStatus.APPROVED, true);
  const gitpoap23 = await GitPOAPFactory.createFromEvent(handcuffsProject.id, data.event54113, GitPOAPStatus.APPROVED, true);
  const gitpoap24 = await GitPOAPFactory.createFromEvent(handcuffsProject.id, data.event54114, GitPOAPStatus.APPROVED, true);

  // Create CUSTOM GitPOAPs
  const gitpoap25 = await GitPOAPFactory.createFromEvent(
    frontendProject.id,
    data.event67501,
    GitPOAPStatus.APPROVED,
    true,
    undefined,
    undefined,
    true,
    GitPOAPType.CUSTOM,
    addressAldo.id,
  );
  const gitpoap26 = await GitPOAPFactory.createFromEvent(
    frontendProject.id,
    data.event43356,
    GitPOAPStatus.APPROVED,
    true,
    undefined,
    undefined,
    true,
    GitPOAPType.CUSTOM,
    addressBurz.id,
  );
  const gitpoap27 = await GitPOAPFactory.createFromEvent(
    backendProject.id,
    data.event60695,
    GitPOAPStatus.APPROVED,
    true,
    undefined,
    undefined,
    true,
    GitPOAPType.CUSTOM,
    addressJay.id,
  );

  /* Add codes */
  const allGitPOAPs = await context.prisma.gitPOAP.findMany();
  for (const gitpoap of allGitPOAPs) {
    const codes = Array.from({ length: 20 }).map(() => faker.datatype.string(6));
    await RedeemCodeFactory.addRedeemCodes(codes, gitpoap.id);
  }

  /* Create Claims */
  // GitPOAP 1
  const claim1 = await ClaimFactory.create(gitpoap1.id, vitalik.id, ClaimStatus.CLAIMED, addressBurz.id, 'thunderdome', DateTime.utc(2020, 1, 1).toJSDate());
  const claim2 = await ClaimFactory.create(gitpoap1.id, jay.id, ClaimStatus.CLAIMED, addressJay.id, '4068606', DateTime.utc(2020, 1, 2).toJSDate());
  const claim3 = await ClaimFactory.create(gitpoap1.id, tyler.id);

  // GitPOAP 2
  const claim4 = await ClaimFactory.create(gitpoap2.id, vitalik.id, ClaimStatus.CLAIMED, addressBurz.id, 'ethdenver', DateTime.utc(2020, 1, 3).toJSDate());
  const claim5 = await ClaimFactory.create(gitpoap2.id, jay.id, ClaimStatus.CLAIMED, addressJay.id, '4078452', DateTime.utc(2020, 1, 4).toJSDate());
  const claim6 = await ClaimFactory.create(gitpoap2.id, burz.id);
  const claim7 = await ClaimFactory.create(gitpoap2.id, tyler.id);

  // GitPOAP 3
  const claim8 = await ClaimFactory.create(gitpoap3.id, burz.id, ClaimStatus.CLAIMED, addressBurz.id, 'pizza-pie', DateTime.utc(2022, 4, 5).toJSDate());
  const claim9 = await ClaimFactory.create(gitpoap3.id, jay.id, ClaimStatus.CLAIMED, addressJay.id, '4082459', DateTime.utc(2020, 1, 5).toJSDate());
  const claim10 = await ClaimFactory.create(gitpoap3.id, tyler.id);

  // GitPOAP 4 - GitPOAP FE Repo
  const claim11 = await ClaimFactory.create(gitpoap4.id, burz.id);
  const claim12 = await ClaimFactory.create(gitpoap4.id, colfax.id);
  const claim13 = await ClaimFactory.create(gitpoap4.id, vitalik.id);
  const claim14 = await ClaimFactory.create(gitpoap4.id, jay.id, ClaimStatus.CLAIMED, addressJay.id, '3217451', DateTime.utc(2020, 1, 6).toJSDate());
  const claim15 = await ClaimFactory.create(gitpoap4.id, tyler.id);

  // GitPOAP 5 - GitPOAP BE Repo
  const claim16 = await ClaimFactory.create(gitpoap5.id, burz.id, ClaimStatus.CLAIMED, addressBurz.id, '3973554', DateTime.utc(2020, 1, 7).toJSDate());
  const claim17 = await ClaimFactory.create(gitpoap5.id, colfax.id, ClaimStatus.CLAIMED, addressColfax.id, '4126448', DateTime.utc(2020, 1, 8).toJSDate());
  const claim18 = await ClaimFactory.create(gitpoap5.id, jay.id);
  const claim19 = await ClaimFactory.create(gitpoap5.id, tyler.id);
  const claim20 = await ClaimFactory.create(gitpoap5.id, vitalik.id);
  const claim21 = await ClaimFactory.create(gitpoap5.id, burz2.id, ClaimStatus.CLAIMED, addressBurz2.id, '123456789', DateTime.utc(2020, 1, 9).toJSDate());

  // GitPOAPs 7 - GitPOAP BugBash Repos
  const claim22 = await ClaimFactory.create(gitpoap7.id, jay.id);
  const claim23 = await ClaimFactory.create(gitpoap7.id, burz.id);
  const claim24 = await ClaimFactory.create(gitpoap7.id, colfax.id);
  const claim25 = await ClaimFactory.create(gitpoap7.id, aldo.id);

  // GitPOAPs 8 - GitPOAP BugBash Repos
  const claim26 = await ClaimFactory.create(gitpoap8.id, jay.id);
  const claim27 = await ClaimFactory.create(gitpoap8.id, burz.id);
  const claim28 = await ClaimFactory.create(gitpoap8.id, colfax.id);
  const claim29 = await ClaimFactory.create(gitpoap8.id, aldo.id);

  // GitPOAPs 9 - GitPOAP BugBash Repos
  const claim30 = await ClaimFactory.create(gitpoap9.id, jay.id);
  const claim31 = await ClaimFactory.create(gitpoap9.id, burz.id, ClaimStatus.CLAIMED, addressBurz.id, '1234567891', DateTime.utc(2020, 1, 9).toJSDate());
  const claim32 = await ClaimFactory.create(gitpoap9.id, colfax.id, ClaimStatus.CLAIMED, addressColfax.id, '1234567892', DateTime.utc(2020, 1, 9).toJSDate());
  const claim33 = await ClaimFactory.create(gitpoap9.id, aldo.id);

  // GitPOAPs 10 - GitPOAP BugBash Repos
  const claim34 = await ClaimFactory.create(gitpoap10.id, jay.id);
  const claim35 = await ClaimFactory.create(gitpoap10.id, burz.id);
  const claim36 = await ClaimFactory.create(gitpoap10.id, colfax.id, ClaimStatus.CLAIMED, addressColfax.id, '1234567893', DateTime.utc(2020, 1, 9).toJSDate());
  const claim37 = await ClaimFactory.create(gitpoap10.id, aldo.id);

  // GitPOAPs 11 - GitPOAP BugBash Repos
  const claim38 = await ClaimFactory.create(gitpoap11.id, jay.id);
  const claim39 = await ClaimFactory.create(gitpoap11.id, burz.id);
  const claim40 = await ClaimFactory.create(gitpoap11.id, colfax.id);
  const claim41 = await ClaimFactory.create(gitpoap11.id, aldo.id, ClaimStatus.CLAIMED, addressAldo.id, '1234567894', DateTime.utc().minus({ days: 2 }).toJSDate());

  // GitPOAP 18 - Deprecated
  const claim42 = await ClaimFactory.create(gitpoap18.id, burz.id, ClaimStatus.CLAIMED, addressBurz.id, '77777', DateTime.utc(2019, 12, 11).toJSDate());
  const claim43 = await ClaimFactory.create(gitpoap18.id, kayleen.id, ClaimStatus.CLAIMED, addressKayleen.id, '77778', DateTime.utc(2019, 12, 11).toJSDate());

  // GitPOAP25
  const claim44 = await ClaimFactory.create(gitpoap25.id, burz.id, ClaimStatus.CLAIMED, addressBurz.id, '100', DateTime.utc(2022, 4, 5).toJSDate());
  const claim45 = await ClaimFactory.create(gitpoap25.id, jay.id, ClaimStatus.CLAIMED, addressJay.id, '101', DateTime.utc(2020, 1, 5).toJSDate());
  const claim46 = await ClaimFactory.create(gitpoap25.id, aldo.id, ClaimStatus.CLAIMED, addressAldo.id, '102', DateTime.utc().minus({ days: 2 }).toJSDate());
  const claim46a = await ClaimFactory.create(gitpoap25.id, kayleen.id, ClaimStatus.UNCLAIMED);
  const claim46b = await ClaimFactory.create(gitpoap25.id, tyler.id, ClaimStatus.UNCLAIMED);
  const claim46c = await ClaimFactory.create(gitpoap25.id, colfax.id, ClaimStatus.UNCLAIMED);

  // GitPOAP 26
  const claim47 = await ClaimFactory.create(gitpoap26.id, burz.id, ClaimStatus.CLAIMED, addressBurz.id, '103', DateTime.utc(2022, 4, 5).toJSDate());
  const claim49 = await ClaimFactory.create(gitpoap26.id, aldo.id, ClaimStatus.CLAIMED, addressAldo.id, '105', DateTime.utc().minus({ days: 2 }).toJSDate());
  const claim49a = await ClaimFactory.create(gitpoap26.id, kayleen.id, ClaimStatus.UNCLAIMED);
  const claim49b = await ClaimFactory.create(gitpoap26.id, tyler.id, ClaimStatus.UNCLAIMED);
  const claim49c = await ClaimFactory.create(gitpoap26.id, colfax.id, ClaimStatus.UNCLAIMED);
  const claim49d = await ClaimFactory.create(gitpoap26.id, jay.id, ClaimStatus.UNCLAIMED);
  const claim49e = await ClaimFactory.createForEthAddress(gitpoap26.id, addressColfax.id, ClaimStatus.UNCLAIMED);
  const claim49f = await ClaimFactory.createForEthAddress(
    gitpoap26.id,
    addressTyler.id,
    ClaimStatus.CLAIMED,
    addressTyler.id,
    '1023',
    DateTime.utc(2022, 11, 5).toJSDate(),
  );

  // GitPOAP 27
  const claim50 = await ClaimFactory.create(gitpoap27.id, burz.id, ClaimStatus.CLAIMED, addressBurz.id, '106', DateTime.utc(2022, 4, 5).toJSDate());
  const claim52 = await ClaimFactory.create(gitpoap27.id, aldo.id, ClaimStatus.CLAIMED, addressAldo.id, '108', DateTime.utc().minus({ days: 2 }).toJSDate());
  const claim52a = await ClaimFactory.create(gitpoap27.id, kayleen.id, ClaimStatus.UNCLAIMED);
  const claim52b = await ClaimFactory.create(gitpoap27.id, tyler.id, ClaimStatus.UNCLAIMED);
  const claim52c = await ClaimFactory.create(gitpoap27.id, colfax.id, ClaimStatus.UNCLAIMED);
  const claim52d = await ClaimFactory.createForEthAddress(gitpoap27.id, addressJay.id, ClaimStatus.UNCLAIMED);

  /* Create Profiles */
  const profile1 = await ProfileFactory.create(addressColfax.id, 'I like brisket.');
  const profile2 = await ProfileFactory.create(addressRandom1.id, 'I like bbq.', 'Random User', 'randomHandle');
  const profileJay = await ProfileFactory.create(addressJay.id, 'I like factorio.', 'Jay PB', '0xpeebeejay', 'peebeejay', 'https://s.jay.gg');
  const profile4 = await ProfileFactory.create(addressBurz.id, 'I am addicted to POAPs', 'Anna Burzillo');
  const profile5 = await ProfileFactory.create(addressBurz2.id, 'I am not real');
  const profile6 = await ProfileFactory.create(addressVitalik.id, 'I like unicorns');
  const profile7 = await ProfileFactory.create(addressAldo.id, 'I like surfing', 'Aldo Lamberti', 'aldolamberti');
  const profile8 = await ProfileFactory.create(addressTyler.id, 'yo');

  /* Create Featured POAPs */
  const featured1 = await FeaturedPOAPFactory.create(claim14.poapTokenId!, profileJay.id); // Featured GitPOAP
  const featured2 = await FeaturedPOAPFactory.create(claim9.poapTokenId!, profileJay.id); // Featured GitPOAP
  const featured3 = await FeaturedPOAPFactory.create('3976027', profileJay.id); // Featured Classic POAP - Bangia Night

  /* Create GitPOAP Requests */
  const request1 = await GitPOAPRequestFactory.create({
    name: 'Custom GitPOAPs Feature Release Contributor!',
    description: 'You contributed heavily to the release of the Custom GitPOAPs feature!',
    creatorEmailId: teamEmail.id,
    addressId: addressJay.id,
    imageUrl: getS3URL('gitpoap-request-images-test', 'gitpoap-test-2.png-1666121850.987'),
    startDate: DateTime.fromISO('2022-01-01').toJSDate(),
    endDate: DateTime.fromISO('2022-01-30').toJSDate(),
    staffApprovalStatus: StaffApprovalStatus.PENDING,
    contributors: {
      ensNames: ['peebeejay.eth'],
      githubHandles: ['peebeejay'],
      ethAddresses: ['0xpeebeejay'],
      emails: ['team@gitpoap.io'],
    },
  });

  const request2 = await GitPOAPRequestFactory.create({
    name: 'Onboarding Form Contributor!',
    description: 'The onboarding form was an absolutely massive effort, & you are most deserving of recognition for this fine achievement!',
    creatorEmailId: teamEmail.id,
    addressId: addressJay.id,
    imageUrl: getS3URL('gitpoap-request-images-test', 'gitpoap-test-1.png-1666121850.987'),
    startDate: DateTime.fromISO('2022-06-01').toJSDate(),
    endDate: DateTime.fromISO('2022-06-30').toJSDate(),
    staffApprovalStatus: StaffApprovalStatus.PENDING,
    contributors: {
      ensNames: ['lamberti.eth'],
      githubHandles: ['aldolamb'],
      ethAddresses: ['0xpeebeejay'],
      emails: ['aldo@gitpoap.io', 'burz@gitpoap.io', 'jay@gitpoap.io'],
    },
  });

  /* Create Teams */
  const gitpoapTeam = await TeamFactory.create(
    'GitPoap team',
    'A POAP is a digital collectible created as an NFT that represents an action taken by the owner.',
    addressColfax.id,
    getS3URL('gitpoap-team-logo-test', 'gitpoap-team-logo-test.png-1634321850.778'),
  );
  const gitpoapDevTeam = await TeamFactory.create(
    'GitPoap dev team',
    'The dev team at GitPoap',
    addressJay.id,
    getS3URL('gitpoap-dev-team-logo-test', 'gitpoap-dev-team-logo.png-16661532343.423'),
  );
  const ethereumTeam = await TeamFactory.create(
    'Ethereum team',
    'Ethereum is a decentralized, open-source blockchain with smart contract functionality. Ether is the native cryptocurrency of the platform.',
    addressVitalik.id,
    getS3URL('ethereum-team-logo-test', 'ethereum-team-logo.png-166635645643.437'),
  );
  const team1 = await TeamFactory.create(faker.company.bs(), faker.lorem.sentence(), addressBurz.id, faker.image.dataUri());
  const team2 = await TeamFactory.create(faker.company.bs(), faker.lorem.sentence(), addressTyler.id, faker.image.dataUri());
  const team3 = await TeamFactory.create(faker.company.bs(), faker.lorem.sentence(), addressBurz.id, faker.image.dataUri());
  const team4 = await TeamFactory.create(faker.company.bs(), faker.lorem.sentence(), addressKayleen.id, faker.image.dataUri());
  const team5 = await TeamFactory.create(faker.company.bs(), faker.lorem.sentence(), addressAldo.id, faker.image.dataUri());

  /* Create Memberships */
  const membership1 = await MembershipFactory.create(gitpoapTeam.id, addressTyler.id, MembershipRole.MEMBER, MembershipAcceptanceStatus.ACCEPTED);
  const membership2 = await MembershipFactory.create(gitpoapDevTeam.id, addressJay.id, MembershipRole.OWNER, MembershipAcceptanceStatus.PENDING);
  const membership3 = await MembershipFactory.create(ethereumTeam.id, addressColfax.id, MembershipRole.ADMIN, MembershipAcceptanceStatus.PENDING);
  const membership4 = await MembershipFactory.create(gitpoapDevTeam.id, addressTyler.id, MembershipRole.MEMBER, MembershipAcceptanceStatus.ACCEPTED);
  const membership5 = await MembershipFactory.create(ethereumTeam.id, addressTyler.id, MembershipRole.MEMBER, MembershipAcceptanceStatus.ACCEPTED);
  const membership6 = await MembershipFactory.create(gitpoapDevTeam.id, addressAldo.id, MembershipRole.ADMIN, MembershipAcceptanceStatus.PENDING);
  const membership7 = await MembershipFactory.create(gitpoapTeam.id, addressAldo.id, MembershipRole.OWNER, MembershipAcceptanceStatus.PENDING);
  const membership8 = await MembershipFactory.create(ethereumTeam.id, addressAldo.id, MembershipRole.ADMIN, MembershipAcceptanceStatus.ACCEPTED);
  const membership9 = await MembershipFactory.create(gitpoapTeam.id, addressBurz.id, MembershipRole.ADMIN, MembershipAcceptanceStatus.PENDING);
  const membership10 = await MembershipFactory.create(gitpoapDevTeam.id, addressBurz.id, MembershipRole.MEMBER, MembershipAcceptanceStatus.ACCEPTED);
  const membership11 = await MembershipFactory.create(ethereumTeam.id, addressKayleen.id, MembershipRole.OWNER, MembershipAcceptanceStatus.PENDING);

  console.log('DB Seeding complete. ');
};
