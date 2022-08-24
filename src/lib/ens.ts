import { createScopedLogger } from '../logging';
import { context } from '../context';
import { getAvatar, resolveENSInternal, resolveAddressInternal } from '../external/ens';
import { uploadFileFromURL, s3configProfile, getS3URL } from '../external/s3';

async function resolveENSAvatar(ensName: string, resolvedAddress: string) {
  const logger = createScopedLogger('resolveAvatar');

  const addressLower = resolvedAddress.toLowerCase();

  let avatarURL = await getAvatar(ensName);

  if (avatarURL !== null) {
    const response = await uploadFileFromURL(
      avatarURL,
      s3configProfile.buckets.ensAvatarCache,
      addressLower,
    );

    if (response === null) {
      logger.error(`Failed to upload ENS Avatar for ${ensName} at "${avatarURL}" to s3 cache`);
      return;
    }

    avatarURL = getS3URL(s3configProfile.buckets.ensAvatarCache, addressLower);

    logger.info(`Cached ENS avatar for ${ensName}`);
  }

  await context.prisma.profile.update({
    where: {
      address: addressLower,
    },
    data: {
      ensAvatarImageUrl: avatarURL,
    },
  });
}

/**
 * Resolve an ENS name to an ETH address.
 *
 * @param ensName - the ENS name to resolve
 * @returns the resolved ETH address associated with the ENS name or null
 */
export async function resolveENS(ensName: string): Promise<string | null> {
  const result = await resolveENSInternal(ensName);

  if (result !== null) {
    // Run in the background
    resolveENSAvatar(ensName, result);
  }

  return result;
}

/**
 * ENS Reverse Resolution - Resolve an ETH address to an ENS name
 *
 * @param address - the ETH address to resolve
 * @returns the resolved ENS name associated with the ETH address or null
 */
export async function resolveAddress(address: string): Promise<string | null> {
  const result = await resolveAddressInternal(address);

  if (result !== null) {
    // Run in the background
    resolveENSAvatar(result, address);
  }

  return result;
}
