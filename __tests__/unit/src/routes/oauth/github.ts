import '../../../../../__mocks__/src/logging';
import { contextMock } from '../../../../../__mocks__/src/context';
import request from 'supertest';
import { setupApp } from '../../../../../__mocks__/src/app';
import {
  requestGithubOAuthToken,
  getGithubCurrentUserInfo,
} from '../../../../../src/external/github';
import { upsertGithubUser, removeGithubUsersLogin } from '../../../../../src/lib/githubUsers';
import { generateNewAuthTokens } from '../../../../../src/lib/authTokens';
import { setupGenAuthTokens } from '../../../../../__mocks__/src/lib/authTokens';

jest.mock('../../../../../src/logging');
jest.mock('../../../../../src/external/github');
jest.mock('../../../../../src/lib/githubUsers');
jest.mock('../../../../../src/lib/addresses');
jest.mock('../../../../../src/lib/authTokens', () => ({
  __esModule: true,
  ...(<any>jest.requireActual('../../../../../src/lib/authTokens')),
  generateNewAuthTokens: jest.fn(),
}));

const mockedRequestGithubOAuthToken = jest.mocked(requestGithubOAuthToken, true);
const mockedGetGithubCurrentUserInfo = jest.mocked(getGithubCurrentUserInfo, true);
const mockedUpsertGithubUser = jest.mocked(upsertGithubUser, true);
const mockedRemoveGithubUsersLogin = jest.mocked(removeGithubUsersLogin, true);
const mockedGenerateNewAuthTokens = jest.mocked(generateNewAuthTokens, true);

const privyUserId = 'imma user';
const addressId = 322;
const ethAddress = '0xbArF00';
const ensName = null;
const ensAvatarImageUrl = null;
const code = '243lkjlkjdfs';
const githubToken = 'fooajldkfjlskj32f';
const githubUserId = 342444;
const githubId = 2342;
const githubHandle = 'snoop-doggy-dog';

function mockJwtWithAddress() {
  contextMock.prisma.address.findUnique.mockResolvedValue({
    ensName,
    ensAvatarImageUrl,
    memberships: [],
  } as any);
}

const genAuthTokens = setupGenAuthTokens({
  privyUserId,
  addressId,
  ethAddress,
  ensName,
  ensAvatarImageUrl,
  githubId,
  githubHandle,
});

describe('POST /oauth/github', () => {
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
    const fakeAuthTokens = { accessToken: 'foo' };
    mockedGenerateNewAuthTokens.mockResolvedValue(fakeAuthTokens);

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

    expect(generateNewAuthTokens).toHaveBeenCalledTimes(1);
    expect(generateNewAuthTokens).toHaveBeenCalledWith({
      ...authTokens.accessTokenPayload,
      github: {
        id: githubUserId,
        githubId,
        githubHandle,
        githubOAuthToken: githubToken,
      },
    });
  });
});

describe('DELETE /oauth/github', () => {
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

  it('Fails if no GitHub user is connected to the address', async () => {
    const authTokens = genAuthTokens({ hasGithub: false });

    const result = await request(await setupApp())
      .delete('/oauth/github')
      .set('Authorization', `Bearer ${authTokens.accessToken}`);

    expect(result.statusCode).toEqual(401);

    expect(mockedRemoveGithubUsersLogin).toHaveBeenCalledTimes(0);
  });

  it('Succeeds if GitHub user is connected to the address', async () => {
    const fakeAuthTokens = { accessToken: 'yeet', refreshToken: 'yolo' };
    mockedGenerateNewAuthTokens.mockResolvedValue(fakeAuthTokens);

    const authTokens = genAuthTokens({ hasGithub: true });

    const result = await request(await setupApp())
      .delete('/oauth/github')
      .set('Authorization', `Bearer ${authTokens.accessToken}`);

    expect(result.statusCode).toEqual(200);
    expect(result.body).toEqual(fakeAuthTokens);

    expect(mockedRemoveGithubUsersLogin).toHaveBeenCalledTimes(0);
    expect(mockedRemoveGithubUsersLogin).toHaveBeenCalledWith(githubUserId);

    expect(mockedGenerateNewAuthTokens).toHaveBeenCalledTimes(1);
    expect(mockedGenerateNewAuthTokens).toHaveBeenCalledWith({
      ...authTokens.accessTokenPayload,
      github: null,
    });
  });
});
