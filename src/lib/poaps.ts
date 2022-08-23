import { context } from '../context';
import { retrieveUsersPOAPs, retrievePOAPEventInfo } from '../external/poap';
import { Claim, ClaimStatus, GitPOAP } from '@generated/type-graphql';
import { createScopedLogger } from '../logging';
import { POAPEvent, POAPToken } from '../types/poap';
import { checkIfClaimTransferred, handleGitPOAPTransfer } from './transfers';

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

// Generate a set of all the POAPEventIds that are GitPOAP Events
async function generateGitPOAPPOAPEventIdSet() {
  const gitPOAPs = await context.prisma.gitPOAP.findMany({
    select: {
      poapEventId: true,
    },
  });

  let poapEventIdSet = new Set<number>();

  for (const gitPOAP of gitPOAPs) {
    poapEventIdSet.add(gitPOAP.poapEventId);
  }

  return poapEventIdSet;
}

// Note that address CANNOT be an ENS
export async function splitUsersPOAPs(address: string): Promise<SplitUsersPOAPsReturnType | null> {
  const logger = createScopedLogger('splitUsersPOAPs');

  const addressLower = address.toLowerCase();

  // Call the POAP API, and generate the POAP Event ID Set in the background
  const poapsPromise = retrieveUsersPOAPs(addressLower);
  const gitPOAPPOAPEventIdSetPromise = generateGitPOAPPOAPEventIdSet();

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
        // Skip the Token in a bad state
        continue;
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

  // All the POAP Event IDs that are GitPOAP Events
  const gitPOAPPOAPEventIdSet = await gitPOAPPOAPEventIdSetPromise;

  // List of POAPs that are NOT GitPOAPs
  const poapsOnly: POAPToken[] = [];

  // All the POAP Token IDs that were found for the address
  const foundPOAPIds = new Set<string>();

  for (const poap of poaps) {
    foundPOAPIds.add(poap.tokenId);

    if (poap.tokenId in poapIdToClaimMap) {
      gitPOAPsOnly.push({
        claim: poapIdToClaimMap[poap.tokenId],
        event: poap.event,
      });
    } else {
      // If this POAP belongs to a GitPOAP Event we need to check if it
      // was just transferred to this account
      if (gitPOAPPOAPEventIdSet.has(poap.event.id)) {
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
            addressLower,
          );

          gitPOAPsOnly.push({
            claim: { ...updatedClaim, gitPOAP: claimData.gitPOAP },
            event: poap.event,
          });
          continue;
        }
      }

      // Fallback to it being a POAP
      poapsOnly.push(poap);
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

    // If some claim that is marked in our DB as belonging to the address is no
    // longer in their set of POAPs, we need to handle its transfer
    for (const claim of claims) {
      if (claim.poapTokenId !== null && !(claim.poapTokenId in foundPOAPIds)) {
        // Run this in the background
        checkIfClaimTransferred(claim.id);
      }
    }
  };

  // Run this in the background
  postProcessing();

  // Return immediately
  return { gitPOAPsOnly, poapsOnly };
}
