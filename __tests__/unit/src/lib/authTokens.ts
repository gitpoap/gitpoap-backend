import '../../../../__mocks__/src/logging';
import { generateAuthTokensWithChecks } from '../../../../src/lib/authTokens';
import { isGithubTokenValidForUser } from '../../../../src/external/github';
import { removeGithubUsersGithubOAuthToken } from '../../../../src/lib/githubUsers';
import { removeGithubLoginForAddress } from '../../../../src/lib/addresses';
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
jest.mock('../../../../src/lib/addresses');

const mockedIsGithubTokenValidForUser = jest.mocked(isGithubTokenValidForUser, true);
const mockedRemoveGithubUsersGithubOAuthToken = jest.mocked(
  removeGithubUsersGithubOAuthToken,
  true,
);
const mockedRemoveGithubLoginForAddress = jest.mocked(removeGithubLoginForAddress, true);

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
const emailId = 6748;

describe('generateAuthTokensWithChecks', () => {
  const validatePayloads = (
    { accessToken, refreshToken }: UserAuthTokens,
    expectedGithubId: number | null = null,
    expectedGithubHandle: string | null = null,
    expectedEmailId: number | null = null,
  ) => {
    expect(getAccessTokenPayload(verify(accessToken, JWT_SECRET))).toEqual(
      expect.objectContaining({
        authTokenId,
        addressId,
        address: ethAddress,
        ensName,
        ensAvatarImageUrl,
        githubId: expectedGithubId,
        githubHandle: expectedGithubHandle,
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
      githubUser: null,
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
      githubUser: {
        id: githubUserId,
        githubId,
        githubHandle,
        githubOAuthToken,
      },
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
      githubUser: {
        id: githubUserId,
        githubId,
        githubHandle,
        githubOAuthToken,
      },
      email: null,
    });

    validatePayloads(tokens, githubId, githubHandle);

    expect(mockedIsGithubTokenValidForUser).toHaveBeenCalledTimes(1);
    expect(mockedIsGithubTokenValidForUser).toHaveBeenCalledWith(githubOAuthToken, githubId);

    expect(mockedRemoveGithubUsersGithubOAuthToken).toHaveBeenCalledTimes(0);
    expect(mockedRemoveGithubLoginForAddress).toHaveBeenCalledTimes(0);
  });

  it('Removes emailIds when they are not validated', async () => {
    const tokens = await generateAuthTokensWithChecks(authTokenId, generation, {
      id: addressId,
      ethAddress,
      ensName,
      ensAvatarImageUrl,
      githubUser: null,
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
      githubUser: null,
      email: {
        id: emailId,
        isValidated: true,
      },
    });

    validatePayloads(tokens, null, null, emailId);

    expect(mockedIsGithubTokenValidForUser).toHaveBeenCalledTimes(0);
  });
});
