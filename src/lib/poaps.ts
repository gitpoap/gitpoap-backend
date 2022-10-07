import { context } from '../context';
import { retrieveUsersPOAPs, retrievePOAPEventInfo } from '../external/poap';
import { Claim, ClaimStatus, GitPOAP, Project, Repo, User } from '@generated/type-graphql';
import { createScopedLogger } from '../logging';
import { POAPEvent, POAPToken } from '../types/poap';
import { checkIfClaimTransferred, handleGitPOAPTransfer } from './transfers';

type ExtendedClaimProjectType = Project & {
  repos: Repo[];
};

type ExtendedClaimType = Claim & {
  user: User | null;
  gitPOAP: GitPOAP & {
    project: ExtendedClaimProjectType | null;
  };
};

export type GitPOAPReturnData = {
  claim: ExtendedClaimType;
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

  const poapEventIdSet = new Set<number>();

  for (const gitPOAP of gitPOAPs) {
    poapEventIdSet.add(gitPOAP.poapEventId);
  }

  return poapEventIdSet;
}

type TransferInReturnType = {
  gitPOAP: GitPOAPReturnData | null;
};

async function handlePotentialTransferIn(
  poapTokenId: string,
  ownerAddress: string,
  poapEvent: POAPEvent,
): Promise<TransferInReturnType | null> {
  const logger = createScopedLogger('handlePotentialTransferIn');

  const claimData = await context.prisma.claim.findUnique({
    where: {
      poapTokenId: poapTokenId,
    },
    include: {
      mintedAddress: true,
      user: true,
      gitPOAP: {
        include: {
          project: {
            include: {
              repos: true,
            },
          },
        },
      },
    },
  });

  if (claimData !== null) {
    const address = claimData.mintedAddress?.ethAddress ?? null;

    if (address === null) {
      logger.error(`Claim ID ${claimData.id} has poapTokenId set but address is null`);
      return null;
    }

    // Here we assume that the user didn't just claim this during this function's run
    const updatedClaim = await handleGitPOAPTransfer(
      claimData.id,
      poapTokenId,
      address,
      ownerAddress.toLowerCase(),
    );

    return {
      gitPOAP: {
        claim: {
          ...updatedClaim,
          user: claimData.user,
          gitPOAP: claimData.gitPOAP,
        },
        event: poapEvent,
      },
    };
  }

  return { gitPOAP: null };
}

async function handleTransferPostProcessing(
  ownerAddress: string,
  foundPOAPIds: Set<string>,
  claims: {
    id: number;
    poapTokenId: string | null;
  }[],
) {
  const featuredData = await context.prisma.featuredPOAP.findMany({
    where: {
      profile: {
        address: {
          ethAddress: ownerAddress.toLowerCase(),
        },
      },
    },
    select: {
      id: true,
      poapTokenId: true,
    },
  });

  for (const feature of featuredData) {
    if (!foundPOAPIds.has(feature.poapTokenId)) {
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
    if (claim.poapTokenId !== null && !foundPOAPIds.has(claim.poapTokenId)) {
      // Run this in the background
      checkIfClaimTransferred(claim.id);
    }
  }
}

// Note that address CANNOT be an ENS
export async function splitUsersPOAPs(address: string): Promise<SplitUsersPOAPsReturnType | null> {
  const logger = createScopedLogger('splitUsersPOAPs');

  const addressLower = address.toLowerCase();

  // Call the POAP API, and generate the POAP Event ID Set in the background
  const backgroundPromises = Promise.all([
    retrieveUsersPOAPs(addressLower),
    generateGitPOAPPOAPEventIdSet(),
  ]);

  const claims = await context.prisma.claim.findMany({
    where: {
      mintedAddress: {
        ethAddress: addressLower,
      },
      status: { in: [ClaimStatus.CLAIMED, ClaimStatus.MINTING] },
    },
    include: {
      mintedAddress: true,
      user: true,
      gitPOAP: {
        include: {
          project: {
            include: {
              repos: true,
            },
          },
        },
      },
    },
  });

  // Map from POAP Token ID to their corresponding Claim objects
  const poapIdToClaimMap: Record<string, ExtendedClaimType> = {};
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

  // 0: All the POAPs the user has
  // 1: All the POAP Event IDs that are GitPOAP Events
  const [poaps, gitPOAPPOAPEventIdSet] = await backgroundPromises;
  if (poaps === null) {
    logger.error(`Failed to query POAPs from POAP API for address: ${address}`);
    return null;
  }

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
        const result = await handlePotentialTransferIn(poap.tokenId, addressLower, poap.event);
        // Skip if there was an error
        if (result === null) {
          continue;
        }
        // If it's a transferred in GitPOAP
        if (result.gitPOAP !== null) {
          gitPOAPsOnly.push(result.gitPOAP);
          continue;
        }
      }

      // Fallback to it being a POAP
      poapsOnly.push(poap);
    }
  }

  // Run this in the background
  handleTransferPostProcessing(addressLower, foundPOAPIds, claims);

  // Return immediately
  return { gitPOAPsOnly, poapsOnly };
}
