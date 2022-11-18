import '../../../../../__mocks__/src/logging';
import { contextMock } from '../../../../../__mocks__/src/context';
import request from 'supertest';
import { setupApp } from '../../../../../__mocks__/src/app';
import {
  requestGithubOAuthToken,
  getGithubCurrentUserInfo,
} from '../../../../../src/external/github';
import {
  addGithubLoginForAddress,
  removeGithubLoginForAddress,
} from '../../../../../src/lib/addresses';
import { upsertGithubUser } from '../../../../../src/lib/githubUsers';
import { generateAuthTokensWithChecks } from '../../../../../src/lib/authTokens';
import { setupGenAuthTokens } from '../../../../../__mocks__/src/lib/authTokens';

jest.mock('../../../../../src/logging');
jest.mock('../../../../../src/external/github');
jest.mock('../../../../../src/lib/githubUsers');
jest.mock('../../../../../src/lib/addresses');
jest.mock('../../../../../src/lib/authTokens');

const mockedRequestGithubOAuthToken = jest.mocked(requestGithubOAuthToken, true);
const mockedGetGithubCurrentUserInfo = jest.mocked(getGithubCurrentUserInfo, true);
const mockedUpsertGithubUser = jest.mocked(upsertGithubUser, true);
const mockedAddGithubLoginForAddress = jest.mocked(addGithubLoginForAddress, true);
const mockedRemoveGithubLoginForAddress = jest.mocked(removeGithubLoginForAddress, true);
const mockedGenerateAuthTokensWithChecks = jest.mocked(generateAuthTokensWithChecks, true);

const authTokenId = 995;
const authTokenGeneration = 42;
const addressId = 322;
const address = '0xbArF00';
const ensName = null;
const ensAvatarImageUrl = null;
const code = '243lkjlkjdfs';
const githubToken = 'fooajldkfjlskj32f';
const githubId = 2342;
const githubHandle = 'snoop-doggy-dog';
const githubUserId = 342444;

function mockJwtWithAddress() {
  contextMock.prisma.authToken.findUnique.mockResolvedValue({
    address: {
      ensName,
      ensAvatarImageUrl,
      email: null,
    },
  } as any);
}

const genAuthTokens = setupGenAuthTokens({
  authTokenId,
  generation: authTokenGeneration,
  addressId,
  address,
  ensName,
  ensAvatarImageUrl,
  githubId,
  githubHandle,
  emailId: null,
});

describe('POST /github', () => {
  it('Fails with no access token provided', async () => {
    const result = await request(await setupApp())
      .post('/oauth/github')
      .send({ code });

    expect(result.statusCode).toEqual(400);
  });

  it('Fails with bad fields in request', async () => {
    mockJwtWithAddress();

    const authTokens = genAuthTokens();

    const result = await request(await setupApp())
      .post('/oauth/github')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ foobar: 'yeet' });

    expect(result.statusCode).toEqual(400);
  });

  it('Fails with invalid code', async () => {
    mockJwtWithAddress();
    mockedRequestGithubOAuthToken.mockRejectedValue(new Error('error'));

    const authTokens = genAuthTokens();

    const result = await request(await setupApp())
      .post('/oauth/github')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ code });

    expect(result.statusCode).toEqual(400);

    expect(mockedRequestGithubOAuthToken).toHaveBeenCalledTimes(1);
    expect(mockedRequestGithubOAuthToken).toHaveBeenCalledWith(code);
  });

  it('Fails if current GitHub user lookup fails', async () => {
    mockJwtWithAddress();
    mockedRequestGithubOAuthToken.mockResolvedValue(githubToken);
    mockedGetGithubCurrentUserInfo.mockResolvedValue(null);

    const authTokens = genAuthTokens();

    const result = await request(await setupApp())
      .post('/oauth/github')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ code });

    expect(result.statusCode).toEqual(500);

    expect(mockedRequestGithubOAuthToken).toHaveBeenCalledTimes(1);
    expect(mockedRequestGithubOAuthToken).toHaveBeenCalledWith(code);

    expect(mockedGetGithubCurrentUserInfo).toHaveBeenCalledTimes(1);
    expect(mockedGetGithubCurrentUserInfo).toHaveBeenCalledWith(githubToken);
  });

  it('Returns UserAuthTokens on success', async () => {
    mockJwtWithAddress();
    mockedRequestGithubOAuthToken.mockResolvedValue(githubToken);
    mockedGetGithubCurrentUserInfo.mockResolvedValue({
      id: githubId,
      login: githubHandle,
    } as any);
    const fakeGithubUser = { id: githubUserId };
    mockedUpsertGithubUser.mockResolvedValue(fakeGithubUser as any);
    const nextGeneration = authTokenGeneration + 1;
    const fakeAddress = { is: 'fake' };
    contextMock.prisma.authToken.update.mockResolvedValue({
      generation: nextGeneration,
      address: fakeAddress,
    } as any);
    mockedAddGithubLoginForAddress.mockResolvedValue(undefined);
    const fakeAuthTokens = { accessToken: 'foo', refreshToken: 'bar' };
    mockedGenerateAuthTokensWithChecks.mockResolvedValue(fakeAuthTokens);

    const authTokens = genAuthTokens();

    const result = await request(await setupApp())
      .post('/oauth/github')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ code });

    expect(result.statusCode).toEqual(200);
    expect(result.body).toEqual(fakeAuthTokens);

    expect(mockedRequestGithubOAuthToken).toHaveBeenCalledTimes(1);
    expect(mockedRequestGithubOAuthToken).toHaveBeenCalledWith(code);

    expect(mockedGetGithubCurrentUserInfo).toHaveBeenCalledTimes(1);
    expect(mockedGetGithubCurrentUserInfo).toHaveBeenCalledWith(githubToken);

    expect(mockedUpsertGithubUser).toHaveBeenCalledTimes(1);
    expect(mockedUpsertGithubUser).toHaveBeenCalledWith(githubId, githubHandle, githubToken);

    expect(mockedAddGithubLoginForAddress).toHaveBeenCalledTimes(1);
    expect(mockedAddGithubLoginForAddress).toHaveBeenCalledWith(addressId, githubUserId);

    expect(contextMock.prisma.authToken.update).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.authToken.update).toHaveBeenCalledWith({
      where: { id: authTokenId },
      data: {
        generation: { increment: 1 },
      },
      select: {
        generation: true,
        address: {
          select: {
            ensName: true,
            ensAvatarImageUrl: true,
            email: {
              select: {
                id: true,
                isValidated: true,
              },
            },
          },
        },
      },
    });

    expect(generateAuthTokensWithChecks).toHaveBeenCalledTimes(1);
    expect(generateAuthTokensWithChecks).toHaveBeenCalledWith(authTokenId, nextGeneration, {
      ...fakeAddress,
      id: addressId,
      ethAddress: address,
      githubUser: fakeGithubUser,
    });
  });
});

describe('DELETE /github', () => {
  it('Fails with no access token provided', async () => {
    const result = await request(await setupApp()).delete('/oauth/github');

    expect(result.statusCode).toEqual(400);
  });

  it('Fails with invalid access token', async () => {
    const result = await request(await setupApp())
      .delete('/oauth/github')
      .set('Authorization', `Bearer foo`);

    expect(result.statusCode).toEqual(400);
  });

  const expectAuthTokenFindUnique = () => {
    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledWith({
      where: { id: authTokenId },
      select: {
        id: true,
        address: {
          select: {
            ensName: true,
            ensAvatarImageUrl: true,
            githubUser: {
              select: {
                githubId: true,
                githubHandle: true,
              },
            },
            email: {
              select: {
                id: true,
                isValidated: true,
              },
            },
          },
        },
      },
    });
  };

  it('Fails if no GitHub user is connected to the address', async () => {
    contextMock.prisma.authToken.findUnique.mockResolvedValue({
      id: authTokenId,
      address: {
        ensName,
        ensAvatarImageUrl,
        email: null,
        githubUser: null,
      },
    } as any);

    const authTokens = genAuthTokens({ hasGithub: false });

    const result = await request(await setupApp())
      .delete('/oauth/github')
      .set('Authorization', `Bearer ${authTokens.accessToken}`);

    expect(result.statusCode).toEqual(400);

    expectAuthTokenFindUnique();
  });

  it('Succeeds if GitHub user is connected to the address', async () => {
    contextMock.prisma.authToken.findUnique.mockResolvedValue({
      id: authTokenId,
      address: {
        ensName,
        ensAvatarImageUrl,
        email: null,
        githubUser: {
          id: githubUserId,
          githubId,
          githubHandle,
        },
      },
    } as any);
    const nextGeneration = authTokenGeneration + 1;
    const fakeAddress = { wow: 'so fake' };
    contextMock.prisma.authToken.update.mockResolvedValue({
      generation: nextGeneration,
      address: fakeAddress,
    } as any);
    const fakeAuthTokens = { accessToken: 'yeet', refreshToken: 'yolo' };
    mockedGenerateAuthTokensWithChecks.mockResolvedValue(fakeAuthTokens);

    const authTokens = genAuthTokens({ hasGithub: true });

    const result = await request(await setupApp())
      .delete('/oauth/github')
      .set('Authorization', `Bearer ${authTokens.accessToken}`);

    expect(result.statusCode).toEqual(200);
    expect(result.body).toEqual(fakeAuthTokens);

    expectAuthTokenFindUnique();

    /* Expect that the token is updated to remove the user */
    expect(contextMock.prisma.authToken.update).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.authToken.update).toHaveBeenCalledWith({
      where: { id: authTokenId },
      data: {
        generation: { increment: 1 },
      },
      select: {
        generation: true,
        address: {
          select: {
            ensName: true,
            ensAvatarImageUrl: true,
            email: {
              select: {
                id: true,
                isValidated: true,
              },
            },
          },
        },
      },
    });

    expect(mockedRemoveGithubLoginForAddress).toHaveBeenCalledTimes(1);
    expect(mockedRemoveGithubLoginForAddress).toHaveBeenCalledWith(addressId);

    expect(mockedGenerateAuthTokensWithChecks).toHaveBeenCalledTimes(1);
    expect(mockedGenerateAuthTokensWithChecks).toHaveBeenCalledWith(authTokenId, nextGeneration, {
      ...fakeAddress,
      id: addressId,
      ethAddress: address,
      githubUser: null,
    });
  });
});
