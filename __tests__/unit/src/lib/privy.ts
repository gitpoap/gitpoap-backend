import '../../../../__mocks__/src/logging';
import { contextMock } from '../../../../__mocks__/src/context';
import { verifyPrivyToken } from '../../../../src/lib/privy';
import { verifyPrivyTokenForData } from '../../../../src/external/privy';
import { upsertAddress } from '../../../../src/lib/addresses';
import { resolveAddress } from '../../../../src/lib/ens';
import { removeGithubUsersLogin } from '../../../../src/lib/githubUsers';
import { isGithubTokenValidForUser } from '../../../../src/external/github';
import { upsertEmail } from '../../../../src/lib/emails';
import { upsertDiscordUser } from '../../../../src/lib/discordUsers';
import {
  AddressPayload,
  DiscordPayload,
  EmailPayload,
  GithubPayload,
} from '../../../../src/types/authTokens';

jest.mock('../../../../src/logging');
jest.mock('../../../../src/external/privy');
jest.mock('../../../../src/lib/addresses');
jest.mock('../../../../src/lib/ens');
jest.mock('../../../../src/lib/githubUsers');
jest.mock('../../../../src/external/github');
jest.mock('../../../../src/lib/emails');
jest.mock('../../../../src/lib/discordUsers');

const mockedVerifyPrivyTokenForData = jest.mocked(verifyPrivyTokenForData, true);
const mockedUpsertAddress = jest.mocked(upsertAddress, true);
const mockedResolveAddress = jest.mocked(resolveAddress, true);
const mockedRemoveGithubUsersLogin = jest.mocked(removeGithubUsersLogin, true);
const mockedIsGithubTokenValidForUser = jest.mocked(isGithubTokenValidForUser, true);
const mockedUpsertEmail = jest.mocked(upsertEmail, true);
const mockedUpsertDiscordUser = jest.mocked(upsertDiscordUser, true);

const privyToken = 'blursed token';
const privyUserId = 'Dr. Foo Bar Esq.';
const ethAddress = '0xyeetyolo';
const address: AddressPayload = {
  id: 34,
  ethAddress,
  ensName: null,
  ensAvatarImageUrl: null,
};
const githubOAuthToken = 'Let me in!';
const github: GithubPayload = {
  id: 8888,
  githubId: 9,
  githubHandle: 'johannes-kepler',
};
const emailAddress = 'groot@theroot.com';
const email: EmailPayload = {
  id: 100,
  emailAddress,
};
const discordId = 'I am over 21';
const discordHandle = 'seriously#not-joking';
const discord: DiscordPayload = {
  id: 85489,
  discordId,
  discordHandle,
};

describe('verifyPrivyToken', () => {
  it('Returns null when the token is invalid', async () => {
    mockedVerifyPrivyTokenForData.mockResolvedValue(null);

    const result = await verifyPrivyToken(privyToken);

    expect(result).toEqual(null);

    expect(mockedVerifyPrivyTokenForData).toHaveBeenCalledTimes(1);
    expect(mockedVerifyPrivyTokenForData).toHaveBeenCalledWith(contextMock.privy, privyToken);
  });

  const expectGithubUserFindUnique = () => {
    expect(contextMock.prisma.githubUser.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.githubUser.findUnique).toHaveBeenCalledWith({
      where: { privyUserId },
      select: {
        id: true,
        githubId: true,
        githubHandle: true,
        githubOAuthToken: true,
      },
    });
  };

  it('Returns only the privyUserId when no known login methods are setup', async () => {
    mockedVerifyPrivyTokenForData.mockResolvedValue({
      privyUserId,
      ethAddress: null,
      emailAddress: null,
      discord: null,
    });
    contextMock.prisma.githubUser.findUnique.mockResolvedValue(null);

    const result = await verifyPrivyToken(privyToken);

    expect(result).toEqual(
      expect.objectContaining({
        privyUserId,
        address: null,
        github: null,
        email: null,
        discord: null,
      }),
    );

    expect(mockedVerifyPrivyTokenForData).toHaveBeenCalledTimes(1);
    expect(mockedVerifyPrivyTokenForData).toHaveBeenCalledWith(contextMock.privy, privyToken);

    expectGithubUserFindUnique();
  });

  it('Returns address when it is setup', async () => {
    mockedVerifyPrivyTokenForData.mockResolvedValue({
      privyUserId,
      ethAddress,
      emailAddress: null,
      discord: null,
    });
    mockedUpsertAddress.mockResolvedValue(address as any);
    contextMock.prisma.githubUser.findUnique.mockResolvedValue(null);

    const result = await verifyPrivyToken(privyToken);

    expect(result).toEqual(
      expect.objectContaining({
        privyUserId,
        address,
        github: null,
        email: null,
        discord: null,
      }),
    );

    expect(mockedVerifyPrivyTokenForData).toHaveBeenCalledTimes(1);
    expect(mockedVerifyPrivyTokenForData).toHaveBeenCalledWith(contextMock.privy, privyToken);

    expect(mockedUpsertAddress).toHaveBeenCalledTimes(1);
    expect(mockedUpsertAddress).toHaveBeenCalledWith(ethAddress);

    expect(mockedResolveAddress).toHaveBeenCalledTimes(1);
    expect(mockedResolveAddress).toHaveBeenCalledWith(ethAddress);

    expectGithubUserFindUnique();
  });

  it("Doesn't return GitHub when githubOAuthToken is missing from DB record", async () => {
    mockedVerifyPrivyTokenForData.mockResolvedValue({
      privyUserId,
      ethAddress: null,
      emailAddress: null,
      discord: null,
    });
    contextMock.prisma.githubUser.findUnique.mockResolvedValue({
      ...github,
      githubOAuthToken: null,
    } as any);

    const result = await verifyPrivyToken(privyToken);

    expect(result).toEqual(
      expect.objectContaining({
        privyUserId,
        address: null,
        github: null,
        email: null,
        discord: null,
      }),
    );

    expect(mockedVerifyPrivyTokenForData).toHaveBeenCalledTimes(1);
    expect(mockedVerifyPrivyTokenForData).toHaveBeenCalledWith(contextMock.privy, privyToken);

    expectGithubUserFindUnique();

    expect(mockedIsGithubTokenValidForUser).toHaveBeenCalledTimes(0);

    expect(mockedRemoveGithubUsersLogin).toHaveBeenCalledTimes(1);
    expect(mockedRemoveGithubUsersLogin).toHaveBeenCalledWith(github.id);
  });

  it("Doesn't return GitHub when githubOAuthToken is no longer valid", async () => {
    mockedVerifyPrivyTokenForData.mockResolvedValue({
      privyUserId,
      ethAddress: null,
      emailAddress: null,
      discord: null,
    });
    contextMock.prisma.githubUser.findUnique.mockResolvedValue({
      ...github,
      githubOAuthToken,
    } as any);
    mockedIsGithubTokenValidForUser.mockResolvedValue(false);

    const result = await verifyPrivyToken(privyToken);

    expect(result).toEqual(
      expect.objectContaining({
        privyUserId,
        address: null,
        github: null,
        email: null,
        discord: null,
      }),
    );

    expect(mockedVerifyPrivyTokenForData).toHaveBeenCalledTimes(1);
    expect(mockedVerifyPrivyTokenForData).toHaveBeenCalledWith(contextMock.privy, privyToken);

    expectGithubUserFindUnique();

    expect(mockedIsGithubTokenValidForUser).toHaveBeenCalledTimes(1);
    expect(mockedIsGithubTokenValidForUser).toHaveBeenCalledWith(githubOAuthToken, github.githubId);

    expect(mockedRemoveGithubUsersLogin).toHaveBeenCalledTimes(1);
    expect(mockedRemoveGithubUsersLogin).toHaveBeenCalledWith(github.id);
  });

  it('Returns github when it is setup', async () => {
    mockedVerifyPrivyTokenForData.mockResolvedValue({
      privyUserId,
      ethAddress: null,
      emailAddress: null,
      discord: null,
    });
    contextMock.prisma.githubUser.findUnique.mockResolvedValue({
      ...github,
      githubOAuthToken,
    } as any);
    mockedIsGithubTokenValidForUser.mockResolvedValue(true);

    const result = await verifyPrivyToken(privyToken);

    expect(result).toEqual(
      expect.objectContaining({
        privyUserId,
        address: null,
        github: expect.objectContaining(github),
        email: null,
        discord: null,
      }),
    );

    expect(mockedVerifyPrivyTokenForData).toHaveBeenCalledTimes(1);
    expect(mockedVerifyPrivyTokenForData).toHaveBeenCalledWith(contextMock.privy, privyToken);

    expectGithubUserFindUnique();

    expect(mockedIsGithubTokenValidForUser).toHaveBeenCalledTimes(1);
    expect(mockedIsGithubTokenValidForUser).toHaveBeenCalledWith(githubOAuthToken, github.githubId);

    expect(mockedRemoveGithubUsersLogin).toHaveBeenCalledTimes(0);
  });

  it('Fails when email fails to upsert', async () => {
    mockedVerifyPrivyTokenForData.mockResolvedValue({
      privyUserId,
      ethAddress: null,
      emailAddress,
      discord: null,
    });
    contextMock.prisma.githubUser.findUnique.mockResolvedValue(null);
    mockedUpsertEmail.mockResolvedValue(null);

    const result = await verifyPrivyToken(privyToken);

    expect(result).toEqual(null);

    expect(mockedVerifyPrivyTokenForData).toHaveBeenCalledTimes(1);
    expect(mockedVerifyPrivyTokenForData).toHaveBeenCalledWith(contextMock.privy, privyToken);

    expectGithubUserFindUnique();

    expect(mockedUpsertEmail).toHaveBeenCalledTimes(1);
    expect(mockedUpsertEmail).toHaveBeenCalledWith(emailAddress);
  });

  it('Returns email when it is setup', async () => {
    mockedVerifyPrivyTokenForData.mockResolvedValue({
      privyUserId,
      ethAddress: null,
      emailAddress,
      discord: null,
    });
    contextMock.prisma.githubUser.findUnique.mockResolvedValue(null);
    mockedUpsertEmail.mockResolvedValue(email as any);

    const result = await verifyPrivyToken(privyToken);

    expect(result).toEqual(
      expect.objectContaining({
        privyUserId,
        address: null,
        github: null,
        email,
        discord: null,
      }),
    );

    expect(mockedVerifyPrivyTokenForData).toHaveBeenCalledTimes(1);
    expect(mockedVerifyPrivyTokenForData).toHaveBeenCalledWith(contextMock.privy, privyToken);

    expectGithubUserFindUnique();

    expect(mockedUpsertEmail).toHaveBeenCalledTimes(1);
    expect(mockedUpsertEmail).toHaveBeenCalledWith(emailAddress);
  });

  it('Returns discord when it is setup', async () => {
    mockedVerifyPrivyTokenForData.mockResolvedValue({
      privyUserId,
      ethAddress: null,
      emailAddress: null,
      discord: { discordId, discordHandle },
    });
    contextMock.prisma.githubUser.findUnique.mockResolvedValue(null);
    mockedUpsertDiscordUser.mockResolvedValue(discord as any);

    const result = await verifyPrivyToken(privyToken);

    expect(result).toEqual(
      expect.objectContaining({
        privyUserId,
        address: null,
        github: null,
        email: null,
        discord,
      }),
    );

    expect(mockedVerifyPrivyTokenForData).toHaveBeenCalledTimes(1);
    expect(mockedVerifyPrivyTokenForData).toHaveBeenCalledWith(contextMock.privy, privyToken);

    expectGithubUserFindUnique();

    expect(mockedUpsertDiscordUser).toHaveBeenCalledTimes(1);
    expect(mockedUpsertDiscordUser).toHaveBeenCalledWith(discordId, discordHandle);
  });

  it('Returns everything when it is all setup', async () => {
    mockedVerifyPrivyTokenForData.mockResolvedValue({
      privyUserId,
      ethAddress,
      emailAddress,
      discord: { discordId, discordHandle },
    });
    mockedUpsertAddress.mockResolvedValue(address as any);
    contextMock.prisma.githubUser.findUnique.mockResolvedValue({
      ...github,
      githubOAuthToken,
    } as any);
    mockedIsGithubTokenValidForUser.mockResolvedValue(true);
    mockedUpsertEmail.mockResolvedValue(email as any);
    mockedUpsertDiscordUser.mockResolvedValue(discord as any);

    const result = await verifyPrivyToken(privyToken);

    expect(result).toEqual(
      expect.objectContaining({
        privyUserId,
        address,
        github: expect.objectContaining(github),
        email,
        discord,
      }),
    );

    expect(mockedVerifyPrivyTokenForData).toHaveBeenCalledTimes(1);
    expect(mockedVerifyPrivyTokenForData).toHaveBeenCalledWith(contextMock.privy, privyToken);

    expect(mockedUpsertAddress).toHaveBeenCalledTimes(1);
    expect(mockedUpsertAddress).toHaveBeenCalledWith(ethAddress);

    expect(mockedResolveAddress).toHaveBeenCalledTimes(1);
    expect(mockedResolveAddress).toHaveBeenCalledWith(ethAddress);

    expectGithubUserFindUnique();

    expect(mockedIsGithubTokenValidForUser).toHaveBeenCalledTimes(1);
    expect(mockedIsGithubTokenValidForUser).toHaveBeenCalledWith(githubOAuthToken, github.githubId);

    expect(mockedRemoveGithubUsersLogin).toHaveBeenCalledTimes(0);

    expect(mockedUpsertEmail).toHaveBeenCalledTimes(1);
    expect(mockedUpsertEmail).toHaveBeenCalledWith(emailAddress);

    expect(mockedUpsertDiscordUser).toHaveBeenCalledTimes(1);
    expect(mockedUpsertDiscordUser).toHaveBeenCalledWith(discordId, discordHandle);
  });
});
