import { PrivyClient } from '@privy-io/server-auth';
import { PRIVY_APP_ID, PRIVY_APP_SECRET } from '../environment';
import { createScopedLogger } from '../logging';

export function createPrivyClient() {
  return new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET);
}

export type PrivyUserData = {
  privyUserId: string;
  address: string | null;
};

export async function verifyPrivyTokenForData(
  privyClient: PrivyClient,
  userId: number,
  privyAuthToken: string,
): Promise<PrivyUserData | null> {
  const logger = createScopedLogger('verifyPrivyToken');

  try {
    const verifiedClaims = await privyClient.verifyAuthToken(privyAuthToken);
    const userData = await privyClient.getUser(verifiedClaims.userId);

    return {
      privyUserId: verifiedClaims.userId,
      address: userData.wallet?.address ?? null,
    };
  } catch (err) {
    logger.warn(`Privy failed to verify token for User ID ${userId}`);
    return null;
  }
}
