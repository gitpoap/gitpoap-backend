import '../../../../__mocks__/src/logging';
import { setupGQLContext } from '../../../../src/graphql/server';
import { verify } from 'jsonwebtoken';
import { JWT_SECRET } from '../../../../src/environment';
import { MembershipRole } from '@prisma/client';
import { context } from '../../../../src/context';
import { ErrorText } from '../../../../src/graphql/errors';

jest.mock('../../../../src/logging');
jest.mock('jsonwebtoken');
jest.mock('../../../../src/lib/authTokens');

const mockedVerify = jest.mocked(verify, true);

describe('setupGQLContext', () => {
  it('Fails when no auth header is provided', async () => {
    const mockedReq = { headers: {} };

    return expect(setupGQLContext(mockedReq)).rejects.toThrow(ErrorText.MissingAuth);
  });

  it('Fails when the authorization is invalid JSON', async () => {
    const mockedReq = { headers: { authorization: '{' } };

    return expect(setupGQLContext(mockedReq)).rejects.toThrow(ErrorText.InvalidAuth);
  });

  it('Succeeds without user token specified', async () => {
    const mockedReq = {
      headers: { authorization: 'Bearer null' },
    };

    expect(await setupGQLContext(mockedReq)).toEqual({
      ...context,
      userAccessTokenPayload: null,
    });

    expect(mockedVerify).toHaveBeenCalledTimes(0);
  });

  it('Succeeds when user token has bad signer', async () => {
    const user = 'yay';
    const mockedReq = {
      headers: { authorization: `Bearer ${user}` },
    };
    mockedVerify.mockImplementationOnce(() => {
      throw new Error('error');
    });

    expect(await setupGQLContext(mockedReq)).toEqual({
      ...context,
      userAccessTokenPayload: null,
    });

    expect(mockedVerify).toHaveBeenCalledTimes(1);
    expect(mockedVerify).toHaveBeenCalledWith(user, JWT_SECRET);
  });

  it('Succeeds when user token is malformed', async () => {
    const user = 'yay';
    const mockedReq = {
      headers: { authorization: `Bearer ${user}` },
    };
    mockedVerify.mockImplementationOnce(() => ({ foo: 'bar' }));

    expect(await setupGQLContext(mockedReq)).toEqual({
      ...context,
      userAccessTokenPayload: null,
    });

    expect(mockedVerify).toHaveBeenCalledTimes(1);
    expect(mockedVerify).toHaveBeenCalledWith(user, JWT_SECRET);
  });

  it('Succeeds when user token is invalid', async () => {
    const user = 'yay';
    const mockedReq = {
      headers: { authorization: `Bearer ${user}` },
    };
    mockedVerify.mockImplementationOnce(() => ({ foo: 'bar' }));

    expect(await setupGQLContext(mockedReq)).toEqual({
      ...context,
      userAccessTokenPayload: null,
    });

    expect(mockedVerify).toHaveBeenCalledTimes(1);
    expect(mockedVerify).toHaveBeenCalledWith(user, JWT_SECRET);
  });

  it('Succeeds when user token is valid', async () => {
    const user = 'yay';
    const mockedReq = {
      headers: { authorization: `Bearer ${user}` },
    };
    const userPayload = {
      privyUserId: 'foo:bar',
      address: {
        id: 342,
        ethAddress: '0xfoo',
        ensName: null,
        ensAvatarImageUrl: null,
      },
      github: null,
      email: {
        id: 5,
        emailAddress: 'yeet@yolo.com',
      },
      discord: null,
      memberships: [{ teamId: 3, role: MembershipRole.ADMIN }],
    };
    mockedVerify.mockImplementationOnce(() => userPayload);

    expect(await setupGQLContext(mockedReq)).toEqual({
      ...context,
      userAccessTokenPayload: userPayload,
    });
  });
});
