import '../../../../__mocks__/src/logging';
import { contextMock } from '../../../../__mocks__/src/context';
import request from 'supertest';
import { setupApp } from '../../../../__mocks__/src/app';
import { isAuthSignatureDataValid } from '../../../../src/lib/signatures';
import { sign } from 'jsonwebtoken';
import { JWT_SECRET } from '../../../../src/environment';
import { RefreshTokenPayload } from '../../../../src/types/authTokens';
import { upsertAddress } from '../../../../src/lib/addresses';
import {
  deleteAuthToken,
  generateAuthTokensWithChecks,
  generateNewAuthTokens,
  updateAuthTokenGeneration,
} from '../../../../src/lib/authTokens';
import { DateTime } from 'luxon';
import { LOGIN_EXP_TIME_MONTHS } from '../../../../src/constants';

jest.mock('../../../../src/logging');
jest.mock('../../../../src/lib/signatures');
jest.mock('../../../../src/lib/ens');
jest.mock('../../../../src/lib/addresses');
jest.mock('../../../../src/lib/authTokens');

const mockedIsAuthSignatureDataValid = jest.mocked(isAuthSignatureDataValid, true);
const mockedUpsertAddress = jest.mocked(upsertAddress, true);
const mockedGenerateAuthTokensWithChecks = jest.mocked(generateAuthTokensWithChecks, true);
const mockedGenerateNewAuthTokens = jest.mocked(generateNewAuthTokens, true);
const mockedDeleteAuthToken = jest.mocked(deleteAuthToken, true);
const mockedUpdateAuthTokenGeneration = jest.mocked(updateAuthTokenGeneration, true);

const authTokenId = 905;
const authTokenGeneration = 82;
const addressId = 22;
const address = '0xburzyBurz';
const addressLower = address.toLowerCase();
const signatureData = {
  signature: 'John Hancock',
  message: 'The pen is mightier than the sword',
  createdAt: 3423423425,
};

const authTokens = { accessToken: 'foo', refreshToken: 'bar' };

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

  it('Succeeds when signature is valid', async () => {
    mockedIsAuthSignatureDataValid.mockReturnValue(true);
    mockedUpsertAddress.mockResolvedValue({ id: addressId } as any);
    mockedGenerateNewAuthTokens.mockResolvedValue(authTokens);

    const result = await request(await setupApp())
      .post('/auth')
      .send({ address, signatureData });

    expect(result.statusCode).toEqual(200);
    expect(result.body).toEqual(authTokens);

    expect(mockedIsAuthSignatureDataValid).toHaveBeenCalledTimes(1);
    expect(mockedIsAuthSignatureDataValid).toHaveBeenCalledWith(address, signatureData);

    expect(mockedUpsertAddress).toHaveBeenCalledTimes(1);
    expect(mockedUpsertAddress).toHaveBeenCalledWith(address);

    expect(mockedGenerateNewAuthTokens).toHaveBeenCalledTimes(1);
    expect(mockedGenerateNewAuthTokens).toHaveBeenCalledWith(addressId);
  });
});

function genRefreshToken() {
  const payload: RefreshTokenPayload = {
    authTokenId,
    addressId,
    generation: authTokenGeneration,
  };

  return sign(payload, JWT_SECRET);
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

  const mockAuthTokenLookup = (createdAt: Date, generation: number) => {
    contextMock.prisma.authToken.findUnique.mockResolvedValue({
      createdAt,
      generation,
      address: {
        id: addressId,
        ethAddress: addressLower,
      },
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

    expect(mockedDeleteAuthToken).toHaveBeenCalledTimes(1);
    expect(mockedDeleteAuthToken).toHaveBeenCalledWith(authTokenId);
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

    expect(mockedDeleteAuthToken).toHaveBeenCalledTimes(1);
    expect(mockedDeleteAuthToken).toHaveBeenCalledWith(authTokenId);
  });

  it("Succeeds when token isn't expired", async () => {
    mockAuthTokenLookup(DateTime.utc().toJSDate(), authTokenGeneration);
    const nextGeneration = authTokenGeneration + 1;
    const fakeAddress = { yeet: 'yesssir' };
    mockedUpdateAuthTokenGeneration.mockResolvedValue({
      generation: nextGeneration,
      address: fakeAddress,
    } as any);
    mockedGenerateAuthTokensWithChecks.mockResolvedValue(authTokens);

    const token = genRefreshToken();

    const result = await request(await setupApp())
      .post('/auth/refresh')
      .send({ token });

    expect(result.statusCode).toEqual(200);
    expect(result.body).toEqual(authTokens);

    expectAuthTokenLookup();

    expect(mockedDeleteAuthToken).toHaveBeenCalledTimes(0);

    expect(mockedUpdateAuthTokenGeneration).toHaveBeenCalledTimes(1);
    expect(mockedUpdateAuthTokenGeneration).toHaveBeenCalledWith(authTokenId);

    expect(mockedGenerateAuthTokensWithChecks).toHaveBeenCalledTimes(1);
    expect(mockedGenerateAuthTokensWithChecks).toHaveBeenCalledWith(
      authTokenId,
      nextGeneration,
      fakeAddress,
    );
  });
});
