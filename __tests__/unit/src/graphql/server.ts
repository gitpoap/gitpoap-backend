import '../../../../__mocks__/src/logging';
import { createGQLServer } from '../../../../src/graphql/server';
import { graphqlHTTP } from 'express-graphql';
import { verify } from 'jsonwebtoken';
import { JWT_SECRET } from '../../../../src/environment';
import set from 'lodash/set';
import { getValidatedAccessTokenPayload } from '../../../../src/lib/authTokens';
import { MembershipRole } from '@prisma/client';

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

  it('Skips checking auth for graphiql', async () => {
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

  it('Succeeds without user token specified', async () => {
    const { handler, mockedReq, mockedRes } = await genGeneralSetup();

    mockedReq.get.mockReturnValue(JSON.stringify({ user: null }));

    await handler(mockedReq as any, mockedRes as any, () => ({}));

    expect(mockedReq.get).toHaveBeenCalledTimes(1);
    expect(mockedReq.get).toHaveBeenCalledWith('authorization');

    expect(mockedRes.status).toHaveBeenCalledTimes(0);

    expect(mockedVerify).toHaveBeenCalledTimes(0);

    expect(mockedSet).toHaveBeenCalledTimes(1);
    expect(mockedSet).toHaveBeenCalledWith(mockedReq, 'user', null);

    expect(mockedGraphqlHTTPHandler).toHaveBeenCalledTimes(1);
  });

  it('Succeeds when user token has bad signer', async () => {
    const { handler, mockedReq, mockedRes } = await genGeneralSetup();

    const userToken = 'yay';
    mockedReq.get.mockReturnValue(JSON.stringify({ user: userToken }));
    mockedVerify.mockImplementationOnce(() => {
      throw new Error('error');
    });

    await handler(mockedReq as any, mockedRes as any, () => ({}));

    expect(mockedReq.get).toHaveBeenCalledTimes(1);
    expect(mockedReq.get).toHaveBeenCalledWith('authorization');

    expect(mockedRes.status).toHaveBeenCalledTimes(0);

    expect(mockedVerify).toHaveBeenCalledTimes(1);
    expect(mockedVerify).toHaveBeenCalledWith(userToken, JWT_SECRET);

    expect(mockedSet).toHaveBeenCalledTimes(1);
    expect(mockedSet).toHaveBeenCalledWith(mockedReq, 'user', null);

    expect(mockedGraphqlHTTPHandler).toHaveBeenCalledTimes(1);
  });

  it('Succeeds when user token is malformed', async () => {
    const { handler, mockedReq, mockedRes } = await genGeneralSetup();

    const userToken = 'yay';
    mockedReq.get.mockReturnValue(JSON.stringify({ user: userToken }));
    mockedVerify.mockImplementationOnce(() => ({ foo: 'bar' }));

    await handler(mockedReq as any, mockedRes as any, () => ({}));

    expect(mockedReq.get).toHaveBeenCalledTimes(1);
    expect(mockedReq.get).toHaveBeenCalledWith('authorization');

    expect(mockedRes.status).toHaveBeenCalledTimes(0);

    expect(mockedVerify).toHaveBeenCalledTimes(1);
    expect(mockedVerify).toHaveBeenCalledWith(userToken, JWT_SECRET);

    expect(mockedSet).toHaveBeenCalledTimes(1);
    expect(mockedSet).toHaveBeenCalledWith(mockedReq, 'user', null);

    expect(mockedGraphqlHTTPHandler).toHaveBeenCalledTimes(1);
  });

  it('Succeeds when user token is invalid', async () => {
    const { handler, mockedReq, mockedRes } = await genGeneralSetup();

    const userToken = 'yay';
    mockedReq.get.mockReturnValue(JSON.stringify({ user: userToken }));
    mockedVerify.mockImplementationOnce(() => ({ foo: 'bar' }));
    mockedGetValidatedAccessTokenPayload.mockResolvedValue(null);

    await handler(mockedReq as any, mockedRes as any, () => ({}));

    expect(mockedReq.get).toHaveBeenCalledTimes(1);
    expect(mockedReq.get).toHaveBeenCalledWith('authorization');

    expect(mockedRes.status).toHaveBeenCalledTimes(0);

    expect(mockedVerify).toHaveBeenCalledTimes(1);
    expect(mockedVerify).toHaveBeenCalledWith(userToken, JWT_SECRET);

    expect(mockedSet).toHaveBeenCalledTimes(1);
    expect(mockedSet).toHaveBeenCalledWith(mockedReq, 'user', null);

    expect(mockedGraphqlHTTPHandler).toHaveBeenCalledTimes(1);
  });

  it('Succeeds when user token is valid', async () => {
    const { handler, mockedReq, mockedRes } = await genGeneralSetup();

    const userToken = 'yay';
    mockedReq.get.mockReturnValue(JSON.stringify({ user: userToken }));
    const validatedPayload = {
      ensName: null,
      ensAvatarImageUrl: null,
      memberships: [{ teamId: 3, role: MembershipRole.ADMIN }],
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
      memberships: [],
      emailId: null,
    };
    mockedVerify.mockImplementationOnce(() => userPayload);
    mockedGetValidatedAccessTokenPayload.mockResolvedValue(validatedPayload as any);

    await handler(mockedReq as any, mockedRes as any, () => ({}));

    expect(mockedReq.get).toHaveBeenCalledTimes(1);
    expect(mockedReq.get).toHaveBeenCalledWith('authorization');

    expect(mockedRes.status).toHaveBeenCalledTimes(0);

    expect(mockedVerify).toHaveBeenCalledTimes(1);
    expect(mockedVerify).toHaveBeenCalledWith(userToken, JWT_SECRET);

    expect(mockedSet).toHaveBeenCalledTimes(1);
    expect(mockedSet).toHaveBeenCalledWith(mockedReq, 'user', {
      ...userPayload,
      ...validatedPayload,
    });

    expect(mockedGraphqlHTTPHandler).toHaveBeenCalledTimes(1);
  });
});
