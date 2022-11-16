import '../../../../__mocks__/src/logging';
import { contextMock } from '../../../../__mocks__/src/context';
import request from 'supertest';
import { setupApp } from '../../../../__mocks__/src/app';
import {
  requestDiscordOAuthToken,
  getDiscordCurrentUserInfo,
} from '../../../../src/external/discord';
import {
  addDiscordLoginForAddress,
  removeDiscordLoginForAddress,
} from '../../../../src/lib/addresses';
import { upsertDiscordUser } from '../../../../src/lib/discordUsers';
import { generateAuthTokens } from '../../../../src/lib/authTokens';
import { verify } from 'jsonwebtoken';
import { JWT_SECRET } from '../../../../src/environment';
import {
  UserAuthTokens,
  getAccessTokenPayload,
  getRefreshTokenPayload,
} from '../../../../src/types/authTokens';

jest.mock('../../../../src/logging');
jest.mock('../../../../src/external/discord');
jest.mock('../../../../src/lib/discordUsers');
jest.mock('../../../../src/lib/addresses');

const mockedRequestDiscordOAuthToken = jest.mocked(requestDiscordOAuthToken, true);
const mockedGetDiscordCurrentUserInfo = jest.mocked(getDiscordCurrentUserInfo, true);
const mockedUpsertDiscordUser = jest.mocked(upsertDiscordUser, true);
const mockedAddDiscordLoginForAddress = jest.mocked(addDiscordLoginForAddress, true);
const mockedRemoveDiscordLoginForAddress = jest.mocked(removeDiscordLoginForAddress, true);

const authTokenId = 995;
const authTokenGeneration = 42;
const addressId = 322;
const address = '0xbArF00';
const ensName = null;
const ensAvatarImageUrl = null;
const code = '243lkjlkjdfs';
const discordToken = {
  token_type: 'Bear',
  access_token: 'fooajldkfjlskj32f',
};
const discordId = 2342;
const discordHandle = 'snoop-doggy-dog';
const discordUserId = 342444;

function mockJwtWithAddress() {
  contextMock.prisma.authToken.findUnique.mockResolvedValue({
    id: authTokenId,
    address: { ensName, ensAvatarImageUrl },
  } as any);
}

function genAuthTokens(hasDiscord = false) {
  return generateAuthTokens(
    authTokenId,
    authTokenGeneration,
    addressId,
    address,
    ensName,
    ensAvatarImageUrl,
    hasDiscord ? discordId : null,
    hasDiscord ? discordHandle : null,
  );
}

describe('POST /discord', () => {
  it('Fails with no access token provided', async () => {
    const result = await request(await setupApp())
      .post('/discord')
      .send({ code });

    expect(result.statusCode).toEqual(400);
  });

  it('Fails with bad fields in request', async () => {
    mockJwtWithAddress();

    const authTokens = genAuthTokens();

    const result = await request(await setupApp())
      .post('/discord')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ foobar: 'yeet' });

    expect(result.statusCode).toEqual(400);
  });

  it('Fails with invalid code', async () => {
    mockJwtWithAddress();
    mockedRequestDiscordOAuthToken.mockRejectedValue(new Error('error'));

    const authTokens = genAuthTokens();

    const result = await request(await setupApp())
      .post('/discord')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ code });

    expect(result.statusCode).toEqual(400);

    expect(mockedRequestDiscordOAuthToken).toHaveBeenCalledTimes(1);
    expect(mockedRequestDiscordOAuthToken).toHaveBeenCalledWith(code);
  });

  it('Fails if current discord user lookup fails', async () => {
    mockJwtWithAddress();
    mockedRequestDiscordOAuthToken.mockResolvedValue(discordToken);
    mockedGetDiscordCurrentUserInfo.mockResolvedValue(null);

    const authTokens = genAuthTokens();

    const result = await request(await setupApp())
      .post('/discord')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ code });

    expect(result.statusCode).toEqual(500);

    expect(mockedRequestDiscordOAuthToken).toHaveBeenCalledTimes(1);
    expect(mockedRequestDiscordOAuthToken).toHaveBeenCalledWith(code);

    expect(mockedGetDiscordCurrentUserInfo).toHaveBeenCalledTimes(1);
    expect(mockedGetDiscordCurrentUserInfo).toHaveBeenCalledWith(discordToken);
  });

  it('Returns UserAuthTokens on success', async () => {
    mockJwtWithAddress();
    mockedRequestDiscordOAuthToken.mockResolvedValue(discordToken);
    mockedGetDiscordCurrentUserInfo.mockResolvedValue({
      id: discordId,
      username: discordHandle,
    } as any);
    mockedUpsertDiscordUser.mockResolvedValue({ id: discordUserId } as any);
    contextMock.prisma.authToken.update.mockResolvedValue({
      generation: authTokenGeneration,
    } as any);
    mockedAddDiscordLoginForAddress.mockResolvedValue(undefined);

    const authTokens = genAuthTokens();

    const result = await request(await setupApp())
      .post('/discord')
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
      }),
    );

    expect(getRefreshTokenPayload(verify(refreshToken, JWT_SECRET))).toEqual(
      expect.objectContaining({
        authTokenId,
        addressId,
        generation: authTokenGeneration,
      }),
    );

    expect(mockedRequestDiscordOAuthToken).toHaveBeenCalledTimes(1);
    expect(mockedRequestDiscordOAuthToken).toHaveBeenCalledWith(code);

    expect(mockedGetDiscordCurrentUserInfo).toHaveBeenCalledTimes(1);
    expect(mockedGetDiscordCurrentUserInfo).toHaveBeenCalledWith(discordToken);

    expect(mockedUpsertDiscordUser).toHaveBeenCalledTimes(1);
    expect(mockedUpsertDiscordUser).toHaveBeenCalledWith(
      discordId,
      discordHandle,
      discordToken.access_token,
    );

    expect(mockedAddDiscordLoginForAddress).toHaveBeenCalledTimes(1);
    expect(mockedAddDiscordLoginForAddress).toHaveBeenCalledWith(addressId, discordUserId);

    expect(contextMock.prisma.authToken.update).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.authToken.update).toHaveBeenCalledWith({
      where: { id: authTokenId },
      data: {
        generation: { increment: 1 },
        discordUser: { connect: { id: discordUserId } },
      },
      select: { generation: true },
    });
  });
});

describe('DELETE /discord', () => {
  it('Fails with no access token provided', async () => {
    const result = await request(await setupApp()).delete('/discord');

    expect(result.statusCode).toEqual(400);
  });

  it('Fails with invalid access token', async () => {
    const result = await request(await setupApp())
      .delete('/discord')
      .set('Authorization', `Bearer foo`);

    expect(result.statusCode).toEqual(400);
  });

  it('Succeeds if discord user is connected to the address', async () => {
    contextMock.prisma.authToken.findUnique.mockResolvedValue({
      id: authTokenId,
      address: { ensName, ensAvatarImageUrl },
      discordUser: { id: discordUserId },
    } as any);
    mockedRemoveDiscordLoginForAddress.mockResolvedValue(undefined);

    const authTokens = genAuthTokens(true);

    const result = await request(await setupApp())
      .delete('/discord')
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
        discordUser: { disconnect: true },
      },
      select: { generation: true },
    });

    expect(mockedRemoveDiscordLoginForAddress).toHaveBeenCalledTimes(1);
    expect(mockedRemoveDiscordLoginForAddress).toHaveBeenCalledWith(addressId);
  });
});
