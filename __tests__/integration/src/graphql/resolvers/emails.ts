import { gql } from 'graphql-request';
import { getGraphQLClient } from '../../../../../__mocks__/src/graphql/server';
import { context } from '../../../../../src/context';

describe('CustomEmailResolver', () => {
  it('Fails if the user is not logged in', async () => {
    const client = getGraphQLClient();

    return expect(
      client.request(
        gql`
          {
            userEmail {
              emailAddress
            }
          }
        `,
      ),
    ).rejects.toThrow();
  });

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

  it("Doesn't return an email address for a user that doesn't have one set", async () => {
    // Corresponds to addressBurz in prisma/seed-test.ts
    const addressId = 2;
    const authToken = await context.prisma.authToken.create({
      data: {
        address: { connect: { id: addressId } },
      },
    });
    const client = getGraphQLClient(genAccessTokenPayload(authToken.id, addressId));

    const data = await client.request(
      gql`
        {
          userEmail {
            emailAddress
          }
        }
      `,
    );

    await context.prisma.authToken.delete({ where: { id: authToken.id } });

    expect(data.userEmail.emailAddress).toEqual(null);
  });

  it("Marks an email address unverified for a user that hasn't verified yet", async () => {
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
        userEmail {
          emailAddress
          isValidated
        }
      }
    `);

    await context.prisma.authToken.delete({ where: { id: authToken.id } });

    expect(data.userEmail.emailAddress).toEqual('unvalidated@gitpoap.io');
    expect(data.userEmail.isValidated).toEqual(false);
  });

  it("Returns the user's email address who is logged in", async () => {
    // Corresponds to addressKayleen in prisma/seed-test.ts
    const addressId = 8;
    const authToken = await context.prisma.authToken.create({
      data: {
        address: { connect: { id: addressId } },
      },
    });
    const client = getGraphQLClient(genAccessTokenPayload(authToken.id, addressId));

    const data = await client.request(gql`
      {
        userEmail {
          emailAddress
          isValidated
        }
      }
    `);

    await context.prisma.authToken.delete({ where: { id: authToken.id } });

    expect(data.userEmail.emailAddress).toEqual('validated@gitpoap.io');
    expect(data.userEmail.isValidated).toEqual(true);
  });
});
