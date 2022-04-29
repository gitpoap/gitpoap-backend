import { GitPOAP, Organization, Repo } from '@generated/type-graphql';
import { context } from '../context';
import { createScopedLogger } from '../logging';
import { getRepositoryPullsAsAdmin } from '../external/github';
import { DateTime } from 'luxon';
import { sleep } from './sleep';

const PULL_STEP_SIZE = 100;

type GitPOAPReturnType = GitPOAP & { repo: Repo & { organization: Organization } };

export async function checkForNewContributions(gitPOAP: GitPOAPReturnType) {
  const logger = createScopedLogger('checkForNewContributions');

  logger.info(
    `Checking for new contributions to ${gitPOAP.repo.organization.name}/${gitPOAP.repo.name}`,
  );

  let page = 1;
  let processing = true;
  let lastUpdatedAt = null;
  while (processing) {
    const pulls = await getRepositoryPullsAsAdmin(
      gitPOAP.repo.organization.name,
      gitPOAP.repo.name,
      PULL_STEP_SIZE,
      page,
    );
    if (pulls === null) {
      logger.error(`Failed to run ongoing issuance process for GitPOAP id: ${gitPOAP.id}`);
      return;
    }

    logger.debug(`Retrieved ${pulls.length} pulls for processing`);

    for (const pull of pulls) {
      // If the PR hasn't been merged yet, skip it
      if (pull.merged_at === null) {
        continue;
      }

      // Save the first updatedAt value
      if (lastUpdatedAt === null) {
        lastUpdatedAt = new Date(pull.updated_at);
      }

      const mergedAt = DateTime.fromISO(pull.merged_at);

      // Stop if we've already handled this PR
      if (mergedAt < DateTime.fromJSDate(gitPOAP.lastPRUpdatedAt)) {
        processing = false;
        break;
      }

      // Log an error if we haven't figured out what to do in the new years
      if (mergedAt.year > gitPOAP.year) {
        logger.error(`Found a merged PR for GitPOAP ID ${gitPOAP.id} for a new year`);
        return;
        // Don't handle previous years
      } else if (mergedAt.year < gitPOAP.year) {
        continue;
      }

      logger.info(`Creating a claim for ${pull.user.login} if it doesn't exist`);

      // Create the User and Claim if they don't exist
      const user = await context.prisma.user.upsert({
        where: {
          githubId: pull.user.id,
        },
        update: {
          githubHandle: pull.user.login,
        },
        create: {
          githubId: pull.user.id,
          githubHandle: pull.user.login,
        },
      });

      await context.prisma.claim.upsert({
        where: {
          gitPOAPId_userId: {
            gitPOAPId: gitPOAP.id,
            userId: user.id,
          },
        },
        update: {},
        create: {
          gitPOAP: {
            connect: {
              id: gitPOAP.id,
            },
          },
          user: {
            connect: {
              id: user.id,
            },
          },
        },
      });
    }

    ++page;
    processing = pulls.length === PULL_STEP_SIZE;
  }

  if (lastUpdatedAt !== null) {
    await context.prisma.gitPOAP.update({
      where: {
        id: gitPOAP.id,
      },
      data: {
        lastPRUpdatedAt: lastUpdatedAt,
      },
    });
  }

  logger.debug(
    `Finished checking for new contributions to ${gitPOAP.repo.organization.name}/${gitPOAP.repo.name}`,
  );
}

const DELAY_BETWEEN_ONGOING_ISSUANCE_CHECKS_SECONDS = 60;

async function runOngoingIssuanceUpdater() {
  const logger = createScopedLogger('runOngoingIssuanceUpdater');

  logger.info('Running the ongoing issuance updater process');

  const gitPOAPs: GitPOAPReturnType[] = await context.prisma.gitPOAP.findMany({
    where: {
      ongoing: true,
    },
    include: {
      repo: {
        include: {
          organization: true,
        },
      },
    },
  });

  logger.info(`Found ${gitPOAPs.length} ongoing GitPOAPs that need to be checked`);

  for (const gitPOAP of gitPOAPs) {
    await checkForNewContributions(gitPOAP);

    // Wait for a bit so we don't get rate limited
    await sleep(DELAY_BETWEEN_ONGOING_ISSUANCE_CHECKS_SECONDS);
  }

  logger.debug('Finished running the ongoing issuance updater process');
}

const ONGOING_ISSUANCE_BATCH_TIMING_KEY = 'ongoing-issuance';
const ONGOING_ISSUANCE_DELAY_HOURS = 12;

// Try to run ongoing issuance updater if there has been enough time elapsed since
// any instance last ran it
export async function tryToRunOngoingIssuanceUpdater() {
  const logger = createScopedLogger('tryToRunOngoingIssuanceUpdater');

  logger.info('Attempting to run the ongoing issuance updater');

  try {
    const batchTiming = await context.prisma.batchTiming.findUnique({
      where: {
        name: ONGOING_ISSUANCE_BATCH_TIMING_KEY,
      },
    });

    if (batchTiming !== null) {
      const lastRun = DateTime.fromJSDate(batchTiming.lastRun);

      // If not enough time has elapsed since the last run, skip the run
      if (lastRun.plus({ hours: ONGOING_ISSUANCE_DELAY_HOURS }) > DateTime.now()) {
        logger.debug('Not enough time has elapsed since the last run');
        return;
      }
    }

    // Update the last time ran to now (we do this first so the other instance
    // also doesn't start this process)
    const now = DateTime.now().toJSDate();
    await context.prisma.batchTiming.upsert({
      where: {
        name: ONGOING_ISSUANCE_BATCH_TIMING_KEY,
      },
      update: {
        lastRun: now,
      },
      create: {
        name: ONGOING_ISSUANCE_BATCH_TIMING_KEY,
        lastRun: now,
      },
    });

    await runOngoingIssuanceUpdater();

    logger.debug('Finished running the ongoing issuance updater');
  } catch (err) {
    logger.error(`Failed to run ongoing issuance updater: ${err}`);
  }
}
