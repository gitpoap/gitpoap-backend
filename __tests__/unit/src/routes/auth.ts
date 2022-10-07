import { contextMock } from '../../../../__mocks__/src/context';
import request from 'supertest';
import { setupApp } from '../../../../src/app';
import { isSignatureValid } from '../../../../src/lib/signatures';
import { resolveAddress } from '../../../../src/lib/ens';
import { isGithubTokenValidForUser } from '../../../../src/external/github';
import { verify } from 'jsonwebtoken';
import { JWT_SECRET } from '../../../../src/environment';
import {
  UserAuthTokens,
  getAccessTokenPayload,
  getRefreshTokenPayload,
} from '../../../../src/types/authTokens';
import { removeUsersGithubOAuthToken } from '../../../../src/lib/users';
import { removeGithubLoginForAddress } from '../../../../src/lib/addresses';

jest.mock('../../../../src/lib/signatures');
jest.mock('../../../../src/lib/ens');
jest.mock('../../../../src/lib/users');
jest.mock('../../../../src/lib/addresses');
jest.mock('../../../../src/external/github');

const mockedIsSignatureValid = jest.mocked(isSignatureValid, true);
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
const signature = {
  data: 'John Hancock',
  createdAt: 3423423425,
};
const userId = 3233;
const githubId = 23422222;
const githubHandle = 'john-wayne-gacy';
const githubOAuthToken = 'im_super_spooky';

describe('POST /auth', () => {
  it('Fails with invalid body', async () => {
    const result = await request(await setupApp())
      .post('/auth')
      .send({ address });

    expect(result.statusCode).toEqual(400);
  });

  it('Fails with invalid signature', async () => {
    mockedIsSignatureValid.mockReturnValue(false);

    const result = await request(await setupApp())
      .post('/auth')
      .send({ address, signature });

    expect(result.statusCode).toEqual(401);

    expect(mockedIsSignatureValid).toHaveBeenCalledTimes(1);
    expect(mockedIsSignatureValid).toHaveBeenCalledWith(address, 'POST /auth', signature, {
      data: address,
    });
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

  const validatePayload = (
    payload: string,
    expectedGithubId: number | null,
    expectedGithubHandle: string | null,
  ) => {
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
        generation: authTokenGeneration,
      }),
    );
  };

  it("Doesn't check GitHub login info when Address isn't associated with a user", async () => {
    mockedIsSignatureValid.mockReturnValue(true);
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
      .send({ address, signature });

    expect(result.statusCode).toEqual(200);

    validatePayload(result.text, null, null);

    expect(mockedIsSignatureValid).toHaveBeenCalledTimes(1);
    expect(mockedIsSignatureValid).toHaveBeenCalledWith(address, 'POST /auth', signature, {
      data: address,
    });

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
    mockedIsSignatureValid.mockReturnValue(true);
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
      .send({ address, signature });

    expect(result.statusCode).toEqual(200);

    validatePayload(result.text, githubId, githubHandle);

    expect(mockedIsSignatureValid).toHaveBeenCalledTimes(1);
    expect(mockedIsSignatureValid).toHaveBeenCalledWith(address, 'POST /auth', signature, {
      data: address,
    });

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
    mockedIsSignatureValid.mockReturnValue(true);
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
      .send({ address, signature });

    expect(result.statusCode).toEqual(200);

    validatePayload(result.text, null, null);

    expect(mockedIsSignatureValid).toHaveBeenCalledTimes(1);
    expect(mockedIsSignatureValid).toHaveBeenCalledWith(address, 'POST /auth', signature, {
      data: address,
    });

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
