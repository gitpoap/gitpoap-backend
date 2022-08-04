import { createScopedLogger } from '../logging';
import { context } from '../context';
import { GithubPullRequestData, getGithubRepositoryPullsAsAdmin } from '../external/github';
import { pullRequestBackloadDurationSeconds } from '../metrics';
import { upsertUser } from './users';
import { upsertClaim, RepoData } from './claims';
import { GithubPullRequest } from '@generated/type-graphql';

async function getRepoInfo(repoId: number) {
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
            },
            select: {
              id: true,
              year: true,
              threshold: true,
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
export function extractMergeCommitSha(pr: GithubPullRequestData) {
  if (pr.merge_commit_sha === null) {
    return pr.head.sha;
  }

  return pr.merge_commit_sha;
}

export async function upsertGithubPullRequest(
  repoId: number,
  prNumber: number,
  prTitle: string,
  mergedAt: Date,
  mergeCommitSha: string,
  userId: number,
): Promise<GithubPullRequest> {
  const logger = createScopedLogger('upsertGithubPullRequest');

  logger.info(`Upserting PR #${prNumber}`);

  return await context.prisma.githubPullRequest.upsert({
    where: {
      repoId_githubPullNumber: {
        repoId: repoId,
        githubPullNumber: prNumber,
      },
    },
    update: {
      githubMergedAt: mergedAt,
      githubTitle: prTitle,
      githubMergeCommitSha: mergeCommitSha,
    },
    create: {
      githubPullNumber: prNumber,
      githubTitle: prTitle,
      githubMergedAt: mergedAt,
      githubMergeCommitSha: mergeCommitSha,
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

async function backloadGithubPullRequest(repo: RepoData, pr: GithubPullRequestData) {
  const logger = createScopedLogger('backloadGithubPullRequest');

  if (pr.merged_at === null) {
    logger.debug(`Skipping unmerged PR #${pr.number}`);
    return;
  }

  logger.debug(`Handling PR #${pr.number}`);

  const user = await upsertUser(pr.user.id, pr.user.login);

  const mergedAt = new Date(pr.merged_at);

  // Don't create the PR if it already is in the DB (maybe via ongoing issuance)
  // but update the title if it's changed
  const githubPullRequest = await upsertGithubPullRequest(
    repo.id,
    pr.number,
    pr.title,
    mergedAt,
    extractMergeCommitSha(pr),
    user.id,
  );

  const relevantGitPOAP = repo.project.gitPOAPs.find(x => x.year === mergedAt.getFullYear());
  if (!relevantGitPOAP) {
    logger.warn(
      `No relevant GitPOAP found for Repo ID ${repo.id} for year ${mergedAt.getFullYear()}`,
    );
    return;
  }

  const claim = await upsertClaim(user, relevantGitPOAP, githubPullRequest);

  // If this is the user's first PR set the earned at field
  if (claim.pullRequestEarnedId === null) {
    logger.info(
      `Setting pullRequestEarned for Claim ID ${claim.id} to GithubPullRequest ID ${githubPullRequest.id} for user ${pr.user.login}`,
    );

    await context.prisma.claim.update({
      where: {
        gitPOAPId_userId: {
          gitPOAPId: relevantGitPOAP.id,
          userId: user.id,
        },
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
      await backloadGithubPullRequest(repoInfo, pr);
    }
  }

  endTimer();

  logger.debug(
    `Finished backloading the historical PR data for repo ID: ${repoId} (${repoInfo.organization.name}/${repoInfo.name})`,
  );
}
