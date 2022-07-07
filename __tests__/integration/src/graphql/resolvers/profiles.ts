import { GraphQLClient, gql } from 'graphql-request';
import { ADDRESSES } from '../../../../../prisma/constants';
import { MILLISECONDS_PER_SECOND } from '../../../../../src/constants';

describe('CustomProfileResolver', () => {
  const client = new GraphQLClient('http://server:3001/graphql');

  it('totalContributors', async () => {
    const data = await client.request(gql`
      {
        totalContributors
      }
    `);

    expect(data.totalContributors).toEqual(4);
  });

  it('lastMonthContributors', async () => {
    const data = await client.request(gql`
      {
        lastMonthContributors
      }
    `);

    expect(data.lastMonthContributors).toEqual(0);
  });

  it('profileData', async () => {
    jest.setTimeout(10 * MILLISECONDS_PER_SECOND);

    const data = await client.request(gql`
      {
        profileData(address: "${ADDRESSES.anthony}") {
          ensName
          githubHandle
        }
      }
    `);

    expect(data.profileData).not.toEqual(null);
    expect(data.profileData.ensName).toEqual('burz.eth');
    expect(data.profileData.githubHandle).toEqual(null);
  });

  it('profileData - nullable', async () => {
    jest.setTimeout(10 * MILLISECONDS_PER_SECOND);

    const address = ADDRESSES.jay.substr(0, 5) + 'c' + ADDRESSES.jay.substr(6);

    const data = await client.request(gql`
      {
        profileData(address: "${address}") {
          ensName
          address
          name
          githubHandle
        }
      }
    `);

    expect(data.profileData).not.toEqual(null);
    expect(data.profileData.ensName).toEqual(null);
    expect(data.profileData.address).toEqual(address);
    expect(data.profileData.name).toEqual(null);
    expect(data.profileData.githubHandle).toEqual(null);
  });

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

    expect(data.mostHonoredContributors[1].profile.address).toEqual(ADDRESSES.jay);
    expect(data.mostHonoredContributors[0].claimsCount).toEqual(5);

    expect(data.mostHonoredContributors[0].profile.address).toEqual(ADDRESSES.anthony);
    expect(data.mostHonoredContributors[1].claimsCount).toEqual(4);
  });

  it('repoMostHonoredContributors', async () => {
    const data = await client.request(gql`
      {
        repoMostHonoredContributors(repoId: 2, count: 2) {
          profile {
            address
          }
          claimsCount
        }
      }
    `);

    expect(data.repoMostHonoredContributors.length).toEqual(2);

    expect(data.repoMostHonoredContributors[1].profile.address).toEqual(ADDRESSES.anthony);
    expect(data.repoMostHonoredContributors[0].claimsCount).toEqual(3);

    expect(data.repoMostHonoredContributors[0].profile.address).toEqual(ADDRESSES.colfax);
    expect(data.repoMostHonoredContributors[1].claimsCount).toEqual(2);
  });
});
