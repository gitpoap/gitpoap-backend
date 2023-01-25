import { gql } from 'graphql-request';
import { ADDRESSES, GH_HANDLES } from '../../../../../prisma/constants';
import { context } from '../../../../../src/context';
import { GitPOAPStatus } from '@prisma/client';
import {
  getGraphQLClient,
  getGraphQLClientWithAuth,
} from '../../../../../__mocks__/src/graphql/server';
import { TEAM_EMAIL } from '../../../../../src/constants';

describe('CustomClaimResolver', () => {
  it('totalClaims', async () => {
    const data = await getGraphQLClient().request(
      gql`
        {
          totalClaims
        }
      `,
    );

    expect(data.totalClaims).toEqual(16);
  });

  it('lastMonthClaims', async () => {
    const data = await getGraphQLClient().request(
      gql`
        {
          lastMonthClaims
        }
      `,
    );

    expect(data.lastMonthClaims).toEqual(1);
  });

  it('userClaims - githubHandle', async () => {
    const data = await (
      await getGraphQLClientWithAuth({
        githubHandle: GH_HANDLES.jay,
      })
    ).request(
      gql`
        {
          userClaims {
            claim {
              id
            }
          }
        }
      `,
    );

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
    const data = await (
      await getGraphQLClientWithAuth({
        emailAddress: TEAM_EMAIL,
      })
    ).request(
      gql`
        {
          userClaims {
            claim {
              id
            }
          }
        }
      `,
    );

    expect(data.userClaims).toHaveLength(1);
    expect(data.userClaims).toContainEqual({ claim: { id: 44 } });
  });

  it('userClaims - address', async () => {
    const data = await (
      await getGraphQLClientWithAuth({
        ethAddress: ADDRESSES.random2,
      })
    ).request(
      gql`
        {
          userClaims {
            claim {
              id
            }
          }
        }
      `,
    );

    expect(data.userClaims).toHaveLength(1);
    expect(data.userClaims).toContainEqual({ claim: { id: 45 } });
  });

  it('userClaims - unknown address', async () => {
    const data = await (
      await getGraphQLClientWithAuth({})
    ).request(
      gql`
        {
          userClaims {
            claim {
              id
            }
          }
        }
      `,
    );

    expect(data.userClaims).toHaveLength(0);
  });

  it('userClaims - UNAPPROVED GitPOAP', async () => {
    // Temporarily mark GitPOAP ID 9 as UNAPPROVED
    await context.prisma.gitPOAP.update({
      where: { id: 9 },
      data: { poapApprovalStatus: GitPOAPStatus.UNAPPROVED },
    });

    const data = await (
      await getGraphQLClientWithAuth({
        ethAddress: ADDRESSES.random2,
      })
    ).request(
      gql`
        {
          userClaims {
            claim {
              id
            }
          }
        }
      `,
    );

    await context.prisma.gitPOAP.update({
      where: { id: 9 },
      data: { poapApprovalStatus: GitPOAPStatus.APPROVED },
    });

    expect(data.userClaims).toHaveLength(0);
  });
});
