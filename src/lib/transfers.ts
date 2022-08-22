import { context } from '../context';
import { clearPOAPTokenInfoCache, retrievePOAPTokenInfo } from '../external/poap';
import { createScopedLogger } from '../logging';
import { upsertProfile } from './profiles';
import { ClaimStatus } from '@prisma/client';

async function handleTransfer(
  claimId: number,
  poapTokenId: string,
  oldAddress: string,
  newAddress: string,
) {
  const logger = createScopedLogger('handleTransfer');

  const profileData = await context.prisma.profile.findUnique({
    where: {
      address: oldAddress.toLowerCase(),
    },
    select: {
      id: true,
    },
  });
  if (profileData === null) {
    logger.warn(`Failed to lookup profile for address with GitPOAP ID ${claimId}: ${oldAddress}`);
  } else {
    // Delete the featured status on the old profile if it exists
    // (use deleteMany so this doesn't throw)
    await context.prisma.featuredPOAP.deleteMany({
      where: {
        poapTokenId,
        profileId: profileData.id,
      },
    });
  }

  // Ensure that a profile exists for the new address
  await upsertProfile(newAddress);

  await context.prisma.claim.update({
    where: {
      id: claimId,
    },
    data: {
      address: newAddress.toLowerCase(),
    },
  });
}

export async function checkIfClaimTransfered(claimId: number): Promise<string | null> {
  const logger = createScopedLogger('checkIfClaimTransfered');

  const claimData = await context.prisma.claim.findUnique({
    where: {
      id: claimId,
    },
    select: {
      status: true,
      address: true,
      poapTokenId: true,
    },
  });
  if (claimData === null) {
    logger.warn(`Failed to find Claim with ID ${claimId}`);
    return null;
  }
  if (claimData.status !== ClaimStatus.CLAIMED) {
    return null;
  }

  logger.info(`Clearing POAP cache data for POAP Token ID ${claimData.poapTokenId}`);

  await clearPOAPTokenInfoCache(claimData.poapTokenId as string);

  const newData = await retrievePOAPTokenInfo(claimData.poapTokenId as string);

  if (newData.owner !== claimData.address) {
    logger.info(`Found transfered GitPOAP Token ID: ${claimId}`);

    await handleTransfer(
      claimId,
      claimData.poapTokenId as string,
      claimData.address as string,
      newData.owner,
    );
  }

  return newData.owner;
}
