import { createScopedLogger } from '../logging';
import { context } from '../context';
import { ensRequestDurationSeconds } from '../metrics';
import { SECONDS_PER_DAY } from '../constants';

const ENS_RESOLVE_CACHE_PREFIX = 'ens#resolve';
const ENS_RESOLVE_CACHE_TTL = 30 * SECONDS_PER_DAY; // 30 days

export async function resolveENS(address: string): Promise<string | null> {
  const logger = createScopedLogger('resolveENS');

  if (!address.endsWith('.eth')) {
    logger.debug("Skipping lookup since address doesn't end with '.eth'");
    return address;
  }

  const cacheResponse = await context.redis.getValue(ENS_RESOLVE_CACHE_PREFIX, address);

  if (cacheResponse !== null) {
    logger.debug(`Found ENS resolution of ${address} in cache`);

    return cacheResponse;
  }

  logger.debug(`ENS resolution of ${address} not in cache`);

  try {
    const endTimer = ensRequestDurationSeconds.startTimer('resolveName');

    const resolvedAddress = await context.provider.resolveName(address);

    endTimer();

    if (address !== resolvedAddress) {
      logger.debug(`Resolved ${address} to ${resolvedAddress}`);
      if (resolvedAddress === null) {
        logger.debug(`${address} is not a valid address`);
        return null;
      }
    }

    // Set TTL to 30 days since we assume ENS will change infrequently
    context.redis.setValue(
      ENS_RESOLVE_CACHE_PREFIX,
      address,
      resolvedAddress,
      ENS_RESOLVE_CACHE_TTL,
    );

    return resolvedAddress;
  } catch (err) {
    logger.warn(`Got error from ethers.resolveName: ${err}`);
    return null;
  }
}
