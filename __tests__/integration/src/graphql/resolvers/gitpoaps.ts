import { gql } from 'graphql-request';
import {
  event1,
  event2,
  event3,
  event25149,
  event27305,
  event29009,
  event36570,
  event36572,
  event36576,
} from '../../../../../prisma/data';
import { ADDRESSES } from '../../../../../prisma/constants';
import { getGraphQLClient } from '../../../../../__mocks__/src/graphql/server';

describe('CustomClaimResolver', () => {
  const client = getGraphQLClient();

  it('totalGitPOAPs', async () => {
    const data = await client.request(gql`
      {
        totalGitPOAPs
      }
    `);

    expect(data.totalGitPOAPs).toEqual(17);
  });

  it('lastMonthGitPOAPs', async () => {
    const data = await client.request(gql`
      {
        lastMonthGitPOAPs
      }
    `);

    expect(data.lastMonthGitPOAPs).toEqual(17);
  });

  it('gitPOAPEvent', async () => {
    const data = await client.request(gql`
      {
        gitPOAPEvent(id: 2) {
          gitPOAP {
            year
          }
          event {
            name
          }
        }
      }
    `);

    expect(data.gitPOAPEvent).not.toEqual(null);
    expect(data.gitPOAPEvent.gitPOAP.year).toEqual(2024);
    expect(data.gitPOAPEvent.event.name).toEqual(event2.name);
  });

  it('userPOAPs - date', async () => {
    const data = await client.request(gql`
      {
        userPOAPs(address: "${ADDRESSES.burz}", perPage: 1, page: 1) {
          totalGitPOAPs
          totalPOAPs
          gitPOAPs {
            event {
              name
            }
            contributionCount
          }
          poaps {
            event {
              name
            }
          }
        }
      }
    `);

    expect(data.userPOAPs.totalGitPOAPs).toEqual(3);
    expect(data.userPOAPs.totalPOAPs).toEqual(4);

    expect(data.userPOAPs.gitPOAPs).toHaveLength(1);
    expect(data.userPOAPs.gitPOAPs[0].event.name).toEqual(event3.name);
    expect(data.userPOAPs.gitPOAPs[0].contributionCount).toEqual(0);

    expect(data.userPOAPs.poaps).toHaveLength(1);
    expect(data.userPOAPs.poaps[0].event.name).toEqual(event27305.name);
  });

  it('userPOAPs - alphabetical', async () => {
    const data = await client.request(gql`
      {
        userPOAPs(address: "${ADDRESSES.burz}", sort: "alphabetical", perPage: 1, page: 1) {
          totalGitPOAPs
          totalPOAPs
          gitPOAPs {
            event {
              name
            }
            contributionCount
          }
          poaps {
            event {
              name
            }
          }
        }
      }
    `);

    expect(data.userPOAPs.totalGitPOAPs).toEqual(3);
    expect(data.userPOAPs.totalPOAPs).toEqual(4);

    expect(data.userPOAPs.gitPOAPs).toHaveLength(1);
    expect(data.userPOAPs.gitPOAPs[0].event.name).toEqual(event2.name);
    expect(data.userPOAPs.gitPOAPs[0].contributionCount).toEqual(0);

    expect(data.userPOAPs.poaps).toHaveLength(1);
    expect(data.userPOAPs.poaps[0].event.name).toEqual(event25149.name);
  });

  it('userPOAPs - returns DEPRECATED GitPOAPs', async () => {
    const data = await client.request(gql`
      {
        userPOAPs(address: "${ADDRESSES.kayleen}", sort: "alphabetical", perPage: 1, page: 1) {
          totalGitPOAPs
          totalPOAPs
          gitPOAPs {
            event {
              name
            }
          }
          poaps {
            event {
              name
            }
          }
        }
      }
    `);

    expect(data.userPOAPs.totalGitPOAPs).toEqual(1);
    expect(data.userPOAPs.totalPOAPs).toEqual(0);

    expect(data.userPOAPs.gitPOAPs).toHaveLength(1);
    expect(data.userPOAPs.gitPOAPs[0].event.name).toEqual(event36576.name);

    expect(data.userPOAPs.poaps).toHaveLength(0);
  });

  it('repoGitPOAPs - date', async () => {
    const data = await client.request(gql`
      {
        repoGitPOAPs(repoId: 2, perPage: 1, page: 1) {
          totalGitPOAPs
          gitPOAPs {
            event {
              name
            }
          }
        }
      }
    `);

    expect(data.repoGitPOAPs.totalGitPOAPs).toEqual(4);

    expect(data.repoGitPOAPs.gitPOAPs).toHaveLength(1);
    expect(data.repoGitPOAPs.gitPOAPs[0].event.name).toEqual(event36572.name);
  });

  it('repoGitPOAPs - alphabetical', async () => {
    const data = await client.request(gql`
      {
        repoGitPOAPs(repoId: 2, sort: "alphabetical", perPage: 1, page: 1) {
          totalGitPOAPs
          gitPOAPs {
            event {
              name
            }
          }
        }
      }
    `);

    expect(data.repoGitPOAPs.totalGitPOAPs).toEqual(4);

    expect(data.repoGitPOAPs.gitPOAPs).toHaveLength(1);
    expect(data.repoGitPOAPs.gitPOAPs[0].event.name).toEqual(event36570.name);
  });

  it('mostClaimedGitPOAPs', async () => {
    const data = await client.request(gql`
      {
        mostClaimedGitPOAPs(count: 6) {
          claimsCount
          gitPOAP {
            id
          }
          event {
            name
          }
        }
      }
    `);

    expect(data.mostClaimedGitPOAPs).toHaveLength(6);

    expect(data.mostClaimedGitPOAPs[0].event.name).toEqual(event29009.name);
    expect(data.mostClaimedGitPOAPs[0].gitPOAP.id).toEqual(5);
    expect(data.mostClaimedGitPOAPs[0].claimsCount).toEqual(3);

    expect(data.mostClaimedGitPOAPs).toContainEqual({
      event: { name: event1.name },
      gitPOAP: { id: 1 },
      claimsCount: 2,
    });
    expect(data.mostClaimedGitPOAPs).toContainEqual({
      event: { name: event2.name },
      gitPOAP: { id: 2 },
      claimsCount: 2,
    });
    expect(data.mostClaimedGitPOAPs).toContainEqual({
      event: { name: event3.name },
      gitPOAP: { id: 3 },
      claimsCount: 2,
    });
    expect(data.mostClaimedGitPOAPs).toContainEqual({
      event: { name: event36570.name },
      gitPOAP: { id: 9 },
      claimsCount: 2,
    });
    expect(data.mostClaimedGitPOAPs).toContainEqual({
      event: { name: event36576.name },
      gitPOAP: { id: 18 },
      claimsCount: 2,
    });
  });

  it('profileFeaturedPOAPs', async () => {
    const data = await client.request(gql`
      {
        profileFeaturedPOAPs(address: "${ADDRESSES.burz}") {
          gitPOAPs {
            claim {
              id
            }
            poap {
              event {
                name
              }
            }
          }
          poaps {
            event {
              name
            }
          }
        }
      }
    `);

    expect(data.profileFeaturedPOAPs.gitPOAPs).toHaveLength(0);
    expect(data.profileFeaturedPOAPs.poaps).toHaveLength(0);
  });

  it('gitPOAPHolders - claim-date', async () => {
    const data = await client.request(gql`
      {
        gitPOAPHolders(gitPOAPId: 9, perPage: 1, page: 1) {
          totalHolders
          holders {
            address
            gitPOAPCount
          }
        }
      }
    `);

    expect(data.gitPOAPHolders.totalHolders).toEqual(2);
    expect(data.gitPOAPHolders.holders).toHaveLength(1);

    expect(data.gitPOAPHolders.holders[0].address).toEqual(ADDRESSES.colfax);
    expect(data.gitPOAPHolders.holders[0].gitPOAPCount).toEqual(3);
  });

  it('gitPOAPHolders - claim-count', async () => {
    const data = await client.request(gql`
      {
        gitPOAPHolders(gitPOAPId: 9, sort: "claim-count", perPage: 1, page: 1) {
          totalHolders
          holders {
            address
            gitPOAPCount
          }
        }
      }
    `);

    expect(data.gitPOAPHolders.totalHolders).toEqual(2);
    expect(data.gitPOAPHolders.holders).toHaveLength(1);

    expect(data.gitPOAPHolders.holders[0].address).toEqual(ADDRESSES.burz);
    expect(data.gitPOAPHolders.holders[0].gitPOAPCount).toEqual(6);
  });
});
