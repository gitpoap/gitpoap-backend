import { context } from '../context';
import { GitPOAPStatus, RedeemCode } from '@generated/type-graphql';
import { createScopedLogger } from '../logging';
import { retrieveUnusedPOAPCodes } from '../external/poap';
import { DateTime } from 'luxon';
import { lookupLastRun, updateLastRun } from './batch';

// The name of the row in the BatchTiming table used for checking for new codes
const CHECK_FOR_CODES_BATCH_TIMING_KEY = 'check-for-codes';

// The amount of minutes to wait before checking for new codes
const CHECK_FOR_CODES_DELAY_MINUTES = 30;

export async function upsertCode(gitPOAPId: number, code: string): Promise<RedeemCode> {
  return await context.prisma.redeemCode.upsert({
    where: {
      gitPOAPId_code: {
        gitPOAPId,
        code,
      },
    },
    update: {},
    create: {
      gitPOAP: {
        connect: {
          id: gitPOAPId,
        },
      },
      code,
    },
  });
}

async function countCodes(gitPOAPId: number): Promise<number> {
  return await context.prisma.redeemCode.count({
    where: { gitPOAPId },
  });
}

export type GitPOAPWithSecret = {
  id: number;
  status: string;
  poapEventId: number;
  poapSecret: string;
};

export async function checkGitPOAPForNewCodes(gitPOAP: GitPOAPWithSecret) {
  const logger = createScopedLogger('checkGitPOAPForNewCodes');

  logger.info(`Checking GitPOAP ID ${gitPOAP.id} with status ${gitPOAP.status} for new codes`);

  const startingCount = await countCodes(gitPOAP.id);

  logger.info(`GitPOAP ID currently has ${startingCount} codes`);

  const unusedCodes = await retrieveUnusedPOAPCodes(gitPOAP.poapEventId, gitPOAP.poapSecret);
  if (unusedCodes === null) {
    logger.warn(`Failed to retrieve unused codes from POAP API for GitPOAP ID ${gitPOAP.id}`);
    return;
  }

  logger.debug(`Received ${unusedCodes.length} unused codes from POAP API`);

  for (const code of unusedCodes) {
    await upsertCode(gitPOAP.id, code);
  }

  const endingCount = await countCodes(gitPOAP.id);

  if (endingCount <= startingCount) {
    logger.info(`GitPOAP ID ${gitPOAP.id} is still awaiting codes`);
  } else {
    logger.info(
      `Received at least ${endingCount - startingCount} new codes for GitPOAP ID ${gitPOAP.id}`,
    );

    await context.prisma.gitPOAP.update({
      where: {
        id: gitPOAP.id,
      },
      data: {
        status: GitPOAPStatus.APPROVED,
      },
    });
  }
}

export async function checkForNewPOAPCodes() {
  const logger = createScopedLogger('checkForNewPOAPCodes');

  // Only UNAPPROVED and REDEEM_REQUEST_PENDING states could be waiting on codes
  const gitPOAPsAwaitingCodes = await context.prisma.gitPOAP.findMany({
    where: {
      status: {
        in: [GitPOAPStatus.UNAPPROVED, GitPOAPStatus.REDEEM_REQUEST_PENDING],
      },
    },
    select: {
      id: true,
      status: true,
      poapEventId: true,
      poapSecret: true,
    },
  });

  logger.info(`Found ${gitPOAPsAwaitingCodes.length} GitPOAPs awaiting new codes`);

  for (const gitPOAP of gitPOAPsAwaitingCodes) {
    await checkGitPOAPForNewCodes(gitPOAP);
  }

  logger.debug(`Finished checking ${gitPOAPsAwaitingCodes.length} GitPOAPs for new codes`);
}

export async function updateCheckForNewPOAPCodesLastRun() {
  await updateLastRun(CHECK_FOR_CODES_BATCH_TIMING_KEY);
}

export async function lookupLastCheckForNewPOAPCodesRun(): Promise<DateTime | null> {
  return await lookupLastRun(CHECK_FOR_CODES_BATCH_TIMING_KEY);
}

export async function tryToCheckForNewPOAPCodes() {
  const logger = createScopedLogger('tryToCheckForNewPOAPCodes');

  logger.info('Attempting to check for new POAP codes');

  try {
    const lastRun = await lookupLastCheckForNewPOAPCodesRun();

    if (lastRun !== null) {
      if (lastRun.plus({ minutes: CHECK_FOR_CODES_DELAY_MINUTES }) > DateTime.now()) {
        logger.debug('Not enough time has passed since the last run');
        return;
      }
    }

    // Update the last time ran to now (we do this first so the other instance
    // also doesn't start this process)
    await updateCheckForNewPOAPCodesLastRun();

    await checkForNewPOAPCodes();
  } catch (err) {
    logger.error(`Failed to check for new POAP codes: ${err}`);
  }
}
