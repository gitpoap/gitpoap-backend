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

    // We want to be able to assume that any address that is returned is valid
    if (!isAddress(ensName)) {
      logger.warn(`"${ensName} is not a valid address`);
      return null;
    }

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
        logger.warn(`${ensName} is not a valid address`);
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

const ENS_REVERSE_RESOLVE_CACHE_IS_FRESH_PREFIX = 'ens#reverseResolve/fresh';
// Purposely less than the TTL for the reverse resolve ENS cache
const ENS_REVERSE_RESOLVE_CACHE_IS_FRESH_TTL = 1 * SECONDS_PER_DAY;

const ENS_REVERSE_RESOLVE_CACHE_PREFIX = 'ens#reverseResolve';
const ENS_REVERSE_RESOLVE_CACHE_TTL = 5 * SECONDS_PER_DAY;

/**
 * ENS Reverse Resolution - Resolve an ETH address to an ENS name
 *
 * @param address - the ETH address to resolve
 * @returns the resolved ENS name associated with the ETH address or null
 */
export async function resolveAddress(address: string): Promise<string | null> {
  const logger = createScopedLogger('resolveAddress');

  if (!isAddress(address)) {
    logger.debug(`Skipping lookup since ${address} is not a valid address`);

    return null;
  }

  logger.debug(`Resolving ENS name for ${address}`);

  const [cachedResponse, isFresh] = await Promise.all([
    context.redis.getValue(ENS_REVERSE_RESOLVE_CACHE_PREFIX, address),
    context.redis.getValue(ENS_REVERSE_RESOLVE_CACHE_IS_FRESH_PREFIX, address),
  ]);

  if (cachedResponse) {
    logger.debug(`Found ENS resolution of ${address} in cache`);

    /* Simulate stale-while-revalidate cache behavior */
    if (!isFresh) {
      /* Do not await this, as we don't want to block the caller */
      lookupAddress(address);
    }

    return cachedResponse;
  }

  const resolvedName = await lookupAddress(address);

  return resolvedName;
}

async function lookupAddress(address: string): Promise<string | null> {
  const logger = createScopedLogger('lookupAddress');

  try {
    const endTimer = ensRequestDurationSeconds.startTimer('lookupAddress');
    const resolvedName = await context.provider.lookupAddress(address);
    endTimer();

    if (resolvedName !== null) {
      logger.debug(`Resolved ${address} to ${resolvedName}`);
    } else {
      logger.debug(`${address} is not associated with an ENS name`);
    }

    context.redis.setValue(
      ENS_REVERSE_RESOLVE_CACHE_IS_FRESH_PREFIX,
      address,
      'true',
      ENS_REVERSE_RESOLVE_CACHE_IS_FRESH_TTL,
    );

    /* Cache resolvedName regardless of whether it's null or not */
    context.redis.setValue(
      ENS_REVERSE_RESOLVE_CACHE_PREFIX,
      address,
      resolvedName ?? '',
      ENS_REVERSE_RESOLVE_CACHE_TTL,
    );

    return resolvedName;
  } catch (err) {
    logger.warn(`Got error from ethers.lookupAddress: ${err}`);
    return null;
  }
}
