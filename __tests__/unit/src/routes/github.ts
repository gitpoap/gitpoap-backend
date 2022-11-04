import '../../../../__mocks__/src/logging';
import { contextMock } from '../../../../__mocks__/src/context';
import request from 'supertest';
import { setupApp } from '../../../../__mocks__/src/app';
import { requestGithubOAuthToken, getGithubCurrentUserInfo } from '../../../../src/external/github';
import {
  addGithubLoginForAddress,
  removeGithubLoginForAddress,
} from '../../../../src/lib/addresses';
import { upsertUser } from '../../../../src/lib/users';
import { generateAuthTokens } from '../../../../src/lib/authTokens';
import { verify } from 'jsonwebtoken';
import { JWT_SECRET } from '../../../../src/environment';
import {
  UserAuthTokens,
  getAccessTokenPayload,
  getRefreshTokenPayload,
} from '../../../../src/types/authTokens';

jest.mock('../../../../src/logging');
jest.mock('../../../../src/external/github');
jest.mock('../../../../src/lib/users');
jest.mock('../../../../src/lib/addresses');

const mockedRequestGithubOAuthToken = jest.mocked(requestGithubOAuthToken, true);
const mockedGetGithubCurrentUserInfo = jest.mocked(getGithubCurrentUserInfo, true);
const mockedUpsertUser = jest.mocked(upsertUser, true);
const mockedAddGithubLoginForAddress = jest.mocked(addGithubLoginForAddress, true);
const mockedRemoveGithubLoginForAddress = jest.mocked(removeGithubLoginForAddress, true);

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
const userId = 342444;

function mockJwtWithAddress() {
  contextMock.prisma.authToken.findUnique.mockResolvedValue({
    id: authTokenId,
    address: { ensName, ensAvatarImageUrl },
  } as any);
}

function genAuthTokens(hasGithub = false) {
  return generateAuthTokens(
    authTokenId,
    authTokenGeneration,
    addressId,
    address,
    ensName,
    ensAvatarImageUrl,
    hasGithub ? githubId : null,
    hasGithub ? githubHandle : null,
  );
}

describe('POST /github', () => {
  it('Fails with no access token provided', async () => {
    const result = await request(await setupApp())
      .post('/github')
      .send({ code });

    expect(result.statusCode).toEqual(400);
  });

  it('Fails with bad fields in request', async () => {
    mockJwtWithAddress();

    const authTokens = genAuthTokens();

    const result = await request(await setupApp())
      .post('/github')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ foobar: 'yeet' });

    expect(result.statusCode).toEqual(400);
  });

  it('Fails with invalid code', async () => {
    mockJwtWithAddress();
    mockedRequestGithubOAuthToken.mockRejectedValue(new Error('error'));

    const authTokens = genAuthTokens();

    const result = await request(await setupApp())
      .post('/github')
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
      .post('/github')
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
    mockedUpsertUser.mockResolvedValue({ id: userId } as any);
    contextMock.prisma.authToken.update.mockResolvedValue({
      generation: authTokenGeneration,
    } as any);
    mockedAddGithubLoginForAddress.mockResolvedValue(undefined);

    const authTokens = genAuthTokens();

    const result = await request(await setupApp())
      .post('/github')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ code });

    expect(result.statusCode).toEqual(200);

    const { accessToken, refreshToken } = <UserAuthTokens>JSON.parse(result.text);

    expect(getAccessTokenPayload(verify(accessToken, JWT_SECRET))).toEqual(
      expect.objectContaining({
        authTokenId,
        addressId,
        address,
        ensName,
        ensAvatarImageUrl,
        githubId,
        githubHandle,
      }),
    );

    expect(getRefreshTokenPayload(verify(refreshToken, JWT_SECRET))).toEqual(
      expect.objectContaining({
        authTokenId,
        addressId,
        generation: authTokenGeneration,
      }),
    );

    expect(mockedRequestGithubOAuthToken).toHaveBeenCalledTimes(1);
    expect(mockedRequestGithubOAuthToken).toHaveBeenCalledWith(code);

    expect(mockedGetGithubCurrentUserInfo).toHaveBeenCalledTimes(1);
    expect(mockedGetGithubCurrentUserInfo).toHaveBeenCalledWith(githubToken);

    expect(mockedUpsertUser).toHaveBeenCalledTimes(1);
    expect(mockedUpsertUser).toHaveBeenCalledWith(githubId, githubHandle, githubToken);

    expect(mockedAddGithubLoginForAddress).toHaveBeenCalledTimes(1);
    expect(mockedAddGithubLoginForAddress).toHaveBeenCalledWith(addressId, userId);

    expect(contextMock.prisma.authToken.update).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.authToken.update).toHaveBeenCalledWith({
      where: { id: authTokenId },
      data: {
        generation: { increment: 1 },
        user: { connect: { id: userId } },
      },
      select: { generation: true },
    });
  });
});

describe('DELETE /github', () => {
  it('Fails with no access token provided', async () => {
    const result = await request(await setupApp()).delete('/github');

    expect(result.statusCode).toEqual(400);
  });

  it('Fails with invalid access token', async () => {
    const result = await request(await setupApp())
      .delete('/github')
      .set('Authorization', `Bearer foo`);

    expect(result.statusCode).toEqual(400);
  });

  it('Fails if no GitHub user is connected to the address', async () => {
    contextMock.prisma.authToken.findUnique.mockResolvedValue({
      id: authTokenId,
      address: { ensName, ensAvatarImageUrl },
      user: null,
    } as any);

    const authTokens = genAuthTokens(false);

    const result = await request(await setupApp())
      .delete('/github')
      .set('Authorization', `Bearer ${authTokens.accessToken}`);

    expect(result.statusCode).toEqual(400);

    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledWith({
      where: { id: authTokenId },
      select: {
        id: true,
        address: {
          select: { ensName: true, ensAvatarImageUrl: true },
        },
      },
    });
  });

  it('Succeeds if GitHub user is connected to the address', async () => {
    contextMock.prisma.authToken.findUnique.mockResolvedValue({
      id: authTokenId,
      address: { ensName, ensAvatarImageUrl },
      user: { id: userId },
    } as any);
    mockedRemoveGithubLoginForAddress.mockResolvedValue(undefined);

    const authTokens = genAuthTokens(true);

    const result = await request(await setupApp())
      .delete('/github')
      .set('Authorization', `Bearer ${authTokens.accessToken}`);

    expect(result.statusCode).toEqual(200);

    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledWith({
      where: { id: authTokenId },
      select: {
        id: true,
        address: {
          select: { ensName: true, ensAvatarImageUrl: true },
        },
      },
    });

    /* Expect that the token is updated to remove the user */
    expect(contextMock.prisma.authToken.update).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.authToken.update).toHaveBeenCalledWith({
      where: { id: authTokenId },
      data: {
        generation: { increment: 1 },
        user: { disconnect: true },
      },
      select: { generation: true },
    });

    expect(mockedRemoveGithubLoginForAddress).toHaveBeenCalledTimes(1);
    expect(mockedRemoveGithubLoginForAddress).toHaveBeenCalledWith(addressId);
  });
});
