import { GithubIssue, GithubPullRequest } from '@prisma/client';
import {
  getSingleGithubRepositoryIssueAsAdmin,
  getSingleGithubRepositoryPullAsAdmin,
} from '../external/github';
import { createScopedLogger } from '../logging';
import { getRepoByName } from '../lib/repos';
import { upsertUser } from '../lib/users';
import { createNewClaimsForRepoContributionHelper } from '../lib/claims';
import { extractMergeCommitSha, upsertGithubPullRequest } from '../lib/pullRequests';
import { upsertGithubIssue } from '../lib/issues';

export async function createClaimsForPR(
  organization: string,
  repo: string,
  pullRequestNumber: number,
  wasEarnedByMention: boolean,
): Promise<GithubPullRequest | null> {
  const logger = createScopedLogger('createClaimsForPR');

  const repoData = await getRepoByName(organization, repo);
  if (repoData === null) {
    logger.warn(`Failed to find repo: "${organization}/${repo}"`);
    return null;
  }

  const pull = await getSingleGithubRepositoryPullAsAdmin(organization, repo, pullRequestNumber);
  if (pull === null) {
    logger.error(`Failed to query repo data for "${organization}/${repo}" via GitHub API`);
    return null;
  }

  // TODO figure out this
  //  if (pull.user.type === 'Bot') {
  //    logger.info(`Skipping creating new claims for bot "${pull.user.login}"`);
  //    endTimer({ status: 200 });
  //    return res.status(200).send({ newClaims: [] });
  //  }

  // Ensure that we've created a user in our system for the claim
  const user = await upsertUser(pull.user.id, pull.user.login);

  const githubPullRequest = await upsertGithubPullRequest(
    repoData.id,
    pull.number,
    pull.title,
    pull.merged_at === null ? null : new Date(pull.merged_at),
    extractMergeCommitSha(pull),
    user.id,
  );

  // Create any new claims (if they haven't been already)
  await createNewClaimsForRepoContributionHelper(
    user,
    repoData,
    { pullRequest: githubPullRequest },
    wasEarnedByMention,
  );

  return githubPullRequest;
}

export async function createClaimsForIssue(
  organization: string,
  repo: string,
  issueNumber: number,
  wasEarnedByMention: boolean,
): Promise<GithubIssue | null> {
  const logger = createScopedLogger('createClaimsForIssue');

  const repoData = await getRepoByName(organization, repo);
  if (repoData === null) {
    logger.warn(`Failed to find repo: "${organization}/${repo}"`);
    return null;
  }

  const issue = await getSingleGithubRepositoryIssueAsAdmin(organization, repo, issueNumber);

  // TODO handle bots

  // Ensure that we've created a user in our system for the claim
  const user = await upsertUser(issue.user.id, issue.user.login);

  const githubIssue = await upsertGithubIssue(
    repoData.id,
    issue.number,
    issue.title,
    issue.closed_at === null ? null : new Date(issue.closed_at),
    user.id,
  );

  await createNewClaimsForRepoContributionHelper(
    user,
    repoData,
    { issue: githubIssue },
    wasEarnedByMention,
  );

  return githubIssue;
}
