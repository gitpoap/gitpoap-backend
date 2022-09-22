import { createScopedLogger } from '../logging';
import { context } from '../context';
import { ensRequestDurationSeconds } from '../metrics';
import { isAddress } from 'ethers/lib/utils';

/**
 * Resolve an ENS name to an ETH address.
 * NOTE: You should be calling the function in src/lib/ens instead of this!
 *
 * @param ensName - the ENS name to resolve
 * @returns the resolved ETH address associated with the ENS name or null
 */
export async function resolveENSInternal(ensName: string): Promise<string | null> {
  const logger = createScopedLogger('resolveENSInternal');

  if (!ensName.endsWith('.eth')) {
    logger.debug("Skipping lookup since ensName doesn't end with '.eth'");

    // We want to be able to assume that any address that is returned is valid
    if (!isAddress(ensName)) {
      logger.warn(`"${ensName} is not a valid address`);
      return null;
    }

    return ensName;
  }

  logger.info(`Resolving address for ENS name ${ensName}`);

  try {
    const endTimer = ensRequestDurationSeconds.startTimer('resolveName');

    const resolvedAddress = await context.provider.resolveName(ensName);

    endTimer();

    if (ensName !== resolvedAddress) {
      logger.debug(`Resolved ${ensName} to ${resolvedAddress}`);
      if (resolvedAddress === null) {
        logger.warn(`${ensName} is not a valid address`);
        return null;
      }
    }

    return resolvedAddress;
  } catch (err) {
    logger.warn(`Got error from ethers.resolveName: ${err}`);
    return null;
  }
}

/**
 * ENS Reverse Resolution - Resolve an ETH address to an ENS name
 * NOTE: You should be calling the function in src/lib/ens instead of this!
 *
 * @param address - the ETH address to resolve
 * @returns the resolved ENS name associated with the ETH address or null
 */
export async function resolveAddressInternal(address: string): Promise<string | null> {
  const logger = createScopedLogger('resolveAddressInternal');

  if (!isAddress(address)) {
    logger.debug(`Skipping lookup since ${address} is not a valid address`);

    return null;
  }

  logger.info(`Resolving ENS name for ${address}`);

  try {
    const endTimer = ensRequestDurationSeconds.startTimer('resolveAddressInternal');
    const resolvedName = await context.provider.lookupAddress(address);
    endTimer();

    if (resolvedName !== null) {
      logger.debug(`Resolved ${address} to ${resolvedName}`);
    } else {
      logger.debug(`${address} is not associated with an ENS name`);
    }

    return resolvedName;
  } catch (err) {
    logger.warn(`Got error from ethers.lookupAddress: ${err}`);
    return null;
  }
}

export async function resolveENSAvatarInternal(ensName: string): Promise<string | null> {
  const logger = createScopedLogger('resolveENSAvatarInternal');

  logger.info(`Resolving ENS Avatar for ${ensName}`);

  try {
    const endTimer = ensRequestDurationSeconds.startTimer('getAvatar');
    const avatarURL = await context.provider.getAvatar(ensName);
    endTimer();

    return avatarURL;
  } catch (err) {
    logger.warn(`Got error from ethers.getAvatar: ${err}`);
    return null;
  }
}
