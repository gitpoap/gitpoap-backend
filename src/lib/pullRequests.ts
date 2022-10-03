import { createScopedLogger } from '../logging';
import { context } from '../context';
import { GithubPullRequestData, getGithubRepositoryPullsAsAdmin } from '../external/github';
import { pullRequestBackloadDurationSeconds } from '../metrics';
import { upsertUser } from './users';
import {
  RepoData,
  YearlyGitPOAPsMap,
  createNewClaimsForRepoContribution,
  createYearlyGitPOAPsMap,
} from './claims';
import { GitPOAPStatus, GithubPullRequest } from '@prisma/client';

type ExtraRepoData = RepoData & {
  name: string;
  organization: {
    name: string;
  };
};

async function getRepoInfo(repoId: number): Promise<ExtraRepoData | null> {
  const logger = createScopedLogger('getRepoInfo');

  const result = await context.prisma.repo.findMany({
    where: {
      id: repoId,
    },
    select: {
      id: true,
      name: true,
      organization: {
        select: {
          name: true,
        },
      },
      project: {
        select: {
          gitPOAPs: {
            where: {
              isPRBased: true,
              NOT: {
                status: GitPOAPStatus.DEPRECATED,
              },
            },
            select: {
              id: true,
              year: true,
              threshold: true,
              isPRBased: true,
            },
          },
          repos: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  });

  if (result.length !== 1) {
    logger.error(`Found multiple repos with ID: ${repoId}`);
    return null;
  }

  return result[0];
}

// Helper function to either return the commit where this was merged
// or the last commit of the PR in case merge_commit_sha is null
export function extractMergeCommitSha(pr: GithubPullRequestData): string {
  if (pr.merge_commit_sha === null) {
    return pr.head.sha;
  }

  return pr.merge_commit_sha;
}

export async function upsertGithubPullRequest(
  repoId: number,
  githubPullNumber: number,
  githubTitle: string,
  githubCreatedAt: Date,
  githubMergedAt: Date | null,
  githubMergeCommitSha: string | null,
  userId: number,
): Promise<GithubPullRequest> {
  const logger = createScopedLogger('upsertGithubPullRequest');

  logger.info(`Upserting PR #${githubPullNumber}`);

  return await context.prisma.githubPullRequest.upsert({
    where: {
      repoId_githubPullNumber: {
        repoId: repoId,
        githubPullNumber,
      },
    },
    update: {
      githubTitle,
      githubMergedAt,
      githubMergeCommitSha,
    },
    create: {
      githubPullNumber,
      githubTitle,
      githubCreatedAt,
      githubMergedAt,
      githubMergeCommitSha,
      repo: {
        connect: {
          id: repoId,
        },
      },
      user: {
        connect: {
          id: userId,
        },
      },
    },
  });
}

async function backloadGithubPullRequest(
  repo: {
    id: number;
    project: { repos: { id: number }[] };
  },
  yearlyGitPOAPsMap: YearlyGitPOAPsMap,
  pr: GithubPullRequestData,
) {
  const logger = createScopedLogger('backloadGithubPullRequest');

  if (pr.merged_at === null) {
    logger.debug(`Skipping unmerged PR #${pr.number}`);
    return;
  }

  logger.debug(`Handling PR #${pr.number}`);

  if (pr.user.type === 'Bot') {
    logger.info(`Skipping creating claims for bot ${pr.user.login}`);
    return;
  }

  const user = await upsertUser(pr.user.id, pr.user.login);

  const mergedAt = new Date(pr.merged_at);

  // Don't create the PR if it already is in the DB (maybe via ongoing issuance)
  // but update the title if it's changed
  const githubPullRequest = await upsertGithubPullRequest(
    repo.id,
    pr.number,
    pr.title,
    new Date(pr.created_at),
    mergedAt,
    extractMergeCommitSha(pr), // This must be final since it's been merged
    user.id,
  );

  const claims = await createNewClaimsForRepoContribution(
    user,
    repo.project.repos,
    yearlyGitPOAPsMap,
    { pullRequest: githubPullRequest },
  );

  for (const claim of claims) {
    // If this is the user's first PR set the earned at field
    if (claim.pullRequestEarnedId === null) {
      logger.info(
        `Setting pullRequestEarned for Claim ID ${claim.id} to GithubPullRequest ID ${githubPullRequest.id} for user ${pr.user.login}`,
      );

      await context.prisma.claim.update({
        where: {
          id: claim.id,
        },
        data: {
          pullRequestEarned: {
            connect: {
              id: githubPullRequest.id,
            },
          },
        },
      });
    }
  }
}

const BACKFILL_PRS_PER_REQUEST = 100; // the max

export async function backloadGithubPullRequestData(repoId: number) {
  const logger = createScopedLogger('backloadGithubPullRequestData');

  const endTimer = pullRequestBackloadDurationSeconds.startTimer();

  const repoInfo = await getRepoInfo(repoId);

  if (repoInfo === null) {
    logger.error(`Failed to look up repo with ID ${repoId}`);
    return;
  }

  logger.info(
    `Backloading the historical PR data for repo ID: ${repoId} (${repoInfo.organization.name}/${repoInfo.name})`,
  );

  if (repoInfo.project.gitPOAPs.length === 0) {
    logger.warn(
      `No GitPOAPs found for repo with ID ${repoId} (Possibly since they are not PR-based)`,
    );
    return;
  }

  const yearlyGitPOAPsMap = createYearlyGitPOAPsMap(repoInfo.project.gitPOAPs);

  let page = 1;
  let isProcessing = true;

  while (isProcessing) {
    logger.debug(`Handling page #${page}`);

    const prData: GithubPullRequestData[] = await getGithubRepositoryPullsAsAdmin(
      repoInfo.organization.name,
      repoInfo.name,
      BACKFILL_PRS_PER_REQUEST,
      page++,
      'asc',
    );

    if (prData === null) {
      logger.error(`Failed to request page ${page - 1} of the PR data from GitHub`);
      endTimer();
      return;
    }

    // If we've reached the last of the PRs, end after this loop
    if (prData.length < BACKFILL_PRS_PER_REQUEST) {
      isProcessing = false;
    }

    // Handle all the PRs individually (and sequentially)
    for (const pr of prData) {
      await backloadGithubPullRequest(repoInfo, yearlyGitPOAPsMap, pr);
    }
  }

  endTimer();

  logger.debug(
    `Finished backloading the historical PR data for repo ID: ${repoId} (${repoInfo.organization.name}/${repoInfo.name})`,
  );
}
