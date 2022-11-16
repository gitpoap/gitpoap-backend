import { GraphQLClient, gql } from 'graphql-request';
import { ADDRESSES } from '../../../../../prisma/constants';

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
        userClaims(address: "${ADDRESSES.jay}") {
          claim {
            id
          }
          event {
            name
          }
        }
      }
    `);

    // GitPOAP ID 5 doesn't have any claim codes or else this would be 6
    // and include Claim ID 18
    expect(data.userClaims).toHaveLength(5);
  });
});
