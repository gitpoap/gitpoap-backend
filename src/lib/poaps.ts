import { context } from '../context';
import { retrieveUsersPOAPs, retrievePOAPEventInfo } from '../external/poap';
import { Claim, ClaimStatus, GitPOAP } from '@generated/type-graphql';
import { createScopedLogger } from '../logging';
import { POAPEvent, POAPToken } from '../types/poap';
import { checkIfClaimTransfered, handleGitPOAPTransfer } from './transfers';

type ClaimWithGitPOAP = Claim & {
  gitPOAP: GitPOAP;
};

type GitPOAPReturnData = {
  claim: ClaimWithGitPOAP;
  event: POAPEvent;
};

export type SplitUsersPOAPsReturnType = {
  gitPOAPsOnly: GitPOAPReturnData[];
  poapsOnly: POAPToken[];
};

export async function splitUsersPOAPs(address: string): Promise<SplitUsersPOAPsReturnType | null> {
  const logger = createScopedLogger('splitUsersPOAPs');

  const addressLower = address.toLowerCase();

  // Call the POAP API in the background
  const poapsPromise = retrieveUsersPOAPs(addressLower);

  const claims = await context.prisma.claim.findMany({
    where: {
      address: addressLower,
      status: { in: [ClaimStatus.CLAIMED, ClaimStatus.MINTING] },
    },
    include: {
      gitPOAP: true,
    },
  });

  // Map from POAP Token ID to their corresponding Claim objects
  const poapIdToClaimMap: Record<string, ClaimWithGitPOAP> = {};

  // List of GitPOAPs
  const gitPOAPsOnly: GitPOAPReturnData[] = [];

  for (const claim of claims) {
    if (claim.poapTokenId === null) {
      if (claim.status !== ClaimStatus.MINTING) {
        logger.error(`Found a null poapTokenId, but the Claim ID ${claim.id} has status CLAIMED`);
      } else {
        const event = await retrievePOAPEventInfo(claim.gitPOAP.poapEventId);
        if (event === null) {
          logger.error(
            `Failed to look up poapEventId: ${claim.gitPOAP.poapEventId} on GitPOAP: ${claim.gitPOAP.id}`,
          );
          // Since it's minting, let's just skip it
          continue;
        }
        // We can safely assume minting GitPOAPs haven't been transferred
        gitPOAPsOnly.push({ claim, event });
      }
    } else {
      poapIdToClaimMap[claim.poapTokenId] = claim;
    }
  }

  const poaps = await poapsPromise;
  if (poaps === null) {
    logger.error(`Failed to query POAPs from POAP API for address: ${address}`);
    return null;
  }

  const poapsOnly: POAPToken[] = [];

  const foundPOAPIds = new Set<string>();
  for (const poap of poaps) {
    foundPOAPIds.add(poap.tokenId);

    if (poap.tokenId in poapIdToClaimMap) {
      gitPOAPsOnly.push({
        claim: poapIdToClaimMap[poap.tokenId],
        event: poap.event,
      });
    } else {
      // We need to check if this is actually a GitPOAP that was just
      // transfered to this account
      const claimData = await context.prisma.claim.findUnique({
        where: {
          poapTokenId: poap.tokenId,
        },
        select: {
          id: true,
          address: true,
          gitPOAP: true,
        },
      });

      if (claimData !== null) {
        // Here we assume that the user didn't just claim this during this function's run
        const updatedClaim = await handleGitPOAPTransfer(
          claimData.id,
          poap.tokenId,
          claimData.address as string,
          address,
        );

        gitPOAPsOnly.push({
          claim: { ...updatedClaim, gitPOAP: claimData.gitPOAP },
          event: poap.event,
        });
      } else {
        poapsOnly.push(poap);
      }
    }
  }

  // We need to make sure we've updated GitPOAPs transferred FROM this profile
  // And we need to delete any featured POAPs they no longer control
  const postProcessing = async () => {
    const featuredData = await context.prisma.featuredPOAP.findMany({
      where: {
        profile: {
          address: addressLower,
        },
      },
      select: {
        id: true,
        poapTokenId: true,
      },
    });

    for (const feature of featuredData) {
      if (!(feature.poapTokenId in foundPOAPIds)) {
        await context.prisma.featuredPOAP.delete({
          where: {
            id: feature.id,
          },
        });
      }
    }

    for (const claim of claims) {
      if (claim.poapTokenId !== null && !(claim.poapTokenId in foundPOAPIds)) {
        // Run this in the background
        checkIfClaimTransfered(claim.id);
      }
    }
  };

  // Run this in the background
  postProcessing();

  // Return immediately
  return { gitPOAPsOnly, poapsOnly };
}
