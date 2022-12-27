import supertest from 'supertest';
import { contextMock } from '../../../../../__mocks__/src/context';
import { setupApp } from '../../../../../__mocks__/src/app';
import { genGQLAccessToken } from '../../../../../__mocks__/src/graphql/server';

const queryData = {
  query: `
  {
    userEmail {
      isValidated
      emailAddress
    }
  }
  `,
};

const token = genGQLAccessToken({
  authTokenId: 1,
  addressId: 1,
  address: '0x123',
  ensName: null,
  ensAvatarImageUrl: null,
  memberships: [],
  githubId: null,
  githubHandle: null,
  discordId: null,
  discordHandle: null,
  emailId: null,
});

const makeGqlRequest = async (query: Record<string, any>) => {
  return await supertest(await setupApp())
    .post('/graphql')
    .set('Authorization', `Bearer ${token}`)
    .send(query);
};

const mockToken = () => {
  contextMock.prisma.authToken.findUnique.mockResolvedValue({
    id: 1,
    address: {
      email: null,
      memberships: [],
    },
  } as any);
};

describe('CustomEmailResolver', () => {
  it('returns null if no email is found', async () => {
    mockToken();
    contextMock.prisma.email.findUnique.mockResolvedValue(null);
    const response = await makeGqlRequest(queryData);

    expect(response.body.data).toBe(null);
  });

  it('runs email data if an email is found for the user', async () => {
    mockToken();
    contextMock.prisma.email.findUnique.mockResolvedValue({
      emailAddress: 'yo@bruh.com',
      isValidated: true,
    } as any);

    const response = await makeGqlRequest(queryData);

    expect(response.body.data?.userEmail.isValidated).toBe(true);
    expect(response.body.data?.userEmail.emailAddress).toBe('yo@bruh.com');
  });
});
