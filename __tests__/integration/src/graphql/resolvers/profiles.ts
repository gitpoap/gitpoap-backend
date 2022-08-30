import { GraphQLClient, gql } from 'graphql-request';
import { ADDRESSES } from '../../../../../prisma/constants';
import { MILLISECONDS_PER_SECOND } from '../../../../../src/constants';
import { context } from '../../../../../src/context';

describe('CustomProfileResolver', () => {
  const client = new GraphQLClient('http://server:3001/graphql');

  it('totalContributors', async () => {
    const data = await client.request(gql`
      {
        totalContributors
      }
    `);

    expect(data.totalContributors).toEqual(6);
  });

  it('lastMonthContributors', async () => {
    const data = await client.request(gql`
      {
        lastMonthContributors
      }
    `);

    expect(data.lastMonthContributors).toEqual(1);
  });

  it('profileData', async () => {
    const data = await client.request(gql`
      {
        profileData(address: "${ADDRESSES.burz}") {
          ensName
          githubHandle
        }
      }
    `);

    expect(data.profileData).not.toEqual(null);
    expect(data.profileData.ensName).toEqual('burz.eth');
    expect(data.profileData.githubHandle).toEqual(null);
  }, 10 * MILLISECONDS_PER_SECOND);

  it('profileData - nullable', async () => {
    const address = ADDRESSES.jay.substr(0, 5) + 'c' + ADDRESSES.jay.substr(6);

    const data = await client.request(gql`
      {
        profileData(address: "${address}") {
          ensName
          address
          name
          githubHandle
          isVisibleOnLeaderboard
        }
      }
    `);

    expect(data.profileData).not.toEqual(null);
    expect(data.profileData.ensName).toEqual(null);
    expect(data.profileData.address).toEqual(address);
    expect(data.profileData.name).toEqual(null);
    expect(data.profileData.githubHandle).toEqual(null);
    expect(data.profileData.isVisibleOnLeaderboard).toEqual(true);
  }, 10 * MILLISECONDS_PER_SECOND);

  it('mostHonoredContributors', async () => {
    const data = await client.request(gql`
      {
        mostHonoredContributors(count: 2) {
          profile {
            address
          }
          claimsCount
        }
      }
    `);

    expect(data.mostHonoredContributors.length).toEqual(2);

    expect(data.mostHonoredContributors[0].profile.address).toEqual(ADDRESSES.burz);
    expect(data.mostHonoredContributors[0].claimsCount).toEqual(6);

    expect(data.mostHonoredContributors[1].profile.address).toEqual(ADDRESSES.jay);
    expect(data.mostHonoredContributors[1].claimsCount).toEqual(4);
  });

  const setAddressVisibility = async (address: string, isVisibleOnLeaderboard: boolean) => {
    await context.prisma.profile.update({
      where: {
        address: address.toLowerCase(),
      },
      data: { isVisibleOnLeaderboard },
    });
  };

  it('mostHonoredContributors: skips isVisibleOnLeaderboard=false', async () => {
    await setAddressVisibility(ADDRESSES.burz, false);

    const data = await client.request(gql`
      {
        mostHonoredContributors(count: 1) {
          profile {
            address
          }
          claimsCount
        }
      }
    `);

    await setAddressVisibility(ADDRESSES.burz, true);

    expect(data.mostHonoredContributors.length).toEqual(1);

    expect(data.mostHonoredContributors[0].profile.address).toEqual(ADDRESSES.jay);
    expect(data.mostHonoredContributors[0].claimsCount).toEqual(4);
  });

  it('repoMostHonoredContributors', async () => {
    const data = await client.request(gql`
      {
        repoMostHonoredContributors(repoId: 1, page: 1, perPage: 4) {
          profile {
            address
          }
          claimsCount
        }
      }
    `);

    expect(data.repoMostHonoredContributors.length).toEqual(1);

    expect(data.repoMostHonoredContributors[0].profile.address).toEqual(ADDRESSES.jay);
    expect(data.repoMostHonoredContributors[0].claimsCount).toEqual(1);
  });

  it('repoMostHonoredContributors: skips isVisibleOnLeaderboard=false', async () => {
    await setAddressVisibility(ADDRESSES.jay, false);

    const data = await client.request(gql`
      {
        repoMostHonoredContributors(repoId: 1, page: 1, perPage: 1) {
          profile {
            address
          }
          claimsCount
        }
      }
    `);

    await setAddressVisibility(ADDRESSES.jay, true);

    expect(data.repoMostHonoredContributors.length).toEqual(0);
  });
});
