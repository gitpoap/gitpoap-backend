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

async function upsertENSNameInDB(address: string, ensName: string | null) {
  const addressLower = address.toLowerCase();

  const addressRecord = await context.prisma.address.upsert({
    where: { ethAddress: addressLower },
    update: { ensName },
    create: { ethAddress: addressLower, ensName },
  });

  await context.prisma.profile.upsert({
    where: {
      addressId: addressRecord.id,
    },
    update: {},
    create: {
      addressId: addressRecord.id,
    },
  });
}

async function upsertENSAvatarInDB(address: string, avatarURL: string | null) {
  const addressLower = address.toLowerCase();

  const addressRecord = await context.prisma.address.upsert({
    where: { ethAddress: addressLower },
    update: { ensAvatarImageUrl: avatarURL },
    create: { ethAddress: addressLower, ensAvatarImageUrl: avatarURL },
  });

  await context.prisma.profile.upsert({
    where: {
      addressId: addressRecord.id,
    },
    update: {},
    create: {
      addressId: addressRecord.id,
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

  const ensName = await resolveAddressInternal(address);

  if (ensName !== null) {
    logger.info(`Stored ENS name ${ensName} for ${address}`);
  }

  await upsertENSNameInDB(address, ensName);

  return ensName;
}

export async function resolveENSAvatar(
  ensName: string,
  resolvedAddress: string,
  forceCheck: boolean = false,
) {
  const logger = createScopedLogger('resolveAvatar');

  if (!forceCheck) {
    const lastRunValue = await context.redis.getValue(ENS_AVATAR_LAST_RUN_CACHE_PREFIX, ensName);
    if (lastRunValue !== null) {
      logger.debug(`Not enough time has elapsed to check for new avatars for ${ensName}`);
      return;
    }
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
 * @param forceAvatarCheck - should the ENS avatar check be forced to run? (default: false)
 * @param synchronous - should the function wait to return until ENS name & avatar checks are done? (default: false)
 * @returns the resolved ETH address associated with the ENS name or null
 */
export async function resolveENS(
  ensName: string,
  forceAvatarCheck: boolean = false,
  synchronous: boolean = false,
): Promise<string | null> {
  const result = await resolveENSInternal(ensName);

  if (result !== null && ensName.endsWith('.eth')) {
    // Run in the background
    const avatarPromise = resolveENSAvatar(ensName, result, forceAvatarCheck);

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
 * @param forceAvatarCheck - should the ENS avatar check be forced to run? (default: false)
 * @param synchronous - should the function wait to return until ENS avatar checks are done? (default: false)
 * @returns the resolved ENS name associated with the ETH address or null
 */
export async function resolveAddress(
  address: string,
  forceAvatarCheck: boolean = false,
  synchronous: boolean = false,
): Promise<string | null> {
  const result = await context.prisma.address.findUnique({
    where: {
      ethAddress: address.toLowerCase(),
    },
    select: {
      ensName: true,
    },
  });

  const namePromise = updateENSName(address);

  if (result !== null && result.ensName !== null) {
    const avatarPromise = resolveENSAvatar(result.ensName, address, forceAvatarCheck);

    if (synchronous) {
      await Promise.all([namePromise, avatarPromise]);
    }

    return result.ensName;
  } else if (synchronous) {
    await namePromise;
  }

  return null;
}
