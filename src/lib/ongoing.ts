import { context } from '../context';
import { createScopedLogger } from '../logging';
import { GithubPullRequestData, getGithubRepositoryPullsAsAdmin } from '../external/github';
import { DateTime } from 'luxon';
import { sleep } from './sleep';
import {
  ongoingIssuanceProjectDurationSeconds,
  overallOngoingIssuanceDurationSeconds,
} from '../metrics';
import { extractMergeCommitSha, upsertGithubPullRequest } from './pullRequests';
import { upsertUser } from './users';
import { YearlyGitPOAPsMap, createNewClaimsForRepoPR, createYearlyGitPOAPsMap } from './claims';
import { lookupLastRun, updateLastRun } from './batchProcessing';
import { GitPOAPStatus } from '@prisma/client';

// The number of pull requests to request in a single page (currently the maximum number)
const PULL_STEP_SIZE = 100;

// The name of the row in the BatchTiming table used for ongoing issuance
const ONGOING_ISSUANCE_BATCH_TIMING_KEY = 'ongoing-issuance';

// The amount of hours to wait before checking for new contributions
const ONGOING_ISSUANCE_DELAY_HOURS = 12;

// The amount of minutes to wait in between the checks for separate projects.
// Currently we don't expect to be rate limited by GitHub for this background
// process, but this is good to have in place as we add more projects that
// require ongoing checks
const DELAY_BETWEEN_ONGOING_ISSUANCE_CHECKS_SECONDS = 60;

export type RepoReturnType = {
  id: number;
  name: string;
  lastPRUpdatedAt: Date;
  project: {
    gitPOAPs: {
      id: number;
      year: number;
      threshold: number;
    }[];
    repos: { id: number }[];
  };
  organization: {
    name: string;
  };
};

type HandleNewPullReturnType = {
  finished: boolean;
  updatedAt: Date;
};

/**
 * Handle a newly updated (and closed) pull request to a repository
 *
 * @param repo - Information about a repository and its GitPOAPs
 * @param pull - The pull request to handle
 * @returns An object describing whether we've finished processing
 *   pull requests early and the updatedAt time of the PR
 */
export async function handleNewPull(
  repo: RepoReturnType,
  yearlyGitPOAPsMap: YearlyGitPOAPsMap,
  pull: GithubPullRequestData,
): Promise<HandleNewPullReturnType> {
  const logger = createScopedLogger('handleNewPull');

  const updatedAt = new Date(pull.updated_at);

  // If the PR hasn't been merged yet, skip it
  if (pull.merged_at === null) {
    return { finished: false, updatedAt: updatedAt };
  }

  // Stop if we've already handled this PR
  if (updatedAt < repo.lastPRUpdatedAt) {
    return { finished: true, updatedAt: updatedAt };
  }

  if (pull.user.type === 'Bot') {
    logger.info(`Skipping creating claims for bot ${pull.user.login}`);
    return { finished: false, updatedAt: updatedAt };
  }

  logger.info(`Creating a claims for ${pull.user.login} if they don't exist`);

  // Create the User, GithubPullRequest, and Claim if they don't exist
  const user = await upsertUser(pull.user.id, pull.user.login);

  const githubPullRequest = await upsertGithubPullRequest(
    repo.id,
    pull.number,
    pull.title,
    new Date(pull.merged_at),
    extractMergeCommitSha(pull),
    user.id,
  );

  const mergedAt = DateTime.fromISO(pull.merged_at);

  // If there are no PR-based gitPOAPs, then skip creating new claims for repo
  if (repo.project.gitPOAPs.length === 0) {
    logger.warn(`Repo ID ${repo.id} has no GitPOAPs (Possibly because none are PR-based)`);
  } else {
    // We assume here that all the ongoing GitPOAPs have the same year
    const year = repo.project.gitPOAPs[0].year;

    // Log an error if we haven't figured out what to do in the new years
    if (mergedAt.year > year) {
      logger.error(`Found a merged PR for repo ID ${repo.id} for a new year`);
      return { finished: false, updatedAt: updatedAt };
      // Don't handle previous years (note we still handle an updated title)
    } else if (mergedAt.year < year) {
      return { finished: false, updatedAt: updatedAt };
    }

    await createNewClaimsForRepoPR(user, repo.project.repos, yearlyGitPOAPsMap, githubPullRequest);
  }

  return { finished: false, updatedAt: updatedAt };
}

export async function checkForNewContributions(repo: RepoReturnType) {
  const logger = createScopedLogger('checkForNewContributions');

  const project = `${repo.organization.name}/${repo.name}`;
  logger.info(`Checking for new contributions to ${project}`);

  const endTimer = ongoingIssuanceProjectDurationSeconds.startTimer(project);

  const yearlyGitPOAPsMap = createYearlyGitPOAPsMap(repo.project.gitPOAPs);

  let page = 1;
  let isProcessing = true;
  let lastUpdatedAt = null;
  while (isProcessing) {
    const pulls = await getGithubRepositoryPullsAsAdmin(
      repo.organization.name,
      repo.name,
      PULL_STEP_SIZE,
      page,
      'desc',
    );
    if (pulls === null) {
      logger.error(`Failed to run ongoing issuance process for repo id: ${repo.id}`);
      endTimer({ success: 0 });
      return;
    }

    logger.debug(`Retrieved ${pulls.length} pulls for processing`);

    for (const pull of pulls) {
      const result = await handleNewPull(repo, yearlyGitPOAPsMap, pull);

      // Save the first updatedAt value
      if (lastUpdatedAt === null) {
        lastUpdatedAt = result.updatedAt;
      }

      if (result.finished) {
        isProcessing = false;
        break;
      }
    }

    ++page;
    isProcessing = pulls.length === PULL_STEP_SIZE;
  }

  if (lastUpdatedAt !== null) {
    await context.prisma.repo.update({
      where: {
        id: repo.id,
      },
      data: {
        lastPRUpdatedAt: lastUpdatedAt,
      },
    });
  }

  endTimer({ success: 1 });

  logger.debug(`Finished checking for new contributions to ${repo.organization.name}/${repo.name}`);
}

export async function runOngoingIssuanceUpdater() {
  const logger = createScopedLogger('runOngoingIssuanceUpdater');

  logger.info('Running the ongoing issuance updater process');

  const endTimer = overallOngoingIssuanceDurationSeconds.startTimer();

  const repos: RepoReturnType[] = (
    await context.prisma.repo.findMany({
      select: {
        id: true,
        name: true,
        lastPRUpdatedAt: true,
        project: {
          select: {
            gitPOAPs: {
              where: {
                ongoing: true,
                isPRBased: true,
                NOT: {
                  status: GitPOAPStatus.DEPRECATED,
                },
              },
              select: {
                id: true,
                year: true,
                threshold: true,
              },
            },
            repos: {
              select: {
                id: true,
              },
            },
          },
        },
        organization: {
          select: {
            name: true,
          },
        },
      },
    })
  ).filter(r => r.project.gitPOAPs.length > 0);

  logger.info(`Found ${repos.length} repos with ongoing GitPOAPs that need to be checked`);

  for (let i = 0; i < repos.length; ++i) {
    if (i > 0) {
      logger.debug(
        `Waiting ${DELAY_BETWEEN_ONGOING_ISSUANCE_CHECKS_SECONDS} seconds before checking the next repo`,
      );

      // Wait for a bit so we don't get rate limited
      await sleep(DELAY_BETWEEN_ONGOING_ISSUANCE_CHECKS_SECONDS);
    }

    try {
      await checkForNewContributions(repos[i]);
    } catch (err) {
      logger.error(`Failed to run the ongoing issuance process for Repo ID ${repos[i].id}: ${err}`);
    }
  }

  endTimer({ processed_count: repos.length });

  logger.debug('Finished running the ongoing issuance updater process');
}

export async function updateOngoingIssuanceLastRun() {
  await updateLastRun(ONGOING_ISSUANCE_BATCH_TIMING_KEY);
}

export async function lookupLastOngoingIssuanceRun(): Promise<DateTime | null> {
  return await lookupLastRun(ONGOING_ISSUANCE_BATCH_TIMING_KEY);
}

// Try to run ongoing issuance updater if there has been enough time elapsed since
// any instance last ran it
export async function tryToRunOngoingIssuanceUpdater() {
  const logger = createScopedLogger('tryToRunOngoingIssuanceUpdater');

  logger.info('Attempting to run the ongoing issuance updater');

  try {
    const lastRun = await lookupLastOngoingIssuanceRun();

    if (lastRun !== null) {
      // If not enough time has elapsed since the last run, skip the run
      if (lastRun.plus({ hours: ONGOING_ISSUANCE_DELAY_HOURS }) > DateTime.now()) {
        logger.debug('Not enough time has elapsed since the last run');
        return;
      }
    }

    // Update the last time ran to now (we do this first so the other instance
    // also doesn't start this process)
    await updateOngoingIssuanceLastRun();

    await runOngoingIssuanceUpdater();

    logger.debug('Finished running the ongoing issuance updater');
  } catch (err) {
    logger.error(`Failed to run ongoing issuance updater: ${err}`);
  }
}
