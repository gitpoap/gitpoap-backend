import '../../../../__mocks__/src/logging';
import { contextMock } from '../../../../__mocks__/src/context';
import { verifyPrivyToken } from '../../../../src/lib/privy';
import { verifyPrivyTokenForData } from '../../../../src/external/privy';
import { upsertAddress } from '../../../../src/lib/addresses';
import { resolveAddress } from '../../../../src/lib/ens';
import { upsertEmail } from '../../../../src/lib/emails';
import { upsertDiscordUser } from '../../../../src/lib/discordUsers';
import {
  AddressPayload,
  DiscordPayload,
  EmailPayload,
  GithubPayload,
} from '../../../../src/types/authTokens';
import { upsertGithubUser } from '../../../../src/lib/githubUsers';

jest.mock('../../../../src/logging');
jest.mock('../../../../src/external/privy');
jest.mock('../../../../src/lib/addresses');
jest.mock('../../../../src/lib/ens');
jest.mock('../../../../src/lib/githubUsers');
jest.mock('../../../../src/lib/emails');
jest.mock('../../../../src/lib/discordUsers');

const mockedVerifyPrivyTokenForData = jest.mocked(verifyPrivyTokenForData, true);
const mockedUpsertAddress = jest.mocked(upsertAddress, true);
const mockedResolveAddress = jest.mocked(resolveAddress, true);
const mockedUpsertEmail = jest.mocked(upsertEmail, true);
const mockedUpsertDiscordUser = jest.mocked(upsertDiscordUser, true);
const mockedUpsertGithubUser = jest.mocked(upsertGithubUser, true);

const privyToken = 'blursed token';
const privyUserId = 'Dr. Foo Bar Esq.';
const ethAddress = '0xyeetyolo';
const address: AddressPayload = {
  id: 34,
  ethAddress,
  ensName: null,
  ensAvatarImageUrl: null,
};
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

  it('Returns only the privyUserId when no known login methods are setup', async () => {
    mockedVerifyPrivyTokenForData.mockResolvedValue({
      privyUserId,
      ethAddress: null,
      github: null,
      emailAddress: null,
      discord: null,
    });

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
  });

  it('Returns address when it is setup', async () => {
    mockedVerifyPrivyTokenForData.mockResolvedValue({
      privyUserId,
      ethAddress,
      github: null,
      emailAddress: null,
      discord: null,
    });
    mockedUpsertAddress.mockResolvedValue(address as any);

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
  });

  it('Returns github when it is setup', async () => {
    mockedVerifyPrivyTokenForData.mockResolvedValue({
      privyUserId,
      ethAddress: null,
      github,
      emailAddress: null,
      discord: null,
    });
    mockedUpsertGithubUser.mockResolvedValue(github as any);

    const result = await verifyPrivyToken(privyToken);

    expect(result).toEqual(
      expect.objectContaining({
        privyUserId,
        address: null,
        github,
        email: null,
        discord: null,
      }),
    );

    expect(mockedVerifyPrivyTokenForData).toHaveBeenCalledTimes(1);
    expect(mockedVerifyPrivyTokenForData).toHaveBeenCalledWith(contextMock.privy, privyToken);

    expect(mockedUpsertGithubUser).toHaveBeenCalledTimes(1);
    expect(mockedUpsertGithubUser).toHaveBeenCalledWith(github.githubId, github.githubHandle);
  });

  it('Fails when email fails to upsert', async () => {
    mockedVerifyPrivyTokenForData.mockResolvedValue({
      privyUserId,
      ethAddress: null,
      github: null,
      emailAddress,
      discord: null,
    });
    mockedUpsertEmail.mockResolvedValue(null);

    const result = await verifyPrivyToken(privyToken);

    expect(result).toEqual(null);

    expect(mockedVerifyPrivyTokenForData).toHaveBeenCalledTimes(1);
    expect(mockedVerifyPrivyTokenForData).toHaveBeenCalledWith(contextMock.privy, privyToken);

    expect(mockedUpsertEmail).toHaveBeenCalledTimes(1);
    expect(mockedUpsertEmail).toHaveBeenCalledWith(emailAddress);
  });

  it('Returns email when it is setup', async () => {
    mockedVerifyPrivyTokenForData.mockResolvedValue({
      privyUserId,
      ethAddress: null,
      github: null,
      emailAddress,
      discord: null,
    });
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

    expect(mockedUpsertEmail).toHaveBeenCalledTimes(1);
    expect(mockedUpsertEmail).toHaveBeenCalledWith(emailAddress);
  });

  it('Returns discord when it is setup', async () => {
    mockedVerifyPrivyTokenForData.mockResolvedValue({
      privyUserId,
      ethAddress: null,
      github: null,
      emailAddress: null,
      discord: { discordId, discordHandle },
    });
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

    expect(mockedUpsertDiscordUser).toHaveBeenCalledTimes(1);
    expect(mockedUpsertDiscordUser).toHaveBeenCalledWith(discordId, discordHandle);
  });

  it('Returns everything when it is all setup', async () => {
    mockedVerifyPrivyTokenForData.mockResolvedValue({
      privyUserId,
      ethAddress,
      github,
      emailAddress,
      discord: { discordId, discordHandle },
    });
    mockedUpsertAddress.mockResolvedValue(address as any);
    mockedUpsertGithubUser.mockResolvedValue(github as any);
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

    expect(mockedUpsertGithubUser).toHaveBeenCalledTimes(1);
    expect(mockedUpsertGithubUser).toHaveBeenCalledWith(github.githubId, github.githubHandle);

    expect(mockedUpsertEmail).toHaveBeenCalledTimes(1);
    expect(mockedUpsertEmail).toHaveBeenCalledWith(emailAddress);

    expect(mockedUpsertDiscordUser).toHaveBeenCalledTimes(1);
    expect(mockedUpsertDiscordUser).toHaveBeenCalledWith(discordId, discordHandle);
  });
});
