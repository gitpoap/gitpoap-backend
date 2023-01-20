import { PrivyClient } from '@privy-io/server-auth';
import { PRIVY_APP_ID, PRIVY_APP_SECRET } from '../environment';
import { createScopedLogger } from '../logging';

export function createPrivyClient() {
  return new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET);
}

type PrivyDiscordDataResult = {
  discordId: string;
  discordHandle: string;
};

export type VerifyPrivyUserForDataResult = {
  privyUserId: string;
  ethAddress: string | null;
  emailAddress: string | null;
  discord: PrivyDiscordDataResult | null;
};

export async function verifyPrivyTokenForData(
  privyClient: PrivyClient,
  privyAuthToken: string,
): Promise<VerifyPrivyUserForDataResult | null> {
  const logger = createScopedLogger('verifyPrivyToken');

  try {
    const verifiedClaims = await privyClient.verifyAuthToken(privyAuthToken);
    const userData = await privyClient.getUser(verifiedClaims.userId);

    let ethAddress: string | null = null;
    if (userData.wallet !== undefined) {
      if (userData.wallet.chainType === 'ethereum') {
        ethAddress = userData.wallet.address.toLowerCase();
      } else {
        logger.warn("User's wallet is not an ETH wallet");
      }
    }

    let discord: PrivyDiscordDataResult | null = null;
    if (userData.discord?.username) {
      discord = {
        discordId: userData.discord.subject,
        discordHandle: userData.discord.username,
      };
    }

    return {
      privyUserId: verifiedClaims.userId,
      ethAddress,
      emailAddress: userData.email?.address.toLowerCase() ?? null,
      discord,
    };
  } catch (err) {
    logger.warn('Privy failed to verify token');
    return null;
  }
}
