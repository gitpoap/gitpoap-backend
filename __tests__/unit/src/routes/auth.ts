import '../../../../__mocks__/src/logging';
import { contextMock } from '../../../../__mocks__/src/context';
import request from 'supertest';
import { setupApp } from '../../../../src/app';
import { isAuthSignatureDataValid } from '../../../../src/lib/signatures';
import { resolveAddress } from '../../../../src/lib/ens';
import { isGithubTokenValidForUser } from '../../../../src/external/github';
import { sign, verify } from 'jsonwebtoken';
import { JWT_SECRET } from '../../../../src/environment';
import {
  UserAuthTokens,
  getAccessTokenPayload,
  getRefreshTokenPayload,
} from '../../../../src/types/authTokens';
import { removeUsersGithubOAuthToken } from '../../../../src/lib/users';
import { removeGithubLoginForAddress } from '../../../../src/lib/addresses';
import { generateAuthTokens } from '../../../../src/lib/authTokens';
import { DateTime } from 'luxon';
import { LOGIN_EXP_TIME_MONTHS } from '../../../../src/constants';

jest.mock('../../../../src/logging');
jest.mock('../../../../src/lib/signatures');
jest.mock('../../../../src/lib/ens');
jest.mock('../../../../src/lib/users');
jest.mock('../../../../src/lib/addresses');
jest.mock('../../../../src/external/github');

const mockedIsAuthSignatureDataValid = jest.mocked(isAuthSignatureDataValid, true);
const mockedIsGithubTokenValidForUser = jest.mocked(isGithubTokenValidForUser, true);
const mockedRemoveUsersGithubOAuthToken = jest.mocked(removeUsersGithubOAuthToken, true);
const mockedRemoveGithubLoginForAddress = jest.mocked(removeGithubLoginForAddress, true);

const authTokenId = 905;
const authTokenGeneration = 82;
const addressId = 22;
const address = '0xburzyBurz';
const addressLower = address.toLowerCase();
const ensName = null;
const ensAvatarImageUrl = null;
const signatureData = {
  signature: 'John Hancock',
  message: 'The pen is mightier than the sword',
  createdAt: 3423423425,
};
const userId = 3233;
const githubId = 23422222;
const githubHandle = 'john-wayne-gacy';
const githubOAuthToken = 'im_super_spooky';

function validatePayloads(
  payload: string,
  expectedGithubId: number | null,
  expectedGithubHandle: string | null,
  expectedGeneration: number,
) {
  const { accessToken, refreshToken } = <UserAuthTokens>JSON.parse(payload);

  expect(getAccessTokenPayload(verify(accessToken, JWT_SECRET))).toEqual(
    expect.objectContaining({
      authTokenId,
      addressId,
      address: addressLower,
      ensName,
      ensAvatarImageUrl,
      githubId: expectedGithubId,
      githubHandle: expectedGithubHandle,
    }),
  );

  expect(getRefreshTokenPayload(verify(refreshToken, JWT_SECRET))).toEqual(
    expect.objectContaining({
      authTokenId,
      addressId,
      generation: expectedGeneration,
    }),
  );
}

describe('POST /auth', () => {
  it('Fails with invalid body', async () => {
    const result = await request(await setupApp())
      .post('/auth')
      .send({ address });

    expect(result.statusCode).toEqual(400);
  });

  it('Fails with invalid signature', async () => {
    mockedIsAuthSignatureDataValid.mockReturnValue(false);

    const result = await request(await setupApp())
      .post('/auth')
      .send({ address, signatureData });

    expect(result.statusCode).toEqual(401);

    expect(mockedIsAuthSignatureDataValid).toHaveBeenCalledTimes(1);
    expect(mockedIsAuthSignatureDataValid).toHaveBeenCalledWith(address, signatureData);
  });

  const expectAddressUpsert = () => {
    expect(contextMock.prisma.address.upsert).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.address.upsert).toHaveBeenCalledWith({
      where: {
        ethAddress: addressLower,
      },
      update: {},
      create: {
        ethAddress: addressLower,
      },
      select: {
        id: true,
        ensName: true,
        ensAvatarImageUrl: true,
        githubUser: {
          select: {
            id: true,
            githubId: true,
            githubHandle: true,
            githubOAuthToken: true,
          },
        },
      },
    });
  };

  it("Doesn't check GitHub login info when Address isn't associated with a User", async () => {
    mockedIsAuthSignatureDataValid.mockReturnValue(true);
    contextMock.prisma.address.upsert.mockResolvedValue({
      id: addressId,
      ensName,
      ensAvatarImageUrl,
      githubUser: null,
    } as any);
    contextMock.prisma.authToken.create.mockResolvedValue({
      id: authTokenId,
      generation: authTokenGeneration,
    } as any);

    const result = await request(await setupApp())
      .post('/auth')
      .send({ address, signatureData });

    expect(result.statusCode).toEqual(200);

    validatePayloads(result.text, null, null, authTokenGeneration);

    expect(mockedIsAuthSignatureDataValid).toHaveBeenCalledTimes(1);
    expect(mockedIsAuthSignatureDataValid).toHaveBeenCalledWith(address, signatureData);

    expectAddressUpsert();

    expect(mockedIsGithubTokenValidForUser).toHaveBeenCalledTimes(0);

    expect(contextMock.prisma.authToken.create).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.authToken.create).toHaveBeenCalledWith({
      data: {
        address: {
          connect: {
            id: addressId,
          },
        },
        user: undefined,
      },
      select: {
        id: true,
        generation: true,
      },
    });
  });

  it("Returns GitHub login info when user's login is still valid", async () => {
    mockedIsAuthSignatureDataValid.mockReturnValue(true);
    contextMock.prisma.address.upsert.mockResolvedValue({
      id: addressId,
      ensName,
      ensAvatarImageUrl,
      githubUser: {
        id: userId,
        githubId,
        githubHandle,
        githubOAuthToken,
      },
    } as any);
    mockedIsGithubTokenValidForUser.mockResolvedValue(true);
    contextMock.prisma.authToken.create.mockResolvedValue({
      id: authTokenId,
      generation: authTokenGeneration,
    } as any);

    const result = await request(await setupApp())
      .post('/auth')
      .send({ address, signatureData });

    expect(result.statusCode).toEqual(200);

    validatePayloads(result.text, githubId, githubHandle, authTokenGeneration);

    expect(mockedIsAuthSignatureDataValid).toHaveBeenCalledTimes(1);
    expect(mockedIsAuthSignatureDataValid).toHaveBeenCalledWith(address, signatureData);

    expectAddressUpsert();

    expect(mockedIsGithubTokenValidForUser).toHaveBeenCalledTimes(1);
    expect(mockedIsGithubTokenValidForUser).toHaveBeenCalledWith(githubOAuthToken, githubId);

    expect(mockedRemoveUsersGithubOAuthToken).toHaveBeenCalledTimes(0);

    expect(contextMock.prisma.authToken.create).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.authToken.create).toHaveBeenCalledWith({
      data: {
        address: {
          connect: {
            id: addressId,
          },
        },
        user: {
          connect: {
            githubId: githubId,
          },
        },
      },
      select: {
        id: true,
        generation: true,
      },
    });
  });

  it("Removes GitHub login info when user's login is invalid", async () => {
    mockedIsAuthSignatureDataValid.mockReturnValue(true);
    contextMock.prisma.address.upsert.mockResolvedValue({
      id: addressId,
      ensName,
      ensAvatarImageUrl,
      githubUser: {
        id: userId,
        githubId,
        githubHandle,
        githubOAuthToken,
      },
    } as any);
    mockedIsGithubTokenValidForUser.mockResolvedValue(false);
    contextMock.prisma.authToken.create.mockResolvedValue({
      id: authTokenId,
      generation: authTokenGeneration,
    } as any);

    const result = await request(await setupApp())
      .post('/auth')
      .send({ address, signatureData });

    expect(result.statusCode).toEqual(200);

    validatePayloads(result.text, null, null, authTokenGeneration);

    expect(mockedIsAuthSignatureDataValid).toHaveBeenCalledTimes(1);
    expect(mockedIsAuthSignatureDataValid).toHaveBeenCalledWith(address, signatureData);

    expectAddressUpsert();

    expect(mockedIsGithubTokenValidForUser).toHaveBeenCalledTimes(1);
    expect(mockedIsGithubTokenValidForUser).toHaveBeenCalledWith(githubOAuthToken, githubId);

    expect(mockedRemoveUsersGithubOAuthToken).toHaveBeenCalledTimes(1);
    expect(mockedRemoveUsersGithubOAuthToken).toHaveBeenCalledWith(userId);

    expect(mockedRemoveGithubLoginForAddress).toHaveBeenCalledTimes(1);
    expect(mockedRemoveGithubLoginForAddress).toHaveBeenCalledWith(addressId);

    expect(contextMock.prisma.authToken.create).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.authToken.create).toHaveBeenCalledWith({
      data: {
        address: {
          connect: {
            id: addressId,
          },
        },
        user: undefined,
      },
      select: {
        id: true,
        generation: true,
      },
    });
  });
});

function genRefreshToken() {
  return generateAuthTokens(
    authTokenId,
    authTokenGeneration,
    addressId,
    address,
    ensName,
    ensAvatarImageUrl,
    null,
    null,
  ).refreshToken;
}

describe('POST /auth/refresh', () => {
  it('Fails with invalid body', async () => {
    const result = await request(await setupApp())
      .post('/auth/refresh')
      .send({ tokn: 'foo' });

    expect(result.statusCode).toEqual(400);
  });

  it('Fails with invalid RefreshToken', async () => {
    const result = await request(await setupApp())
      .post('/auth/refresh')
      .send({ token: 'fooooooooo' });

    expect(result.statusCode).toEqual(401);

    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledTimes(0);
  });

  it('Fails with invalid RefreshTokenPayload', async () => {
    const token = sign({ foo: 'bar' }, JWT_SECRET);

    const result = await request(await setupApp())
      .post('/auth/refresh')
      .send({ token });

    expect(result.statusCode).toEqual(401);

    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledTimes(0);
  });

  const expectAuthTokenLookup = () => {
    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledWith({
      where: {
        id: authTokenId,
      },
      select: {
        createdAt: true,
        generation: true,
        address: {
          select: {
            id: true,
            ethAddress: true,
            ensName: true,
            ensAvatarImageUrl: true,
          },
        },
        user: {
          select: {
            id: true,
            githubId: true,
            githubHandle: true,
            githubOAuthToken: true,
          },
        },
      },
    });
  };

  it('Fails when AuthToken is not found', async () => {
    contextMock.prisma.authToken.findUnique.mockResolvedValue(null);

    const token = genRefreshToken();

    const result = await request(await setupApp())
      .post('/auth/refresh')
      .send({ token });

    expect(result.statusCode).toEqual(401);

    expectAuthTokenLookup();
  });

  const mockAuthTokenLookup = (createdAt: Date, generation: number, hasUser: boolean = false) => {
    let user = null;
    if (hasUser) {
      user = {
        id: userId,
        githubId,
        githubHandle,
        githubOAuthToken,
      };
    }

    contextMock.prisma.authToken.findUnique.mockResolvedValue({
      createdAt,
      generation,
      address: {
        id: addressId,
        ethAddress: addressLower,
        ensName,
        ensAvatarImageUrl,
      },
      user,
    } as any);
  };

  it('Fails when AuthToken generation is invalid', async () => {
    mockAuthTokenLookup(DateTime.utc().toJSDate(), authTokenGeneration + 2);

    const token = genRefreshToken();

    const result = await request(await setupApp())
      .post('/auth/refresh')
      .send({ token });

    expect(result.statusCode).toEqual(401);

    expectAuthTokenLookup();

    expect(contextMock.prisma.authToken.delete).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.authToken.delete).toHaveBeenCalledWith({
      where: {
        id: authTokenId,
      },
    });
  });

  it('Fails when AuthToken is too old', async () => {
    mockAuthTokenLookup(
      DateTime.utc()
        .minus({ months: LOGIN_EXP_TIME_MONTHS + 1 })
        .toJSDate(),
      authTokenGeneration,
    );

    const token = genRefreshToken();

    const result = await request(await setupApp())
      .post('/auth/refresh')
      .send({ token });

    expect(result.statusCode).toEqual(401);

    expectAuthTokenLookup();

    expect(contextMock.prisma.authToken.delete).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.authToken.delete).toHaveBeenCalledWith({
      where: {
        id: authTokenId,
      },
    });
  });

  const expectAuthTokenUpdate = () => {
    expect(contextMock.prisma.authToken.update).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.authToken.update).toHaveBeenCalledWith({
      where: {
        id: authTokenId,
      },
      data: {
        generation: { increment: 1 },
      },
      select: {
        generation: true,
      },
    });
  };

  it("Doesn't check GitHub login info when AuthToken isn't associated with a User", async () => {
    mockAuthTokenLookup(DateTime.utc().toJSDate(), authTokenGeneration, false);
    const nextGeneration = authTokenGeneration + 1;
    contextMock.prisma.authToken.update.mockResolvedValue({
      generation: nextGeneration,
    } as any);

    const token = genRefreshToken();

    const result = await request(await setupApp())
      .post('/auth/refresh')
      .send({ token });

    expect(result.statusCode).toEqual(200);

    validatePayloads(result.text, null, null, nextGeneration);

    expectAuthTokenLookup();

    expect(contextMock.prisma.authToken.delete).toHaveBeenCalledTimes(0);

    expectAuthTokenUpdate();

    expect(mockedIsGithubTokenValidForUser).toHaveBeenCalledTimes(0);
  });

  it("Returns GitHub login info when user's login is still valid", async () => {
    mockAuthTokenLookup(DateTime.utc().toJSDate(), authTokenGeneration, true);
    mockedIsGithubTokenValidForUser.mockResolvedValue(true);
    const nextGeneration = authTokenGeneration + 1;
    contextMock.prisma.authToken.update.mockResolvedValue({
      generation: nextGeneration,
    } as any);

    const token = genRefreshToken();

    const result = await request(await setupApp())
      .post('/auth/refresh')
      .send({ token });

    expect(result.statusCode).toEqual(200);

    validatePayloads(result.text, githubId, githubHandle, nextGeneration);

    expectAuthTokenLookup();

    expect(contextMock.prisma.authToken.delete).toHaveBeenCalledTimes(0);

    expectAuthTokenUpdate();

    expect(mockedIsGithubTokenValidForUser).toHaveBeenCalledTimes(1);
    expect(mockedIsGithubTokenValidForUser).toHaveBeenCalledWith(githubOAuthToken, githubId);

    expect(mockedRemoveUsersGithubOAuthToken).toHaveBeenCalledTimes(0);
  });

  it("Removes GitHub login info when user's login is invalid", async () => {
    mockAuthTokenLookup(DateTime.utc().toJSDate(), authTokenGeneration, true);
    mockedIsGithubTokenValidForUser.mockResolvedValue(false);
    const nextGeneration = authTokenGeneration + 1;
    contextMock.prisma.authToken.update.mockResolvedValue({
      generation: nextGeneration,
    } as any);

    const token = genRefreshToken();

    const result = await request(await setupApp())
      .post('/auth/refresh')
      .send({ token });

    expect(result.statusCode).toEqual(200);

    validatePayloads(result.text, null, null, nextGeneration);

    expectAuthTokenLookup();

    expect(contextMock.prisma.authToken.delete).toHaveBeenCalledTimes(0);

    expectAuthTokenUpdate();

    expect(mockedIsGithubTokenValidForUser).toHaveBeenCalledTimes(1);
    expect(mockedIsGithubTokenValidForUser).toHaveBeenCalledWith(githubOAuthToken, githubId);

    expect(mockedRemoveUsersGithubOAuthToken).toHaveBeenCalledTimes(1);
    expect(mockedRemoveUsersGithubOAuthToken).toHaveBeenCalledWith(userId);

    expect(mockedRemoveGithubLoginForAddress).toHaveBeenCalledTimes(1);
    expect(mockedRemoveGithubLoginForAddress).toHaveBeenCalledWith(addressId);
  });
});
