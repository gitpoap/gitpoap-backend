import { AccessTokenPayload, getAccessTokenPayload } from '../../../../src/types/authTokens';
import { MembershipRole } from '@prisma/client';

describe('getAccessTokenPayload', () => {
  it('Fails to convert an invalid payload', () => {
    expect(() => getAccessTokenPayload({ foo: 'bar' })).toThrow();
  });

  const validPayload1: AccessTokenPayload = {
    authTokenId: 343,
    addressId: 784,
    address: '0x00001',
    ensName: null,
    ensAvatarImageUrl: null,
    memberships: [],
    githubId: null,
    githubHandle: null,
    discordId: null,
    discordHandle: null,
    emailId: null,
  };
  const validPayload2: AccessTokenPayload = {
    authTokenId: 743,
    addressId: 84,
    address: '0x44001',
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
    discordId: '44423423',
    discordHandle: 'yoyo#45',
    emailId: 92555,
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
