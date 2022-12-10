import '../../../../__mocks__/src/logging';
import { createGQLServer } from '../../../../src/graphql/server';
import { graphqlHTTP } from 'express-graphql';
import { verify } from 'jsonwebtoken';
import { FRONTEND_JWT_SECRET, JWT_SECRET } from '../../../../src/environment';
import set from 'lodash/set';
import { getValidatedAccessTokenPayload } from '../../../../src/lib/authTokens';

jest.mock('../../../../src/logging');
jest.mock('express-graphql');
jest.mock('jsonwebtoken');
jest.mock('lodash/set');
jest.mock('../../../../src/lib/authTokens');

const mockedGraphqlHTTP = jest.mocked(graphqlHTTP, true);
const mockedGraphqlHTTPHandler = jest.fn();
const mockedVerify = jest.mocked(verify, true);
const mockedSet = jest.mocked(set, true);
const mockedGetValidatedAccessTokenPayload = jest.mocked(getValidatedAccessTokenPayload, true);

describe('createGQLServer', () => {
  beforeEach(() => {
    mockedGraphqlHTTP.mockReturnValue(mockedGraphqlHTTPHandler);
  });

  const genMockedReq = (method: string, path: string) => ({ method, path, get: jest.fn() });
  const genMockedRes = () => {
    const send = jest.fn();
    const status = jest.fn();
    status.mockReturnValue({ send });
    return { status };
  };

  it('Skips checking frontend auth on DEV for graphiql', async () => {
    const handler = await createGQLServer();

    expect(mockedGraphqlHTTP).toHaveBeenCalledTimes(1);

    const mockedReq = genMockedReq('GET', '/');

    await handler(mockedReq as any, {} as any, () => ({}));

    expect(mockedGraphqlHTTPHandler).toHaveBeenCalledTimes(1);

    expect(mockedReq.get).toHaveBeenCalledTimes(0);
  });

  const genGeneralSetup = async () => {
    const values = {
      handler: await createGQLServer(),
      mockedReq: genMockedReq('POST', '/'),
      mockedRes: genMockedRes(),
    };

    expect(mockedGraphqlHTTP).toHaveBeenCalledTimes(1);

    return values;
  };

  it('Fails when no auth header is provided', async () => {
    const { handler, mockedReq, mockedRes } = await genGeneralSetup();

    mockedReq.get.mockReturnValue(undefined);

    await handler(mockedReq as any, mockedRes as any, () => ({}));

    expect(mockedGraphqlHTTPHandler).toHaveBeenCalledTimes(0);

    expect(mockedReq.get).toHaveBeenCalledTimes(1);
    expect(mockedReq.get).toHaveBeenCalledWith('authorization');

    expect(mockedRes.status).toHaveBeenCalledTimes(1);
    expect(mockedRes.status).toHaveBeenCalledWith(401);
  });

  it('Fails when the authorization is invalid JSON', async () => {
    const { handler, mockedReq, mockedRes } = await genGeneralSetup();

    mockedReq.get.mockReturnValue('{');

    await handler(mockedReq as any, mockedRes as any, () => ({}));

    expect(mockedReq.get).toHaveBeenCalledTimes(1);
    expect(mockedReq.get).toHaveBeenCalledWith('authorization');

    expect(mockedRes.status).toHaveBeenCalledTimes(1);
    expect(mockedRes.status).toHaveBeenCalledWith(401);

    expect(mockedVerify).toHaveBeenCalledTimes(0);

    expect(mockedGraphqlHTTPHandler).toHaveBeenCalledTimes(0);
  });

  it('Fails when the authorization is missing fields', async () => {
    const { handler, mockedReq, mockedRes } = await genGeneralSetup();

    const frontendToken = 'foobar';
    mockedReq.get.mockReturnValue(
      JSON.stringify({
        frontend: frontendToken,
        user: null,
      }),
    );
    mockedVerify.mockImplementationOnce(() => {
      throw new Error('error');
    });

    await handler(mockedReq as any, mockedRes as any, () => ({}));

    expect(mockedReq.get).toHaveBeenCalledTimes(1);
    expect(mockedReq.get).toHaveBeenCalledWith('authorization');

    expect(mockedRes.status).toHaveBeenCalledTimes(1);
    expect(mockedRes.status).toHaveBeenCalledWith(401);

    expect(mockedVerify).toHaveBeenCalledTimes(1);
    expect(mockedVerify).toHaveBeenCalledWith(frontendToken, FRONTEND_JWT_SECRET);

    expect(mockedGraphqlHTTPHandler).toHaveBeenCalledTimes(0);
  });

  it('Succeeds when frontend token is valid without user token specified', async () => {
    const { handler, mockedReq, mockedRes } = await genGeneralSetup();

    const frontendToken = 'foobar';
    mockedReq.get.mockReturnValue(
      JSON.stringify({
        frontend: frontendToken,
        user: null,
      }),
    );

    await handler(mockedReq as any, mockedRes as any, () => ({}));

    expect(mockedReq.get).toHaveBeenCalledTimes(1);
    expect(mockedReq.get).toHaveBeenCalledWith('authorization');

    expect(mockedRes.status).toHaveBeenCalledTimes(0);

    expect(mockedVerify).toHaveBeenCalledTimes(1);
    expect(mockedVerify).toHaveBeenCalledWith(frontendToken, FRONTEND_JWT_SECRET);

    expect(mockedSet).toHaveBeenCalledTimes(1);
    expect(mockedSet).toHaveBeenCalledWith(mockedReq, 'user', null);

    expect(mockedGraphqlHTTPHandler).toHaveBeenCalledTimes(1);
  });

  it('Succeeds when frontend token is valid but user token has bad signer', async () => {
    const { handler, mockedReq, mockedRes } = await genGeneralSetup();

    const frontendToken = 'foobar';
    const userToken = 'yay';
    mockedReq.get.mockReturnValue(
      JSON.stringify({
        frontend: frontendToken,
        user: userToken,
      }),
    );
    mockedVerify
      .mockImplementationOnce(() => true)
      .mockImplementationOnce(() => {
        throw new Error('error');
      });

    await handler(mockedReq as any, mockedRes as any, () => ({}));

    expect(mockedReq.get).toHaveBeenCalledTimes(1);
    expect(mockedReq.get).toHaveBeenCalledWith('authorization');

    expect(mockedRes.status).toHaveBeenCalledTimes(0);

    expect(mockedVerify).toHaveBeenCalledTimes(2);
    expect(mockedVerify).toHaveBeenNthCalledWith(1, frontendToken, FRONTEND_JWT_SECRET);
    expect(mockedVerify).toHaveBeenNthCalledWith(2, userToken, JWT_SECRET);

    expect(mockedSet).toHaveBeenCalledTimes(1);
    expect(mockedSet).toHaveBeenCalledWith(mockedReq, 'user', null);

    expect(mockedGraphqlHTTPHandler).toHaveBeenCalledTimes(1);
  });

  it('Succeeds when frontend token is valid but user token is malformed', async () => {
    const { handler, mockedReq, mockedRes } = await genGeneralSetup();

    const frontendToken = 'foobar';
    const userToken = 'yay';
    mockedReq.get.mockReturnValue(
      JSON.stringify({
        frontend: frontendToken,
        user: userToken,
      }),
    );
    mockedVerify
      .mockImplementationOnce(() => true)
      .mockImplementationOnce(() => ({
        foo: 'bar',
      }));

    await handler(mockedReq as any, mockedRes as any, () => ({}));

    expect(mockedReq.get).toHaveBeenCalledTimes(1);
    expect(mockedReq.get).toHaveBeenCalledWith('authorization');

    expect(mockedRes.status).toHaveBeenCalledTimes(0);

    expect(mockedVerify).toHaveBeenCalledTimes(2);
    expect(mockedVerify).toHaveBeenNthCalledWith(1, frontendToken, FRONTEND_JWT_SECRET);
    expect(mockedVerify).toHaveBeenNthCalledWith(2, userToken, JWT_SECRET);

    expect(mockedSet).toHaveBeenCalledTimes(1);
    expect(mockedSet).toHaveBeenCalledWith(mockedReq, 'user', null);

    expect(mockedGraphqlHTTPHandler).toHaveBeenCalledTimes(1);
  });

  it('Succeeds when frontend token is valid but user token is invalid', async () => {
    const { handler, mockedReq, mockedRes } = await genGeneralSetup();

    const frontendToken = 'foobar';
    const userToken = 'yay';
    mockedReq.get.mockReturnValue(
      JSON.stringify({
        frontend: frontendToken,
        user: userToken,
      }),
    );
    mockedVerify
      .mockImplementationOnce(() => true)
      .mockImplementationOnce(() => ({
        foo: 'bar',
      }));
    mockedGetValidatedAccessTokenPayload.mockResolvedValue(null);

    await handler(mockedReq as any, mockedRes as any, () => ({}));

    expect(mockedReq.get).toHaveBeenCalledTimes(1);
    expect(mockedReq.get).toHaveBeenCalledWith('authorization');

    expect(mockedRes.status).toHaveBeenCalledTimes(0);

    expect(mockedVerify).toHaveBeenCalledTimes(2);
    expect(mockedVerify).toHaveBeenNthCalledWith(1, frontendToken, FRONTEND_JWT_SECRET);
    expect(mockedVerify).toHaveBeenNthCalledWith(2, userToken, JWT_SECRET);

    expect(mockedSet).toHaveBeenCalledTimes(1);
    expect(mockedSet).toHaveBeenCalledWith(mockedReq, 'user', null);

    expect(mockedGraphqlHTTPHandler).toHaveBeenCalledTimes(1);
  });

  it('Succeeds when frontend token is valid and user token is valid', async () => {
    const { handler, mockedReq, mockedRes } = await genGeneralSetup();

    const frontendToken = 'foobar';
    const userToken = 'yay';
    mockedReq.get.mockReturnValue(
      JSON.stringify({
        frontend: frontendToken,
        user: userToken,
      }),
    );
    const validatedPayload = {
      ensName: null,
      ensAvatarImageUrl: null,
      githubId: null,
      githubHandle: null,
      discordId: null,
      discordHandle: null,
      emailId: 5,
    };
    const userPayload = {
      authTokenId: 2,
      addressId: 342,
      address: '0xfoo',
      ...validatedPayload,
      emailId: null,
    };
    mockedVerify.mockImplementationOnce(() => true).mockImplementationOnce(() => userPayload);
    mockedGetValidatedAccessTokenPayload.mockResolvedValue(validatedPayload as any);

    await handler(mockedReq as any, mockedRes as any, () => ({}));

    expect(mockedReq.get).toHaveBeenCalledTimes(1);
    expect(mockedReq.get).toHaveBeenCalledWith('authorization');

    expect(mockedRes.status).toHaveBeenCalledTimes(0);

    expect(mockedVerify).toHaveBeenCalledTimes(2);
    expect(mockedVerify).toHaveBeenNthCalledWith(1, frontendToken, FRONTEND_JWT_SECRET);
    expect(mockedVerify).toHaveBeenNthCalledWith(2, userToken, JWT_SECRET);

    expect(mockedSet).toHaveBeenCalledTimes(1);
    expect(mockedSet).toHaveBeenCalledWith(mockedReq, 'user', {
      ...userPayload,
      ...validatedPayload,
    });

    expect(mockedGraphqlHTTPHandler).toHaveBeenCalledTimes(1);
  });
});
