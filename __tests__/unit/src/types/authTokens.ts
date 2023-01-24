import { AccessTokenPayload, getAccessTokenPayload } from '../../../../src/types/authTokens';
import { MembershipRole } from '@prisma/client';

describe('getAccessTokenPayload', () => {
  it('Fails to convert an invalid payload', () => {
    expect(() => getAccessTokenPayload({ foo: 'bar' })).toThrow();
  });

  const validPayload1: AccessTokenPayload = {
    privyUserId: 'hello-there',
    address: {
      id: 784,
      ethAddress: '0x00001',
      ensName: null,
      ensAvatarImageUrl: null,
    },
    github: null,
    email: null,
    discord: null,
    memberships: [],
  };
  const validPayload2: AccessTokenPayload = {
    privyUserId: 'bye for now!',
    address: {
      id: 84,
      ethAddress: '0x44001',
      ensName: 'burz.eth',
      ensAvatarImageUrl: 'https://example.com/example.jpg',
    },
    github: {
      id: 234,
      githubId: 32455,
      githubHandle: 'burz',
    },
    email: {
      id: 6787,
      emailAddress: 'foobar@yoyo.com',
    },
    discord: {
      id: 249999,
      discordId: 'discoCat34',
      discordHandle: 'yoyo#45',
    },
    memberships: [
      {
        teamId: 234,
        role: MembershipRole.ADMIN,
      },
    ],
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
