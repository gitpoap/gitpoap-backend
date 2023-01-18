import { AccessTokenPayload, getAccessTokenPayload } from '../../../../src/types/authTokens';
import { MembershipRole } from '@prisma/client';

describe('getAccessTokenPayload', () => {
  it('Fails to convert an invalid payload', () => {
    expect(() => getAccessTokenPayload({ foo: 'bar' })).toThrow();
  });

  const validPayload1: AccessTokenPayload = {
    privyUserId: 'hello-there',
    addressId: 784,
    ethAddress: '0x00001',
    ensName: null,
    ensAvatarImageUrl: null,
    memberships: [],
    githubId: null,
    githubHandle: null,
    discordHandle: null,
    emailAddress: null,
  };
  const validPayload2: AccessTokenPayload = {
    privyUserId: 'bye for now!',
    addressId: 84,
    ethAddress: '0x44001',
    ensName: 'burz.eth',
    ensAvatarImageUrl: 'https://example.com/example.jpg',
    memberships: [
      {
        teamId: 234,
        role: MembershipRole.ADMIN,
      },
    ],
    githubId: 32455,
    githubHandle: 'burz',
    discordHandle: 'yoyo#45',
    emailAddress: 'foobar@yoyo.com',
  };

  it('Succeeds with valid payload', () => {
    const runTestOnPayload = (payload: AccessTokenPayload) => {
      const testFn = () => getAccessTokenPayload(payload as any);

      expect(testFn).not.toThrow();
      expect(testFn()).toEqual(payload);
    };

    runTestOnPayload(validPayload1);
    runTestOnPayload(validPayload2);
  });

  it('Can convert valid payloads back from JSON', () => {
    const runTestOnPayload = (payload: AccessTokenPayload) => {
      const testFn = () => {
        return getAccessTokenPayload(JSON.parse(JSON.stringify(payload)));
      };

      expect(testFn).not.toThrow();
      expect(testFn()).toEqual(payload);
    };

    runTestOnPayload(validPayload1);
    runTestOnPayload(validPayload2);
  });
});
