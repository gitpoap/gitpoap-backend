import { createScopedLogger } from '../logging';
import { context } from '../context';

const ENS_RESOLVE_CACHE_PREFIX = 'ens#resolve';

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
    const resolvedAddress = await context.provider.resolveName(address);
    if (address !== resolvedAddress) {
      logger.debug(`Resolved ${address} to ${resolvedAddress}`);
      if (resolvedAddress === null) {
        logger.debug(`${address} is not a valid address`);
        return null;
      }
    }

    // Set no TTL since we assume ENS resolutions won't change
    context.redis.setValue(ENS_RESOLVE_CACHE_PREFIX, address, resolvedAddress);

    return resolvedAddress;
  } catch (err) {
    logger.warn(`Got error from ethers.resolveName: ${err}`);
    return null;
  }
}
