import { createScopedLogger } from '../logging';
import { context } from '../context';
import { ensRequestDurationSeconds } from '../metrics';
import { SECONDS_PER_DAY } from '../constants';
import { isAddress } from 'ethers/lib/utils';

const ENS_RESOLVE_CACHE_PREFIX = 'ens#resolve';
const ENS_RESOLVE_CACHE_TTL = 30 * SECONDS_PER_DAY; // 30 days

/**
 * Resolve an ENS name to an ETH address.
 *
 * @param ensName - the ENS name to resolve
 * @returns the resolved ETH address associated with the ENS name or null
 */
export async function resolveENS(ensName: string): Promise<string | null> {
  const logger = createScopedLogger('resolveENS');

  if (!ensName.endsWith('.eth')) {
    logger.debug("Skipping lookup since ensName doesn't end with '.eth'");
    return ensName;
  }

  const cacheResponse = await context.redis.getValue(ENS_RESOLVE_CACHE_PREFIX, ensName);

  if (cacheResponse !== null) {
    logger.debug(`Found ENS resolution of ${ensName} in cache`);

    return cacheResponse;
  }

  logger.debug(`ENS resolution of ${ensName} not in cache`);

  try {
    const endTimer = ensRequestDurationSeconds.startTimer('resolveName');

    const resolvedAddress = await context.provider.resolveName(ensName);

    endTimer();

    if (ensName !== resolvedAddress) {
      logger.debug(`Resolved ${ensName} to ${resolvedAddress}`);
      if (resolvedAddress === null) {
        logger.debug(`${ensName} is not a valid address`);
        return null;
      }
    }

    // Set TTL to 30 days since we assume ENS will change infrequently
    context.redis.setValue(
      ENS_RESOLVE_CACHE_PREFIX,
      ensName,
      resolvedAddress,
      ENS_RESOLVE_CACHE_TTL,
    );

    return resolvedAddress;
  } catch (err) {
    logger.warn(`Got error from ethers.resolveName: ${err}`);
    return null;
  }
}
