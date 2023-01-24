import '../../../../__mocks__/src/logging';
import request from 'supertest';
import { setupApp } from '../../../../__mocks__/src/app';
import { generateNewAuthTokens } from '../../../../src/lib/authTokens';
import { verifyPrivyToken } from '../../../../src/lib/privy';

jest.mock('../../../../src/logging');
jest.mock('../../../../src/lib/authTokens');
jest.mock('../../../../src/lib/privy');

const mockedGenerateNewAuthTokens = jest.mocked(generateNewAuthTokens, true);
const mockedVerifyPrivyToken = jest.mocked(verifyPrivyToken, true);

const privyToken = 'im-a-privy-cool-person';
const fakePrivyUserData = { fake: 'data' };
const authTokens = { accessToken: 'foo' };

describe('POST /auth', () => {
  it('Fails with invalid body', async () => {
    const result = await request(await setupApp())
      .post('/auth')
      .send({ body: 'missing' });

    expect(result.statusCode).toEqual(400);

    expect(mockedVerifyPrivyToken).toHaveBeenCalledTimes(0);
  });

  it("Fails when the Privy token can't be validated", async () => {
    mockedVerifyPrivyToken.mockResolvedValue(null);

    const result = await request(await setupApp())
      .post('/auth')
      .send({ privyToken });

    expect(result.statusCode).toEqual(401);

    expect(mockedVerifyPrivyToken).toHaveBeenCalledTimes(1);
    expect(mockedVerifyPrivyToken).toHaveBeenCalledWith(privyToken);

    expect(mockedGenerateNewAuthTokens).toHaveBeenCalledTimes(0);
  });

  it('Returns new auth tokens when privy validation is successful', async () => {
    mockedVerifyPrivyToken.mockResolvedValue(fakePrivyUserData as any);
    mockedGenerateNewAuthTokens.mockResolvedValue(authTokens);

    const result = await request(await setupApp())
      .post('/auth')
      .send({ privyToken });

    expect(result.statusCode).toEqual(200);
    expect(result.body).toEqual(authTokens);

    expect(mockedVerifyPrivyToken).toHaveBeenCalledTimes(1);
    expect(mockedVerifyPrivyToken).toHaveBeenCalledWith(privyToken);

    expect(mockedGenerateNewAuthTokens).toHaveBeenCalledTimes(1);
    expect(mockedGenerateNewAuthTokens).toHaveBeenCalledWith(fakePrivyUserData);
  });
});
