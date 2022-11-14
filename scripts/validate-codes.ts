import { config } from 'dotenv';
config();

import 'reflect-metadata';
import { createScopedLogger, updateLogLevel } from '../src/logging';
import minimist from 'minimist';
import { context } from '../src/context';
import { retrievePOAPCodes, retrievePOAPsForEvent } from '../src/external/poap';
import { ClaimStatus } from '@prisma/client';

type CodeUsageMap = Record<string, boolean>;

async function generateCodeUsageMap(
  poapEventId: number,
  poapSecretCode: string,
): Promise<{ codeUsageMap: CodeUsageMap; unusedCount: number } | null> {
  const logger = createScopedLogger('generateCodeUsageMap');

  logger.info(`Requesting QR code status from POAP API for POAP Event ID ${poapEventId}`);

  const codeData = await retrievePOAPCodes(poapEventId, poapSecretCode);

  if (codeData === null) {
    logger.error(`Failed to lookup codes for POAP Event ID ${poapEventId}`);
    return null;
  }

  logger.info(`Found ${codeData.length} existing codes`);

  const usages: CodeUsageMap = {};
  let unusedCount = 0;

  for (const codeStatus of codeData) {
    usages[codeStatus.qr_hash] = codeStatus.claimed;
    if (!codeStatus.claimed) {
      ++unusedCount;
    }
  }

  return { codeUsageMap: usages, unusedCount };
}

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
      name: true,
      poapEventId: true,
      poapSecret: true,
    },
  });

  if (gitPOAP === null) {
    logger.error(`Failed to find GitPOAP ID ${gitPOAPId}`);
    return;
  }

  const mapResult = await generateCodeUsageMap(gitPOAP.poapEventId, gitPOAP.poapSecret);

  if (mapResult === null) {
    logger.error(`Couldn't lookup codes for GitPOAP ID ${gitPOAPId}`);
    return;
  }

  const { codeUsageMap, unusedCount } = mapResult;

  logger.info(`POAP API says there are ${unusedCount} unused codes`);

  const gitPOAPCodes = await context.prisma.redeemCode.findMany({
    where: { gitPOAPId },
    select: {
      id: true,
      code: true,
    },
  });

  logger.info(`There are ${gitPOAPCodes.length} "unused" codes in our database`);

  let notFound = 0;
  let alreadyUsed = 0;

  for (const redeemCode of gitPOAPCodes) {
    if (!(redeemCode.code in codeUsageMap)) {
      logger.error(`RedeemCode ID ${redeemCode.id} not found via POAP API!`);
      ++notFound;
    } else if (codeUsageMap[redeemCode.code]) {
      logger.error(`RedeemCode ID ${redeemCode.id} was already used!`);
      ++alreadyUsed;

      await context.prisma.redeemCode.delete({
        where: { id: redeemCode.id },
      });
    }
  }

  const goodCodes = gitPOAPCodes.length - notFound - alreadyUsed;

  logger.info(
    `The DB has ${goodCodes} unclaimed codes, ${alreadyUsed} claimed codes, and ${notFound} codes weren't found`,
  );

  if (goodCodes === gitPOAPCodes.length) {
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
