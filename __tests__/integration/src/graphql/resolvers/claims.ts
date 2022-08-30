import { GraphQLClient, gql } from 'graphql-request';
import { GH_IDS } from '../../../../../prisma/constants';

describe('CustomClaimResolver', () => {
  const client = new GraphQLClient('http://server:3001/graphql');

  it('totalClaims', async () => {
    const data = await client.request(gql`
      {
        totalClaims
      }
    `);

    expect(data.totalClaims).toEqual(16);
  });

  it('lastMonthClaims', async () => {
    const data = await client.request(gql`
      {
        lastMonthClaims
      }
    `);

    expect(data.lastMonthClaims).toEqual(1);
  });

  it('userClaims', async () => {
    const data = await client.request(gql`
      {
        userClaims(githubId: ${GH_IDS.jay}) {
          claim {
            id
          }
          event {
            name
          }
        }
      }
    `);

    expect(data.userClaims.length).toEqual(6);
  });
});
