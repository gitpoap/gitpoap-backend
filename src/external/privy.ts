import { PrivyClient } from '@privy-io/server-auth';
import { PRIVY_APP_ID, PRIVY_APP_SECRET } from '../environment';
import { createScopedLogger } from '../logging';

export function createPrivyClient() {
  return new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET);
}

export type PrivyUserData = {
  privyUserId: string;
  ethAddress: string | null;
};

export async function verifyPrivyTokenForData(
  privyClient: PrivyClient,
  privyAuthToken: string,
): Promise<PrivyUserData | null> {
  const logger = createScopedLogger('verifyPrivyToken');

  try {
    const verifiedClaims = await privyClient.verifyAuthToken(privyAuthToken);
    const userData = await privyClient.getUser(verifiedClaims.userId);

    let ethAddress: string | null = null;
    if (userData.wallet !== undefined) {
      if (userData.wallet.chainType === 'ethereum') {
        ethAddress = userData.wallet.address;
      } else {
        logger.warn("User's wallet is not an ETH wallet");
      }
    }

    return {
      privyUserId: verifiedClaims.userId,
      ethAddress,
    };
  } catch (err) {
    logger.warn('Privy failed to verify token');
    return null;
  }
}
