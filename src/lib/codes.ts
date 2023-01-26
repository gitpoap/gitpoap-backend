import { context } from '../context';
import { GitPOAPStatus, GitPOAPType, RedeemCode } from '@prisma/client';
import { createScopedLogger } from '../logging';
import { retrieveClaimInfo, retrievePOAPCodes } from '../external/poap';
import { DateTime } from 'luxon';
import { lookupLastRun, updateLastRun } from './batchProcessing';
import { backloadGithubPullRequestData } from './pullRequests';
import { GitPOAPRequestEmailForm } from '../types/gitpoaps';
import { sendGitPOAPRequestLiveEmail } from '../external/postmark';
import { formatDateToReadableString } from '../routes/gitpoaps/utils';

// The name of the row in the BatchTiming table used for checking for new codes
const CHECK_FOR_CODES_BATCH_TIMING_KEY = 'check-for-codes';

// The amount of minutes to wait before checking for new codes
const CHECK_FOR_CODES_DELAY_MINUTES = 30;

export async function upsertRedeemCode(gitPOAPId: number, code: string): Promise<RedeemCode> {
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
        connect: { id: gitPOAPId },
      },
      code,
    },
  });
}

export async function deleteRedeemCode(redeemCodeId: number) {
  await context.prisma.redeemCode.delete({
    where: { id: redeemCodeId },
  });
}

async function countRedeemCodes(gitPOAPId: number): Promise<number> {
  return await context.prisma.redeemCode.count({
    where: { gitPOAPId },
  });
}

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

type CodeUsageMap = Record<string, boolean>;

async function generateCodeUsageMap(
  poapEventId: number,
  poapSecretCode: string,
): Promise<{ codeUsageMap: CodeUsageMap; unusedCount: number } | null> {
  const logger = createScopedLogger('generateCodeUsageMap');

  logger.info(`Requesting QR code status from POAP API for POAP Event ID ${poapEventId}`);

  const codeData = await retrievePOAPCodes(poapEventId, poapSecretCode);
  if (codeData === null) {
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

type CheckGitPOAPForCodesType = {
  id: number;
  poapApprovalStatus: GitPOAPStatus;
  poapEventId: number;
  poapSecret: string;
};

type CheckGitPOAPForCodesReturnType = {
  startingCount: number;
  endingCount: number;
  notFound: number;
  alreadyUsed: number;
};

export async function checkGitPOAPForNewCodesHelper(
  gitPOAP: CheckGitPOAPForCodesType,
): Promise<CheckGitPOAPForCodesReturnType> {
  const logger = createScopedLogger('checkGitPOAPForNewCodesHelper');

  logger.info(
    `Checking GitPOAP ID ${gitPOAP.id} with status ${gitPOAP.poapApprovalStatus} for new codes`,
  );

  const startingCount = await countRedeemCodes(gitPOAP.id);

  logger.info(`GitPOAP ID ${gitPOAP.id} currently has ${startingCount} codes`);

  const mapResult = await generateCodeUsageMap(gitPOAP.poapEventId, gitPOAP.poapSecret);
  if (mapResult === null) {
    logger.error(
      `Failed to lookup codes for GitPOAP ID ${gitPOAP.id} (POAP Event ID ${gitPOAP.poapEventId}`,
    );
    return { startingCount, endingCount: startingCount, notFound: -1, alreadyUsed: -1 };
  }
  const { codeUsageMap, unusedCount } = mapResult;

  logger.info(`POAP API says there are ${unusedCount} unused codes for GitPOAP ID ${gitPOAP.id}`);

  const redeemCodes = await context.prisma.redeemCode.findMany({
    where: { gitPOAPId: gitPOAP.id },
  });

  let notFound = 0;
  let alreadyUsed = 0;

  for (const redeemCode of redeemCodes) {
    if (!(redeemCode.code in codeUsageMap)) {
      logger.error(`RedeemCode ID ${redeemCode.id} was not found via POAP API`);
      ++notFound;
      await deleteRedeemCode(redeemCode.id);
    } else if (codeUsageMap[redeemCode.code]) {
      logger.error(`RedeemCode ID ${redeemCode.id} was already used`);
      ++alreadyUsed;
      await deleteRedeemCode(redeemCode.id);
    } else {
      // Skip upserting this code
      delete codeUsageMap[redeemCode.code];
    }
  }

  logger.info(`There were ${notFound} codes in our DB not found via POAP API`);
  logger.info(`There were ${alreadyUsed} codes in our DB that were already used`);

  // Upsert the unclaimed codes
  for (const code of Object.keys(codeUsageMap)) {
    if (!codeUsageMap[code]) {
      await upsertRedeemCode(gitPOAP.id, code);
    }
  }

  const endingCount = await countRedeemCodes(gitPOAP.id);

  if (startingCount < endingCount) {
    logger.info(`Found ${endingCount} new codes for GitPOAP ID ${gitPOAP.id}`);

    // Move the GitPOAP back into APPROVED state
    await context.prisma.gitPOAP.update({
      where: { id: gitPOAP.id },
      data: { poapApprovalStatus: GitPOAPStatus.APPROVED },
    });
  }

  return { startingCount, endingCount, notFound, alreadyUsed };
}

export type CheckGitPOAPForCodesWithExtrasType = CheckGitPOAPForCodesType & {
  type: GitPOAPType;
  name: string;
  description: string;
  imageUrl: string;
  creatorEmail: { emailAddress: string } | null;
  gitPOAPRequest: { startDate: Date; endDate: Date } | null;
};

export async function checkGitPOAPForNewCodesWithApprovalEmail(
  gitPOAP: CheckGitPOAPForCodesWithExtrasType,
): Promise<number[]> {
  const logger = createScopedLogger('checkGitPOAPForNewCodesWithEmail');

  logger.info(
    `Checking GitPOAP ID ${gitPOAP.id} with status ${gitPOAP.poapApprovalStatus} for new codes`,
  );

  const { startingCount, endingCount } = await checkGitPOAPForNewCodesHelper(gitPOAP);

  if (endingCount <= startingCount) {
    logger.info(`GitPOAP ID ${gitPOAP.id} is still awaiting codes`);
  } else {
    logger.info(
      `Received at least ${endingCount - startingCount} new codes for GitPOAP ID ${gitPOAP.id}`,
    );

    // If we just got the first codes for a GitPOAP, we need to backload
    // its repos so that claims are created
    if (gitPOAP.poapApprovalStatus === GitPOAPStatus.UNAPPROVED) {
      // if it is custom gitPOAP, we send an email for approval
      if (gitPOAP.type === GitPOAPType.CUSTOM) {
        // if email exists
        const email = gitPOAP.creatorEmail?.emailAddress ?? null;
        if (email) {
          const emailForm: GitPOAPRequestEmailForm = {
            id: gitPOAP.id,
            name: gitPOAP.name,
            email,
            imageUrl: gitPOAP.imageUrl,
            description: gitPOAP.description,
            startDate: gitPOAP.gitPOAPRequest?.startDate
              ? formatDateToReadableString(gitPOAP.gitPOAPRequest?.startDate)
              : '',
            endDate: gitPOAP.gitPOAPRequest?.endDate
              ? formatDateToReadableString(gitPOAP.gitPOAPRequest?.endDate)
              : '',
          };
          void sendGitPOAPRequestLiveEmail(emailForm);
        } else {
          logger.error(
            `We are not able to send an confirmation email since creator email for Custom GitPOAP id: ${gitPOAP.id} is null `,
          );
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
      imageUrl: true,
      creatorEmail: {
        select: { emailAddress: true },
      },
      gitPOAPRequest: {
        select: {
          startDate: true,
          endDate: true,
        },
      },
    },
  });

  logger.info(`Found ${gitPOAPsAwaitingCodes.length} GitPOAPs awaiting new codes`);

  const repoIds = new Set<number>();

  for (const gitPOAP of gitPOAPsAwaitingCodes) {
    (await checkGitPOAPForNewCodesWithApprovalEmail(gitPOAP)).forEach(r => repoIds.add(r));
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

async function chooseRedeemCode(gitPOAPId: number) {
  return await context.prisma.redeemCode.findFirst({
    where: { gitPOAPId },
  });
}

async function isRedeemCodeUsed(redeemCode: RedeemCode): Promise<boolean> {
  const logger = createScopedLogger('isCodeUsed');

  const poapResponse = await retrieveClaimInfo(redeemCode.code);

  if (poapResponse === null) {
    logger.error(`RedeemCode ID ${redeemCode} was not found via POAP API`);

    return true;
  }

  return poapResponse.claimed;
}

export async function chooseUnusedRedeemCode(
  gitPOAP: CheckGitPOAPForCodesType,
): Promise<RedeemCode | null> {
  const logger = createScopedLogger('chooseUnusedRedeemCode');

  const redeemCode = await chooseRedeemCode(gitPOAP.id);

  if (redeemCode === null) {
    logger.error(`GitPOAP ID ${gitPOAP.id} doesn't have any more claim codes`);
  } else if (await isRedeemCodeUsed(redeemCode)) {
    logger.error(`GitPOAP ID ${gitPOAP.id} has a used RedeemCode ID ${redeemCode.id}. Deleting it`);

    try {
      await deleteRedeemCode(redeemCode.id);
    } catch (err) {
      logger.error(`Tried to delete a RedeemCode that was already deleted: ${err}`);
    }
  } else {
    // This RedeemCode hasn't been used
    return redeemCode;
  }

  const { startingCount, endingCount } = await checkGitPOAPForNewCodesHelper(gitPOAP);

  if (startingCount >= endingCount) {
    if (gitPOAP.poapApprovalStatus === GitPOAPStatus.REDEEM_REQUEST_PENDING) {
      logger.error(
        `Checking for new claim codes for GitPOAP ID ${gitPOAP.id} didn't return any new codes`,
      );
    } else {
      logger.warn(`Still waiting on new claim codes from POAP for GitPOAP ID ${gitPOAP.id}`);
    }

    return null;
  }

  return await chooseRedeemCode(gitPOAP.id);
}
