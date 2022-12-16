import { gql } from 'graphql-request';
import { getGraphQLClient } from '../../../../../__mocks__/src/graphql/server';
import { context } from '../../../../../src/context';
import { ADDRESSES } from '../../../../../prisma/constants';

describe('MembershipResolver', () => {
  const genAccessTokenPayload = (authTokenId: number, addressId: number) => ({
    authTokenId,
    addressId,
    address: '0xyoyo',
    ensName: null,
    ensAvatarImageUrl: null,
    githubId: null,
    githubHandle: null,
    discordId: null,
    discordHandle: null,
    emailId: null,
  });

  describe('userMemberships', () => {
    it('Fails if the user is not logged in', async () => {
      const client = getGraphQLClient();

      return expect(
        client.request(
          gql`
            {
              userMemberships {
                memberships {
                  id
                }
              }
            }
          `,
        ),
      ).rejects.toThrow();
    });

    it("Returns the user's memberships for address who is logged in", async () => {
      // Corresponds to addressTyler in prisma/seed-test.ts
      const addressId = 7;
      const authToken = await context.prisma.authToken.create({
        data: {
          address: { connect: { id: addressId } },
        },
      });
      const client = getGraphQLClient(genAccessTokenPayload(authToken.id, addressId));

      const data = await client.request(gql`
        {
          userMemberships {
            memberships {
              id
            }

            error {
              message
            }
          }
        }
      `);

      await context.prisma.authToken.delete({ where: { id: authToken.id } });

      expect(data.userMemberships.error).toEqual(null);
      expect(data.userMemberships.memberships).toHaveLength(3);
    });
  });

  describe('teamMemberships', () => {
    it('Fails if the user is not logged in', async () => {
      const client = getGraphQLClient();

      return expect(
        client.request(
          gql`
            {
              teamMemberships {
                memberships {
                  id
                }
              }
            }
          `,
        ),
      ).rejects.toThrow();
    });

    it('Throw unauthorized error if logged in user is not the team owner', async () => {
      // Corresponds to addressTyler in prisma/seed-test.ts
      const addressId = 7;
      const authToken = await context.prisma.authToken.create({
        data: {
          address: { connect: { id: addressId } },
        },
      });
      const client = getGraphQLClient(genAccessTokenPayload(authToken.id, addressId));

      const data = await client.request(gql`
        {
          teamMemberships(teamId: 2) {
            memberships {
              id
            }

            error {
              message
            }
          }
        }
      `);

      await context.prisma.authToken.delete({ where: { id: authToken.id } });

      expect(data.teamMemberships.error.message).toEqual('Not authorized');
      expect(data.teamMemberships.memberships).toEqual(null);
    });

    it('Throw team not found error if team does not exist', async () => {
      // Corresponds to addressJay in prisma/seed-test.ts
      const addressId = 7;
      const authToken = await context.prisma.authToken.create({
        data: {
          address: { connect: { id: addressId } },
        },
      });
      const client = getGraphQLClient(genAccessTokenPayload(authToken.id, addressId));

      const data = await client.request(gql`
        {
          teamMemberships(teamId: 5) {
            memberships {
              id
            }

            error {
              message
            }
          }
        }
      `);

      await context.prisma.authToken.delete({ where: { id: authToken.id } });

      expect(data.teamMemberships.error.message).toEqual('Team not found');
      expect(data.teamMemberships.memberships).toEqual(null);
    });

    it("Returns the team's memberships for address who is logged in", async () => {
      // Corresponds to addressJay in prisma/seed-test.ts
      const addressId = 1;
      const authToken = await context.prisma.authToken.create({
        data: {
          address: { connect: { id: addressId } },
        },
      });
      const client = getGraphQLClient(genAccessTokenPayload(authToken.id, addressId));

      const data = await client.request(gql`
        {
          teamMemberships(teamId: 2) {
            memberships {
              id
            }

            error {
              message
            }
          }
        }
      `);

      await context.prisma.authToken.delete({ where: { id: authToken.id } });

      expect(data.teamMemberships.error).toEqual(null);
      expect(data.teamMemberships.memberships).toHaveLength(3);
    });
  });

  describe('addNewMembership', () => {
    it('Fails if the user is not logged in', async () => {
      const client = getGraphQLClient();

      return expect(
        client.request(
          gql`
            {
              mutation {
                addNewMembership(teamId: 1, address: '${ADDRESSES.kayleen}') {
                  membership {
                    id
                  }
                }
              }
            }
          `,
        ),
      ).rejects.toThrow();
    });

    it('Throw team not found error if team does not exist', async () => {
      // Corresponds to addressJay in prisma/seed-test.ts
      const addressId = 1;
      const authToken = await context.prisma.authToken.create({
        data: {
          address: { connect: { id: addressId } },
        },
      });
      const client = getGraphQLClient(genAccessTokenPayload(authToken.id, addressId));

      const data = await client.request(gql`
        {
          mutation {
            addNewMembership(teamId: 5, address: '${ADDRESSES.kayleen}') {
              membership {
                id
              }
              
              error {
                message
              }
            }
          }
        }
      `);

      await context.prisma.authToken.delete({ where: { id: authToken.id } });

      expect(data.addNewMembership.error.message).toEqual('Team not found');
      expect(data.addNewMembership.membership).toEqual(null);
    });

    it('Throw unauthorized error if logged in user is not the team owner', async () => {
      // Corresponds to addressTyler in prisma/seed-test.ts
      const addressId = 7;
      const authToken = await context.prisma.authToken.create({
        data: {
          address: { connect: { id: addressId } },
        },
      });
      const client = getGraphQLClient(genAccessTokenPayload(authToken.id, addressId));

      const data = await client.request(gql`
        {
          mutation {
            addNewMembership(teamId: 1, address: '${ADDRESSES.kayleen}') {
              membership {
                id
              }
              
              error {
                message
              }
            }
          }
        }
      `);

      await context.prisma.authToken.delete({ where: { id: authToken.id } });

      expect(data.addNewMembership.error.message).toEqual('Not authorized');
      expect(data.addNewMembership.membership).toEqual(null);
    });

    it('Throw address not found error if address does not exist', async () => {
      // Corresponds to addressJay in prisma/seed-test.ts
      const addressId = 1;
      const authToken = await context.prisma.authToken.create({
        data: {
          address: { connect: { id: addressId } },
        },
      });
      const client = getGraphQLClient(genAccessTokenPayload(authToken.id, addressId));

      const data = await client.request(gql`
        {
          mutation {
            addNewMembership(teamId: 2, address: '0x61C192be9582B8C96c91Ced88045446f41aEE483') {
              membership {
                id
              }
              
              error {
                message
              }
            }
          }
        }
      `);

      await context.prisma.authToken.delete({ where: { id: authToken.id } });

      expect(data.addNewMembership.error.message).toEqual('Address not found');
      expect(data.addNewMembership.membership).toEqual(null);
    });

    it('Add a new member to the team', async () => {
      // Corresponds to addressJay in prisma/seed-test.ts
      const addressId = 1;
      const authToken = await context.prisma.authToken.create({
        data: {
          address: { connect: { id: addressId } },
        },
      });
      const client = getGraphQLClient(genAccessTokenPayload(authToken.id, addressId));

      const data = await client.request(gql`
        {
          mutation {
            addNewMembership(teamId: 2, address: '${ADDRESSES.kayleen}') {
              membership {
                id
              }
              
              error {
                message
              }
            }
          }
        }
      `);

      await context.prisma.authToken.delete({ where: { id: authToken.id } });

      expect(data.addNewMembership.error.message).toEqual(null);
      expect(data.addNewMembership.membership.id).toEqual(9);
    });
  });
});
