import { GraphQLClient, gql } from 'graphql-request';
import { ADDRESSES } from '../../../../../prisma/constants';
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
    expect(data.profileData.githubHandle).toEqual('burz');
  });

  it('profileData - nullable', async () => {
    const address = ADDRESSES.jay.substring(0, 5) + 'c' + ADDRESSES.jay.substring(6);

    // Ensure the record doesn't already exist
    const startingRecord = await context.prisma.profile.findFirst({
      where: {
        address: {
          ethAddress: address,
        },
      },
    });

    expect(startingRecord).toEqual(null);

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

    // Ensure that the record has been upserted
    const endingRecord = await context.prisma.profile.findFirst({
      where: {
        address: {
          ethAddress: address,
        },
      },
    });

    expect(endingRecord).not.toEqual(null);

    // Delete the record
    await context.prisma.profile.deleteMany({
      where: {
        address: {
          ethAddress: address,
        },
      },
    });
  });

  it('profileData - new GitHub Connection', async () => {
    const data = await client.request(gql`
    {
      profileData(address: "${ADDRESSES.aldo}") {
        address
        githubHandle
      }
    }
  `);

    expect(data.profileData).not.toEqual(null);
    expect(data.profileData.address).toEqual(ADDRESSES.aldo);
    expect(data.profileData.githubHandle).toEqual('aldolamb');
  });

  it('profileData - old GitHub Connection', async () => {
    const data = await client.request(gql`
    {
      profileData(address: "${ADDRESSES.random}") {
        address
        githubHandle
      }
    }
  `);

    expect(data.profileData).not.toEqual(null);
    expect(data.profileData.address).toEqual(ADDRESSES.random);
    expect(data.profileData.githubHandle).toEqual('randomHandle');
  });

  it('mostHonoredContributors', async () => {
    const data = await client.request(gql`
      {
        mostHonoredContributors(count: 2) {
          profile {
            address {
              ethAddress
            }
          }
          claimsCount
        }
      }
    `);

    expect(data.mostHonoredContributors).toHaveLength(2);

    expect(data.mostHonoredContributors[0].profile.address.ethAddress).toEqual(ADDRESSES.burz);
    expect(data.mostHonoredContributors[0].claimsCount).toEqual(6);

    expect(data.mostHonoredContributors[1].profile.address.ethAddress).toEqual(ADDRESSES.jay);
    expect(data.mostHonoredContributors[1].claimsCount).toEqual(4);
  });

  const setAddressVisibility = async (address: string, isVisibleOnLeaderboard: boolean) => {
    const addressRecord = await context.prisma.address.upsert({
      where: {
        ethAddress: address.toLowerCase(),
      },
      update: {},
      create: {
        ethAddress: address.toLowerCase(),
      },
    });

    await context.prisma.profile.update({
      where: {
        addressId: addressRecord.id,
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
            address {
              ethAddress
            }
          }
          claimsCount
        }
      }
    `);

    await setAddressVisibility(ADDRESSES.burz, true);

    expect(data.mostHonoredContributors).toHaveLength(1);

    expect(data.mostHonoredContributors[0].profile.address.ethAddress).toEqual(ADDRESSES.jay);
    expect(data.mostHonoredContributors[0].claimsCount).toEqual(4);
  });

  it('repoMostHonoredContributors', async () => {
    const data = await client.request(gql`
      {
        repoMostHonoredContributors(repoId: 1, page: 1, perPage: 4) {
          profile {
            address {
              ethAddress
            }
          }
          claimsCount
        }
      }
    `);

    expect(data.repoMostHonoredContributors).toHaveLength(1);

    expect(data.repoMostHonoredContributors[0].profile.address.ethAddress).toEqual(ADDRESSES.jay);
    expect(data.repoMostHonoredContributors[0].claimsCount).toEqual(1);
  });

  it('repoMostHonoredContributors: skips isVisibleOnLeaderboard=false', async () => {
    await setAddressVisibility(ADDRESSES.jay, false);

    const data = await client.request(gql`
      {
        repoMostHonoredContributors(repoId: 1, page: 1, perPage: 1) {
          profile {
            address {
              ethAddress
            }
          }
          claimsCount
        }
      }
    `);

    await setAddressVisibility(ADDRESSES.jay, true);

    expect(data.repoMostHonoredContributors).toHaveLength(0);
  });
});
