import { verifyPrivyTokenForData } from '../external/privy';
import { context } from '../context';
import { createScopedLogger } from '../logging';
import { upsertAddress } from './addresses';
import { resolveAddress } from './ens';
import { isGithubTokenValidForUser } from '../external/github';
import { removeGithubUsersLogin } from './githubUsers';
import { AddressPayload, GithubPayload, EmailPayload, DiscordPayload } from '../types/authTokens';
import { upsertEmail } from './emails';
import { upsertDiscordUser } from './discordUsers';

type GithubTokenData = GithubPayload & {
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
    await removeGithubUsersLogin(githubUser.id);
    return null;
  }

  if (await isGithubTokenValidForUser(githubUser.githubOAuthToken, githubUser.githubId)) {
    return {
      ...githubUser,
      githubOAuthToken: githubUser.githubOAuthToken, // TS is stupid here...
    };
  }

  logger.info(`Removing invalid GitHub OAuth token for GithubUser githubId ${githubUser.githubId}`);

  await removeGithubUsersLogin(githubUser.id);

  return null;
}

export type PrivyUserData = {
  privyUserId: string;
  address: AddressPayload | null;
  github: GithubTokenData | null;
  email: EmailPayload | null;
  discord: DiscordPayload | null;
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

  let address: AddressPayload | null = null;
  if (privyUserData.ethAddress) {
    address = await upsertAddress(privyUserData.ethAddress);

    // Resolve the ENS name in the background
    void resolveAddress(privyUserData.ethAddress);
  }

  const github = await checkGithubTokenData(privyUserData.privyUserId);

  let email: EmailPayload | null = null;
  if (privyUserData.emailAddress) {
    email = await upsertEmail(privyUserData.emailAddress);
    if (email === null) {
      logger.error(`Failed to upsert email address ${privyUserData.emailAddress} ${errorTail}`);
      return null;
    }
  }

  let discord: DiscordPayload | null = null;
  if (privyUserData.discord) {
    discord = await upsertDiscordUser(
      privyUserData.discord.discordId,
      privyUserData.discord.discordHandle,
    );
  }

  return {
    ...privyUserData,
    address,
    github,
    email,
    discord,
  };
}
