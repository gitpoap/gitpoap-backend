import '../../../../__mocks__/src/logging';
import request from 'supertest';
import { setupApp } from '../../../../__mocks__/src/app';
import { isAuthSignatureDataValid } from '../../../../src/lib/signatures';
import { upsertAddress } from '../../../../src/lib/addresses';
import { generateNewAuthTokens } from '../../../../src/lib/authTokens';

jest.mock('../../../../src/logging');
jest.mock('../../../../src/lib/signatures');
jest.mock('../../../../src/lib/ens');
jest.mock('../../../../src/lib/addresses');
jest.mock('../../../../src/lib/authTokens');

const mockedIsAuthSignatureDataValid = jest.mocked(isAuthSignatureDataValid, true);
const mockedUpsertAddress = jest.mocked(upsertAddress, true);
const mockedGenerateNewAuthTokens = jest.mocked(generateNewAuthTokens, true);

const addressId = 22;
const address = '0xburzyBurz';
const signatureData = {
  signature: 'John Hancock',
  message: 'The pen is mightier than the sword',
  createdAt: 3423423425,
};

const authTokens = { accessToken: 'foo' };

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
