import { config } from 'dotenv';
config();

import 'reflect-metadata';
import { createScopedLogger, updateLogLevel } from '../src/logging';
import minimist from 'minimist';
import { context } from '../src/context';
import { retrievePOAPsForEvent } from '../src/external/poap';
import { ClaimStatus } from '@prisma/client';
import { checkGitPOAPForNewCodesHelper } from '../src/lib/codes';

async function attemptToFindGithubUserForAddress(ethAddress: string) {
  return await context.prisma.claim.findFirst({
    where: {
      mintedAddress: { ethAddress },
      NOT: { githubUserId: null },
    },
    select: {
      githubUser: {
        select: {
          id: true,
          githubHandle: true,
        },
      },
    },
  });
}

async function checkForMissingMints(gitPOAPId: number, poapEventId: number) {
  const logger = createScopedLogger('checkForMissingMints');

  const claimedClaimsInDB = await context.prisma.claim.findMany({
    where: {
      gitPOAPId,
      status: ClaimStatus.CLAIMED,
    },
    select: {
      id: true,
      needsRevalidation: true,
      mintedAddress: {
        select: { ethAddress: true },
      },
    },
  });

  const claimedAddressesInDB = new Set<string>();
  for (const claim of claimedClaimsInDB) {
    if (claim.mintedAddress === null) {
      logger.error(`Claim ID ${claim.id} has status CLAIMED but mintedAddress is null`);
      continue;
    }
    claimedAddressesInDB.add(claim.mintedAddress.ethAddress);
  }

  logger.info(`Found ${claimedAddressesInDB.size} addresses with completed claims in DB`);

  const poapsForEvent = await retrievePOAPsForEvent(poapEventId);
  if (poapsForEvent === null) {
    logger.error(`Failed to lookup POAPs for POAP Event ID ${poapEventId} via POAP API`);
    return;
  }

  logger.info(`POAP API says there are ${poapsForEvent.length} POAPs minted`);

  const poapAddresses = new Set<string>();
  for (const poap of poapsForEvent) {
    const poapOwner = poap.owner.id.toLowerCase();

    poapAddresses.add(poapOwner);

    if (!claimedAddressesInDB.has(poapOwner)) {
      logger.error(`Our DB does not have an entry for ${poapOwner}`);

      const githubUserData = await attemptToFindGithubUserForAddress(poapOwner);

      if (githubUserData === null) {
        logger.error(`Failed to find an associated GitHub user for ${poapOwner}`);
        continue;
      }

      if (githubUserData.githubUser === null) {
        logger.error(
          'DB returned githubUser column that is null though we specifically requested it not to',
        );
        continue;
      }

      logger.info(
        `GitHub user ${githubUserData.githubUser.githubHandle} (ID: ${githubUserData.githubUser.id}) claimed POAP ID ${poap.id} at '${poap.created}' with address '${poapOwner}'`,
      );
    }
  }

  for (const claim of claimedClaimsInDB) {
    // Here we assume that mintedAddress is not null since we specifically requested it from DB
    // and logged an error earlier
    const mintedAddress = claim.mintedAddress?.ethAddress ?? '';

    if (!poapAddresses.has(mintedAddress)) {
      logger.error(
        `The list of addresses holding the GitPOAP does not contain address ${mintedAddress}`,
      );

      if (claim.needsRevalidation) {
        logger.info('Note that this address needs revalidation');
      }
    }
  }
}

async function checkGitPOAPCodes(gitPOAPId: number) {
  const logger = createScopedLogger('checkGitPOAPCodes');

  const gitPOAP = await context.prisma.gitPOAP.findUnique({
    where: { id: gitPOAPId },
    select: {
      id: true,
      poapApprovalStatus: true,
      poapEventId: true,
      poapSecret: true,
    },
  });
  if (gitPOAP === null) {
    logger.error(`Failed to lookup GitPOAP with ID ${gitPOAPId}`);
    return;
  }

  const { notFound, alreadyUsed } = await checkGitPOAPForNewCodesHelper(gitPOAP);

  if (notFound === 0 && alreadyUsed === 0) {
    logger.info(`GitPOAP ID ${gitPOAPId} has PASSED validation`);
  } else {
    logger.error(`GitPOAP ID ${gitPOAPId} has FAILED validation`);
  }

  await checkForMissingMints(gitPOAPId, gitPOAP.poapEventId);
}

const main = async () => {
  const logger = createScopedLogger('main');

  const argv = minimist(process.argv.slice(2));

  logger.info(`Command line args: ${JSON.stringify(argv)}`);

  updateLogLevel(argv['level']);

  let gitPOAPIds: number[] = [];
  if ('only' in argv) {
    gitPOAPIds = [argv['only']].concat(argv['_']).map((id: string) => parseInt(id, 10));

    logger.info(`Running only on GitPOAP IDs: ${gitPOAPIds}`);
  } else {
    logger.info('Running on all GitPOAPs');

    gitPOAPIds = (await context.prisma.gitPOAP.findMany({ select: { id: true } })).map(gp => gp.id);
  }

  for (const gitPOAPId of gitPOAPIds) {
    await checkGitPOAPCodes(gitPOAPId);
  }
};

void main();
