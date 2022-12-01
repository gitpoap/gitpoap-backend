import { gql } from 'graphql-request';
import { ADDRESSES } from '../../../../../prisma/constants';
import { context } from '../../../../../src/context';
import { GitPOAPStatus } from '@prisma/client';
import { getGraphQLClient } from '../../../../../__mocks__/src/graphql/server';

describe('CustomClaimResolver', () => {
  const client = getGraphQLClient();

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

  it('userClaims - githubHandle', async () => {
    const data = await client.request(gql`
      { userClaims(address: "${ADDRESSES.jay}") { claim { id } } }
    `);

    // GitPOAP ID 5 doesn't have any claim codes or else this would be 6
    // and include Claim ID 18
    expect(data.userClaims).toHaveLength(5);
    expect(data.userClaims).toContainEqual({ claim: { id: 22 } });
    expect(data.userClaims).toContainEqual({ claim: { id: 26 } });
    expect(data.userClaims).toContainEqual({ claim: { id: 30 } });
    expect(data.userClaims).toContainEqual({ claim: { id: 34 } });
    expect(data.userClaims).toContainEqual({ claim: { id: 38 } });
  });

  it('userClaims - email', async () => {
    const data = await client.request(gql`
      { userClaims(address: "${ADDRESSES.random}") { claim { id } } }
    `);

    expect(data.userClaims).toHaveLength(1);
    expect(data.userClaims).toContainEqual({ claim: { id: 44 } });
  });

  it('userClaims - address', async () => {
    const data = await client.request(gql`
      { userClaims(address: "${ADDRESSES.random2}") { claim { id } } }
    `);

    expect(data.userClaims).toHaveLength(1);
    expect(data.userClaims).toContainEqual({ claim: { id: 45 } });
  });

  it('userClaims - unknown address', async () => {
    const data = await client.request(gql`
      { userClaims(address: "${'0x4' + ADDRESSES.random2.substr(3)}") { claim { id } } }
    `);

    expect(data.userClaims).toHaveLength(0);
  });

  it('userClaims - UNAPPROVED GitPOAP', async () => {
    // Temporarily mark GitPOAP ID 9 as UNAPPROVED
    await context.prisma.gitPOAP.update({
      where: { id: 9 },
      data: { poapApprovalStatus: GitPOAPStatus.UNAPPROVED },
    });

    const data = await client.request(gql`
      { userClaims(address: "${ADDRESSES.random2}") { claim { id } } }
    `);

    await context.prisma.gitPOAP.update({
      where: { id: 9 },
      data: { poapApprovalStatus: GitPOAPStatus.APPROVED },
    });

    expect(data.userClaims).toHaveLength(0);
  });
});
