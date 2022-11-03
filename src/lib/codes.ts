import { context } from '../context';
import { GitPOAPType } from '@prisma/client';
import { GitPOAPStatus, RedeemCode, Organization, Address } from '@generated/type-graphql';
import { createScopedLogger } from '../logging';
import { retrieveUnusedPOAPCodes } from '../external/poap';
import { DateTime } from 'luxon';
import { lookupLastRun, updateLastRun } from './batchProcessing';
import { backloadGithubPullRequestData } from './pullRequests';
import { CustomGitPOAPRequestEmailForm } from '../types/gitpoaps';
import { sendCustomGitPOAPRequestLiveEmail } from '../external/postmark';

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
  poapApprovalStatus: string;
  poapEventId: number;
  poapSecret: string;
  type: GitPOAPType;
  name: string;
  description: string;
  organization: Organization | null;
  creatorAddress: Address | null;
  imageUrl: string;
};

async function lookupRepoIds(gitPOAPId: number): Promise<number[]> {
  const logger = createScopedLogger('backloadRepoData');

  const gitPOAPRepoData = await context.prisma.gitPOAP.findUnique({
    where: {
      id: gitPOAPId,
    },
    select: {
      project: {
        select: {
          repos: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  });
  if (gitPOAPRepoData === null) {
    logger.error(`Failed to lookup repos for GitPOAP ID ${gitPOAPId}`);
    return [];
  }

  if (gitPOAPRepoData.project === null) {
    logger.info(`GitPOAP with ${gitPOAPId} does not have a project`);
    return [];
  }

  return gitPOAPRepoData.project.repos.map(r => r.id);
}

export async function checkGitPOAPForNewCodes(gitPOAP: GitPOAPWithSecret): Promise<number[]> {
  const logger = createScopedLogger('checkGitPOAPForNewCodes');

  logger.info(
    `Checking GitPOAP ID ${gitPOAP.id} with status ${gitPOAP.poapApprovalStatus} for new codes`,
  );

  const startingCount = await countCodes(gitPOAP.id);

  logger.info(`GitPOAP ID currently has ${startingCount} codes`);

  const unusedCodes = await retrieveUnusedPOAPCodes(gitPOAP.poapEventId, gitPOAP.poapSecret);
  if (unusedCodes === null) {
    logger.warn(`Failed to retrieve unused codes from POAP API for GitPOAP ID ${gitPOAP.id}`);
    return [];
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
        poapApprovalStatus: GitPOAPStatus.APPROVED,
      },
    });

    // If we just got the first codes for a GitPOAP, we need to backload
    // its repos so that claims are created
    if (gitPOAP.poapApprovalStatus === GitPOAPStatus.UNAPPROVED) {
      // if it is custom gitPOAP, we send an email for approval
      if (gitPOAP.type === GitPOAPType.CUSTOM) {
        // if email exists
        if (
          gitPOAP.creatorAddress &&
          gitPOAP.creatorAddress.email &&
          gitPOAP.creatorAddress.email.emailAddress
        ) {
          const emailForm: CustomGitPOAPRequestEmailForm = {
            id: gitPOAP.id,
            name: gitPOAP.name,
            email: gitPOAP.creatorAddress.email.emailAddress,
            description: gitPOAP.description,
            imageKey: gitPOAP.imageUrl,
            organizationId: gitPOAP.organization?.id ?? null,
            organizationName: gitPOAP.organization?.name ?? null,
          };
          void sendCustomGitPOAPRequestLiveEmail(emailForm);
        }
      }

      // return repo ids
      return lookupRepoIds(gitPOAP.id);
    }
  }

  return [];
}

export async function checkForNewPOAPCodes() {
  const logger = createScopedLogger('checkForNewPOAPCodes');

  // Only UNAPPROVED and REDEEM_REQUEST_PENDING states could be waiting on codes
  const gitPOAPsAwaitingCodes = await context.prisma.gitPOAP.findMany({
    where: {
      poapApprovalStatus: {
        in: [GitPOAPStatus.UNAPPROVED, GitPOAPStatus.REDEEM_REQUEST_PENDING],
      },
    },
    select: {
      id: true,
      poapApprovalStatus: true,
      poapEventId: true,
      poapSecret: true,
      name: true,
      type: true,
      description: true,
      organization: true,
      creatorAddress: true,
      imageUrl: true,
    },
  });

  logger.info(`Found ${gitPOAPsAwaitingCodes.length} GitPOAPs awaiting new codes`);

  const repoIds = new Set<number>();

  for (const gitPOAP of gitPOAPsAwaitingCodes) {
    (await checkGitPOAPForNewCodes(gitPOAP)).forEach(r => repoIds.add(r));
  }

  // Backload any new repoIds
  for (const repoId of repoIds) {
    await backloadGithubPullRequestData(repoId);
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
