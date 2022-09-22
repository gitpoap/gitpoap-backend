import { createScopedLogger } from '../logging';
import { context } from '../context';
import {
  resolveAddressInternal,
  resolveENSAvatarInternal,
  resolveENSInternal,
} from '../external/ens';
import { ContentTypeCallback, getS3URL, s3configProfile, uploadFileFromURL } from '../external/s3';
import { SECONDS_PER_HOUR } from '../constants';
import sharp from 'sharp';

const ENS_NAME_LAST_RUN_CACHE_PREFIX = 'ens#name-last-run';
const ENS_AVATAR_LAST_RUN_CACHE_PREFIX = 'ens#avatar-last-run';

// Assume that these change infrequently
const ENS_NAME_MAX_CHECK_FREQUENCY_HOURS = 12;
const ENS_AVATAR_MAX_CHECK_FREQUENCY_HOURS = 6;

const DEFAULT_SVG_IMAGE_SIZE = 500;

async function updateENSNameInDB(address: string, ensName: string | null) {
  const logger = createScopedLogger('updateENSNameInDB');

  // Catch throws in the case the profile doesn't exist (yet)
  try {
    await context.prisma.profile.update({
      where: {
        oldAddress: address.toLowerCase(),
      },
      data: {
        oldEnsName: ensName,
      },
    });
  } catch (err) {
    logger.debug(`Caught error while update ENS for ${address}: ${err}`);
  }
}

async function updateENSAvatarInDB(address: string, avatarURL: string | null) {
  const logger = createScopedLogger('updateENSAvatarInDB');

  // Catch throws in the case the profile doesn't exist (yet)
  try {
    await context.prisma.profile.update({
      where: {
        oldAddress: address.toLowerCase(),
      },
      data: {
        oldEnsAvatarImageUrl: avatarURL,
      },
    });
  } catch (err) {
    logger.debug(`Caught error while update ENS for ${address}: ${err}`);
  }
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

  let ensName = await resolveENSInternal(address);

  if (ensName !== null) {
    logger.info(`Stored ENS name ${ensName} for ${address}`);
  }

  await updateENSNameInDB(address, ensName);

  return ensName;
}

const contentTypeCallback: ContentTypeCallback = async (contentType: string, buffer: Buffer) => {
  if (contentType === 'image/svg+xml') {
    const newBuffer = await sharp(buffer).resize(DEFAULT_SVG_IMAGE_SIZE).png().toBuffer();

    return {
      contentType: 'image/png',
      buffer: newBuffer,
    };
  } else {
    return { contentType, buffer };
  }
};

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
    const response = await uploadFileFromURL(
      avatarURL,
      s3configProfile.buckets.ensAvatarCache,
      addressLower, // Using ENS may cause issues (emoji ENSs/etc)
      true, // Make the image publicly accessible
      contentTypeCallback, // Convert SVGs to PNGs before uploading
    );

    if (response === null) {
      logger.error(`Failed to upload ENS Avatar for ${ensName} at "${avatarURL}" to s3 cache`);
      return;
    }

    avatarURL = getS3URL(s3configProfile.buckets.ensAvatarCache, addressLower);

    logger.info(`Cached ENS avatar for ${ensName}`);
  }

  await updateENSAvatarInDB(addressLower, avatarURL);
}

/**
 * Resolve an ENS name to an ETH address.
 *
 * @param ensName - the ENS name to resolve
 * @returns the resolved ETH address associated with the ENS name or null
 */
export async function resolveENS(ensName: string): Promise<string | null> {
  const result = await resolveENSInternal(ensName);

  if (result !== null && ensName.endsWith('.eth')) {
    // Run in the background
    resolveENSAvatar(ensName, result);

    updateENSNameLastChecked(result);
    updateENSNameInDB(result, ensName);
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
