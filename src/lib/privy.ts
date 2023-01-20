import { verifyPrivyTokenForData } from '../external/privy';
import { context } from '../context';
import { createScopedLogger } from '../logging';
import { upsertAddress } from './addresses';
import { resolveAddress } from './ens';
import { isGithubTokenValidForUser } from '../external/github';
import { removeGithubUsersLogin } from './githubUsers';
import { getDiscordCurrentUserInfo } from '../external/discord';

type GithubTokenData = {
  githubOAuthToken: string;
};

async function checkGithubTokenData(privyUserId: string): Promise<GithubTokenData | null> {
  const logger = createScopedLogger('getTokenDataWithGithubCheck');

  const githubUser = await context.prisma.githubUser.findUnique({
    where: { privyUserId },
    select: {
      id: true,
      githubId: true,
      githubHandle: true,
      githubOAuthToken: true,
    },
  });
  if (githubUser === null) {
    return null;
  }
  if (githubUser.githubOAuthToken === null) {
    logger.error(
      `Found a GithubUser ID ${githubUser.id} where privyUserId is set but not githubOAuthToken`,
    );
    await removeGithubUsersLogin(privyUserId);
    return null;
  }

  if (await isGithubTokenValidForUser(githubUser.githubOAuthToken, githubUser.githubId)) {
    return {
      ...githubUser,
      githubOAuthToken: githubUser.githubOAuthToken, // TS is stupid here...
    };
  }

  logger.info(`Removing invalid GitHub OAuth token for GithubUser githubId ${githubUser.githubId}`);

  await removeGithubUsersLogin(privyUserId);

  return null;
}

export type PrivyUserData = {
  privyUserId: string;
  address: AddressData | null;
  githubUser: GithubTokenData | null;
  email: EmailData | null;
  discord: DiscordData | null;
};

export async function verifyPrivyToken(privyAuthToken: string): Promise<PrivyUserData | null> {
  const logger = createScopedLogger('verifyPrivyToken');

  const privyUserData = await verifyPrivyTokenForData(context.privy, privyAuthToken);
  if (privyUserData === null) {
    logger.warn('Failed to verify token via Privy');
    return null;
  }

  // Used only in the case of errors
  const errorTail = `for Privy User ID ${privyUserData.privyUserId}`;

  let address: AddressData | null = null;
  if (privyUserData.ethAddress) {
    address = await upsertAddress(privyUserData.ethAddress);
    if (address === null) {
      logger.error(`Failed to upsert ETH address ${privyUserData.ethAddress} ${errorTail}`);
      return null;
    }

    // Resolve the ENS name in the background
    void resolveAddress(privyUserData.ethAddress);
  }

  const githubUser = await checkGithubTokenData(privyUserData.privyUserId);

  let email: EmailData | null = null;
  if (privyUserData.emailAddress) {
    email = upsertEmail(privyUserData.emailAddress);
    if (email === null) {
      logger.error(`Failed to upsert email address ${privyUserData.emailAddress} ${errorTail}`);
      return null;
    }
  }

  let discord: DiscordData | null = null;
  if (privyUserData.discordHandle) {
    const discordInfo = await getDiscordCurrentUserInfo(privyUserData.discordToken);
    if (discordInfo === null) {
      logger.error(`Failed to lookup discord info ${errorTail}`);
      return null;
    }

    discord = upsertDiscordUser(discordInfo.id, discordInfo.username);
    if (discord === null) {
      logger.error(`Failed to upsert discord handle ${discordInfo.username} ${errorTail}`);
      return null;
    }
  }

  return {
    ...privyUserData,
    address,
    githubUser,
    email,
    discord,
  };
}
