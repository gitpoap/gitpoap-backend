import { context } from '../context';
import { clearPOAPTokenInfoCache, retrievePOAPTokenInfo } from '../external/poap';
import { createScopedLogger } from '../logging';
import { upsertProfile } from './profiles';
import { Claim, ClaimStatus } from '@prisma/client';

export async function handleGitPOAPTransfer(
  claimId: number,
  poapTokenId: string,
  oldAddress: string,
  newAddress: string,
): Promise<Claim> {
  const logger = createScopedLogger('handleTransfer');

  // Delete a Feature for this GitPOAP if it exists
  await context.prisma.featuredPOAP.deleteMany({
    where: {
      poapTokenId,
      profile: {
        address: oldAddress,
      },
    },
  });

  // Ensure that a profile exists for the new address
  await upsertProfile(newAddress);

  return await context.prisma.claim.update({
    where: {
      id: claimId,
    },
    data: {
      address: newAddress.toLowerCase(),
      needsRevalidation: true,
    },
  });
}

export async function checkIfClaimTransferred(claimId: number): Promise<string | null> {
  const logger = createScopedLogger('checkIfClaimTransferred');

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
    logger.info(`Found transferred GitPOAP Token ID: ${claimId}`);

    await handleGitPOAPTransfer(
      claimId,
      claimData.poapTokenId as string,
      claimData.address as string,
      newData.owner,
    );
  }

  return newData.owner;
}
