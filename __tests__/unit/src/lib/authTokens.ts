import '../../../../__mocks__/src/logging';
import { generateAuthTokensWithChecks } from '../../../../src/lib/authTokens';
import { isGithubTokenValidForUser } from '../../../../src/external/github';
import { removeGithubUsersGithubOAuthToken } from '../../../../src/lib/githubUsers';
import { isDiscordTokenValidForUser } from '../../../../src/external/discord';
import { removeDiscordUsersDiscordOAuthToken } from '../../../../src/lib/discordUsers';
import {
  removeGithubLoginForAddress,
  removeDiscordLoginForAddress,
} from '../../../../src/lib/addresses';
import {
  UserAuthTokens,
  getAccessTokenPayload,
  getRefreshTokenPayload,
} from '../../../../src/types/authTokens';
import { verify } from 'jsonwebtoken';
import { JWT_SECRET } from '../../../../src/environment';

jest.mock('../../../../src/logging');
jest.mock('../../../../src/external/github');
jest.mock('../../../../src/lib/githubUsers');
jest.mock('../../../../src/external/discord');
jest.mock('../../../../src/lib/discordUsers');
jest.mock('../../../../src/lib/addresses');

const mockedIsGithubTokenValidForUser = jest.mocked(isGithubTokenValidForUser, true);
const mockedRemoveGithubUsersGithubOAuthToken = jest.mocked(
  removeGithubUsersGithubOAuthToken,
  true,
);
const mockedRemoveGithubLoginForAddress = jest.mocked(removeGithubLoginForAddress, true);
const mockedIsDiscordTokenValidForUser = jest.mocked(isDiscordTokenValidForUser, true);
const mockedRemoveDiscordUsersDiscordOAuthToken = jest.mocked(
  removeDiscordUsersDiscordOAuthToken,
  true,
);
const mockedRemoveDiscordLoginForAddress = jest.mocked(removeDiscordLoginForAddress, true);

const authTokenId = 43848;
const addressId = 44;
const ethAddress = '0xaddress';
const ensName = 'foo.eth';
const ensAvatarImageUrl = null;
const generation = 99999;
const githubUserId = 5;
const githubId = 6433;
const githubHandle = 'yohohoho';
const githubOAuthToken = 'lksjdflkjslajflsdkjflkjaslkdjflkajjjjjj444';
const discordUserId = 7;
const discordId = '4555';
const discordHandle = 'test#2343';
const discordOAuthToken = 'Bearer lksjdflkjslajflsdkjflkjaslkdjflkajjjjjj7777';
const emailId = 6748;

describe('generateAuthTokensWithChecks', () => {
  const validatePayloads = (
    { accessToken, refreshToken }: UserAuthTokens,
    expectedGithubId: number | null = null,
    expectedGithubHandle: string | null = null,
    expectedDiscordId: string | null = null,
    expectedDiscordHandle: string | null = null,
    expectedEmailId: number | null = null,
  ) => {
    expect(getAccessTokenPayload(verify(accessToken, JWT_SECRET))).toEqual(
      expect.objectContaining({
        authTokenId,
        addressId,
        address: ethAddress,
        ensName,
        ensAvatarImageUrl,
        memberships: [],
        githubId: expectedGithubId,
        githubHandle: expectedGithubHandle,
        discordId: expectedDiscordId,
        discordHandle: expectedDiscordHandle,
        emailId: expectedEmailId,
      }),
    );

    expect(getRefreshTokenPayload(verify(refreshToken, JWT_SECRET))).toEqual(
      expect.objectContaining({ authTokenId, addressId, generation }),
    );
  };

  it("Doesn't return GitHub login info if they weren't logged in", async () => {
    const tokens = await generateAuthTokensWithChecks(authTokenId, generation, {
      id: addressId,
      ethAddress,
      ensName,
      ensAvatarImageUrl,
      memberships: [],
      githubUser: null,
      discordUser: null,
      email: null,
    });

    validatePayloads(tokens);

    expect(mockedIsGithubTokenValidForUser).toHaveBeenCalledTimes(0);
  });

  it('Removes GitHub logins when they are invalid', async () => {
    mockedIsGithubTokenValidForUser.mockResolvedValue(false);

    const tokens = await generateAuthTokensWithChecks(authTokenId, generation, {
      id: addressId,
      ethAddress,
      ensName,
      ensAvatarImageUrl,
      memberships: [],
      githubUser: {
        id: githubUserId,
        githubId,
        githubHandle,
        githubOAuthToken,
      },
      discordUser: null,
      email: null,
    });

    validatePayloads(tokens);

    expect(mockedIsGithubTokenValidForUser).toHaveBeenCalledTimes(1);
    expect(mockedIsGithubTokenValidForUser).toHaveBeenCalledWith(githubOAuthToken, githubId);

    expect(mockedRemoveGithubUsersGithubOAuthToken).toHaveBeenCalledTimes(1);
    expect(mockedRemoveGithubUsersGithubOAuthToken).toHaveBeenCalledWith(githubUserId);

    expect(mockedRemoveGithubLoginForAddress).toHaveBeenCalledTimes(1);
    expect(mockedRemoveGithubLoginForAddress).toHaveBeenCalledWith(addressId);
  });

  it('Keeps GitHub logins when they are valid', async () => {
    mockedIsGithubTokenValidForUser.mockResolvedValue(true);

    const tokens = await generateAuthTokensWithChecks(authTokenId, generation, {
      id: addressId,
      ethAddress,
      ensName,
      ensAvatarImageUrl,
      memberships: [],
      githubUser: {
        id: githubUserId,
        githubId,
        githubHandle,
        githubOAuthToken,
      },
      discordUser: null,
      email: null,
    });

    validatePayloads(tokens, githubId, githubHandle);

    expect(mockedIsGithubTokenValidForUser).toHaveBeenCalledTimes(1);
    expect(mockedIsGithubTokenValidForUser).toHaveBeenCalledWith(githubOAuthToken, githubId);

    expect(mockedRemoveGithubUsersGithubOAuthToken).toHaveBeenCalledTimes(0);
    expect(mockedRemoveGithubLoginForAddress).toHaveBeenCalledTimes(0);
  });

  it("Doesn't return Discord login info if they weren't logged in", async () => {
    const tokens = await generateAuthTokensWithChecks(authTokenId, generation, {
      id: addressId,
      ethAddress,
      ensName,
      ensAvatarImageUrl,
      memberships: [],
      githubUser: null,
      discordUser: null,
      email: null,
    });

    validatePayloads(tokens);

    expect(mockedIsGithubTokenValidForUser).toHaveBeenCalledTimes(0);
  });

  it('Removes Discord logins when they are invalid', async () => {
    mockedIsDiscordTokenValidForUser.mockResolvedValue(false);

    const tokens = await generateAuthTokensWithChecks(authTokenId, generation, {
      id: addressId,
      ethAddress,
      ensName,
      ensAvatarImageUrl,
      memberships: [],
      githubUser: null,
      discordUser: {
        id: discordUserId,
        discordId,
        discordHandle,
        discordOAuthToken,
      },
      email: null,
    });

    validatePayloads(tokens);

    expect(mockedIsDiscordTokenValidForUser).toHaveBeenCalledTimes(1);
    expect(mockedIsDiscordTokenValidForUser).toHaveBeenCalledWith(discordOAuthToken, discordId);

    expect(mockedRemoveDiscordUsersDiscordOAuthToken).toHaveBeenCalledTimes(1);
    expect(mockedRemoveDiscordUsersDiscordOAuthToken).toHaveBeenCalledWith(discordUserId);

    expect(mockedRemoveDiscordLoginForAddress).toHaveBeenCalledTimes(1);
    expect(mockedRemoveDiscordLoginForAddress).toHaveBeenCalledWith(addressId);
  });

  it('Keeps Discord logins when they are valid', async () => {
    mockedIsDiscordTokenValidForUser.mockResolvedValue(true);

    const tokens = await generateAuthTokensWithChecks(authTokenId, generation, {
      id: addressId,
      ethAddress,
      ensName,
      ensAvatarImageUrl,
      memberships: [],
      githubUser: null,
      discordUser: {
        id: discordUserId,
        discordId,
        discordHandle,
        discordOAuthToken,
      },
      email: null,
    });

    validatePayloads(tokens, null, null, discordId, discordHandle);

    expect(mockedIsDiscordTokenValidForUser).toHaveBeenCalledTimes(1);
    expect(mockedIsDiscordTokenValidForUser).toHaveBeenCalledWith(discordOAuthToken, discordId);

    expect(mockedRemoveDiscordUsersDiscordOAuthToken).toHaveBeenCalledTimes(0);
    expect(mockedRemoveDiscordLoginForAddress).toHaveBeenCalledTimes(0);
  });

  it('Removes emailIds when they are not validated', async () => {
    const tokens = await generateAuthTokensWithChecks(authTokenId, generation, {
      id: addressId,
      ethAddress,
      ensName,
      ensAvatarImageUrl,
      memberships: [],
      githubUser: null,
      discordUser: null,
      email: {
        id: emailId,
        isValidated: false,
      },
    });

    validatePayloads(tokens);

    expect(mockedIsGithubTokenValidForUser).toHaveBeenCalledTimes(0);
  });

  it('Keeps emailIds when they are validated', async () => {
    const tokens = await generateAuthTokensWithChecks(authTokenId, generation, {
      id: addressId,
      ethAddress,
      ensName,
      ensAvatarImageUrl,
      memberships: [],
      githubUser: null,
      discordUser: null,
      email: {
        id: emailId,
        isValidated: true,
      },
    });

    validatePayloads(tokens, null, null, null, null, emailId);

    expect(mockedIsGithubTokenValidForUser).toHaveBeenCalledTimes(0);
  });
});
