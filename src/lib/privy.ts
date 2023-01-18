import { verifyPrivyTokenForData } from '../external/privy';
import { context } from '../context';
import { createScopedLogger } from '../logging';
import { upsertAddress } from './addresses';
import { resolveAddress } from './ens';
import { isGithubTokenValidForUser } from '../external/github';
import { removeGithubUsersLogin } from './githubUsers';

type GithubTokenData = {
  githubId: number;
  githubHandle: string;
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
  addressId: number;
  ethAddress: string;
  githubUser: GithubTokenData | null;
  emailAddress: string | null;
  discordHandle: string | null;
};

export async function verifyPrivyToken(privyAuthToken: string): Promise<PrivyUserData | null> {
  const logger = createScopedLogger('verifyPrivyToken');

  const privyUserData = await verifyPrivyTokenForData(context.privy, privyAuthToken);
  if (privyUserData === null) {
    logger.warn('Failed to verify token via Privy');
    return null;
  }
  if (privyUserData.ethAddress === null) {
    logger.warn(`Privy User ID ${privyUserData.privyUserId} doesn't have an associated address`);
    return null;
  }

  const address = await upsertAddress(privyUserData.ethAddress);
  if (address === null) {
    logger.error(`Failed to upsert address for Privy User ID ${privyUserData.privyUserId}`);
    return null;
  }

  const githubUser = await checkGithubTokenData(privyUserData.privyUserId);

  // Resolve the ENS name in the background
  void resolveAddress(privyUserData.ethAddress);

  return {
    ...privyUserData,
    ethAddress: privyUserData.ethAddress, // TS is stupid here....
    addressId: address.id,
    githubUser,
  };
}
