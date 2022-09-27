import { createScopedLogger } from '../logging';
import { context } from '../context';
import {
  resolveAddressInternal,
  resolveENSAvatarInternal,
  resolveENSInternal,
} from '../external/ens';
import { getS3URL, s3configProfile, uploadFileFromURL } from '../external/s3';
import { SECONDS_PER_HOUR } from '../constants';

const ENS_NAME_LAST_RUN_CACHE_PREFIX = 'ens#name-last-run';
const ENS_AVATAR_LAST_RUN_CACHE_PREFIX = 'ens#avatar-last-run';

// Assume that these change infrequently
const ENS_NAME_MAX_CHECK_FREQUENCY_HOURS = 12;
const ENS_ADDRESS_MAX_CHECK_FREQUENCY_HOURS = 12;
const ENS_AVATAR_MAX_CHECK_FREQUENCY_HOURS = 6;

const DEFAULT_SVG_IMAGE_SIZE = 500;

const ENS_ADDRESS_CACHE_PREFIX = 'ens#address';
const ENS_AVATAR_CACHE_PREFIX = 'ens#avatar';

async function upsertENSNameInDB(address: string, ensName: string | null) {
  const addressLower = address.toLowerCase();

  await context.prisma.profile.upsert({
    where: {
      oldAddress: addressLower,
    },
    update: {
      oldEnsName: ensName,
    },
    create: {
      oldAddress: addressLower,
      oldEnsName: ensName,
    },
  });
}

async function upsertENSAvatarInDB(address: string, avatarURL: string | null) {
  const addressLower = address.toLowerCase();

  await context.prisma.profile.upsert({
    where: {
      oldAddress: addressLower,
    },
    update: {
      oldEnsAvatarImageUrl: avatarURL,
    },
    create: {
      oldAddress: addressLower,
      oldEnsAvatarImageUrl: avatarURL,
    },
  });
}

async function updateENSNameLastChecked(address: string) {
  context.redis.setValue(
    ENS_NAME_LAST_RUN_CACHE_PREFIX,
    address.toLowerCase(),
    'checked',
    ENS_NAME_MAX_CHECK_FREQUENCY_HOURS * SECONDS_PER_HOUR,
  );
}

async function updateENSName(address: string) {
  const logger = createScopedLogger('updateENSName');

  const addressLower = address.toLowerCase();

  const lastRunValue = await context.redis.getValue(ENS_NAME_LAST_RUN_CACHE_PREFIX, addressLower);
  if (lastRunValue !== null) {
    logger.debug(`Not enough time has elapsed to check for a new ENS name for ${address}`);
    return;
  }

  await updateENSNameLastChecked(addressLower);

  let ensName = await resolveAddressInternal(address);

  if (ensName !== null) {
    logger.info(`Stored ENS name ${ensName} for ${address}`);
  }

  await upsertENSNameInDB(address, ensName);

  return ensName;
}

async function resolveENSAvatar(ensName: string, resolvedAddress: string) {
  const logger = createScopedLogger('resolveAvatar');

  const lastRunValue = await context.redis.getValue(ENS_AVATAR_LAST_RUN_CACHE_PREFIX, ensName);
  if (lastRunValue !== null) {
    logger.debug(`Not enough time has elapsed to check for new avatars for ${ensName}`);
    return;
  }

  context.redis.setValue(
    ENS_AVATAR_LAST_RUN_CACHE_PREFIX,
    ensName,
    'checked',
    ENS_AVATAR_MAX_CHECK_FREQUENCY_HOURS * SECONDS_PER_HOUR,
  );

  const addressLower = resolvedAddress.toLowerCase();

  let avatarURL = await resolveENSAvatarInternal(ensName);

  if (avatarURL !== null) {
    if (!avatarURL.startsWith('data:')) {
      const response = await uploadFileFromURL(
        avatarURL,
        s3configProfile.buckets.ensAvatarCache,
        addressLower, // Using ENS may cause issues (emoji ENSs/etc)
        true, // Make the image publicly accessible
      );

      if (response === null) {
        logger.error(`Failed to upload ENS Avatar for ${ensName} at "${avatarURL}" to s3 cache`);
        return;
      }

      avatarURL = getS3URL(s3configProfile.buckets.ensAvatarCache, addressLower);

      logger.info(`Cached ENS avatar in s3 for ${ensName}`);
    } else {
      logger.info(`Saved "data:*" URL with ENS avatar for "${ensName}"`);
    }
  }

  await upsertENSAvatarInDB(addressLower, avatarURL);
}

/**
 * Resolve an ENS name to an ETH address.
 *
 * @param ensName - the ENS name to resolve
 * @param synchronous - should the function wait to return until ENS name & avatar checks are done
 * @returns the resolved ETH address associated with the ENS name or null
 */
export async function resolveENS(ensName: string, synchronous?: boolean): Promise<string | null> {
  const result = await resolveENSInternal(ensName);

  if (result !== null && ensName.endsWith('.eth')) {
    // Run in the background
    const avatarPromise = resolveENSAvatar(ensName, result);

    updateENSNameLastChecked(result);
    const namePromise = upsertENSNameInDB(result, ensName);

    if (synchronous) {
      await Promise.all([avatarPromise, namePromise]);
    }
  }

  return result;
}

/**
 * ENS Reverse Resolution - Resolve an ETH address to an ENS name
 *
 * @param address - the ETH address to resolve
 * @param synchronous - should the function wait to return until ENS avatar checks are done?
 * @returns the resolved ENS name associated with the ETH address or null
 */
export async function resolveAddress(
  address: string,
  synchronous?: boolean,
): Promise<string | null> {
  const result = await context.prisma.profile.findUnique({
    where: {
      oldAddress: address.toLowerCase(),
    },
    select: {
      oldEnsName: true,
    },
  });

  const namePromise = updateENSName(address);

  if (result !== null && result.oldEnsName !== null) {
    const avatarPromise = resolveENSAvatar(result.oldEnsName, address);

    if (synchronous) {
      await Promise.all([namePromise, avatarPromise]);
    }

    return result.oldEnsName;
  } else if (synchronous) {
    await namePromise;
  }

  return null;
}

// This should only be used for addresses that are known to not have a
// Profile associated with them (e.g. if the user checks their profile but they
// have no UNCLAIMED Claims or GitPOAPs)
export async function resolveAddressCached(address: string): Promise<string | null> {
  const logger = createScopedLogger('resolveAddressCached');

  const addressLower = address.toLowerCase();

  const cacheResponse = await context.redis.getValue(ENS_ADDRESS_CACHE_PREFIX, addressLower);

  if (cacheResponse !== null) {
    logger.debug(`Found resolved ENS name for address ${address} in cache`);

    return JSON.parse(cacheResponse).ensName;
  }

  logger.debug(`Resolving non-Profile ENS name for address ${address}`);

  const ensName = await resolveAddressInternal(address);

  context.redis.setValue(
    ENS_ADDRESS_CACHE_PREFIX,
    addressLower,
    JSON.stringify({ ensName }),
    ENS_ADDRESS_MAX_CHECK_FREQUENCY_HOURS * SECONDS_PER_HOUR,
  );

  return ensName;
}

// This should only be used for addresses that are known to not have a
// Profile associated with them (e.g. if the user checks their profile but they
// have no UNCLAIMED Claims or GitPOAPs)
export async function resolveENSAvatarCached(ensName: string): Promise<string | null> {
  const logger = createScopedLogger('resolveENSAvatarCached');

  const cacheResponse = await context.redis.getValue(ENS_AVATAR_CACHE_PREFIX, ensName);

  if (cacheResponse !== null) {
    logger.debug(`Found resolved ENS avatar for ENS name ${ensName} in cache`);

    return JSON.parse(cacheResponse).avatarURL;
  }

  logger.debug(`Resolving non-Profile ENS avatar for ENS name ${ensName}`);

  const avatarURL = await resolveENSAvatarInternal(ensName);

  context.redis.setValue(
    ENS_AVATAR_CACHE_PREFIX,
    ensName,
    JSON.stringify({ avatarURL }),
    ENS_AVATAR_MAX_CHECK_FREQUENCY_HOURS * SECONDS_PER_HOUR,
  );

  return avatarURL;
}
