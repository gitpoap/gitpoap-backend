import { verifyPrivyTokenForData } from '../external/privy';
import { context } from '../context';
import { createScopedLogger } from '../logging';
import { upsertAddress } from './addresses';
import { resolveAddress } from './ens';

export type PrivyUserData = {
  addressId: number;
  ethAddress: string;
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

  // Resolve the ENS name in the background
  void resolveAddress(privyUserData.ethAddress);

  return {
    ...privyUserData,
    ethAddress: privyUserData.ethAddress, // TS is stupid here....
    addressId: address.id,
  };
}
