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
        address: {
          ethAddress: oldAddress,
        },
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
      mintedAddress: {
        connect: {
          ethAddress: newAddress.toLowerCase(),
        },
      },
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
      mintedAddress: true,
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

  const poapTokenId = claimData.poapTokenId;

  if (poapTokenId === null) {
    return null;
  }

  const address = claimData.mintedAddress?.ethAddress ?? null;

  if (address === null) {
    logger.error(`Claim ID ${claimId} has poapTokenId set but address is null`);
    return null;
  }

  logger.info(`Clearing POAP cache data for POAP Token ID ${claimData.poapTokenId}`);

  await clearPOAPTokenInfoCache(poapTokenId);

  const newData = await retrievePOAPTokenInfo(poapTokenId);

  if (newData === null) {
    logger.error(`Failed to retrieve POAP Token ID ${poapTokenId} from POAP API`);
    return null;
  }

  if (newData.owner !== claimData.mintedAddress?.ethAddress) {
    logger.info(`Found transferred GitPOAP Token ID: ${claimId}`);

    await handleGitPOAPTransfer(claimId, poapTokenId, address, newData.owner);
  }

  return newData.owner;
}
