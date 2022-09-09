import { GithubIssue, GithubPullRequest } from '@prisma/client';
import {
  getGithubUserByIdAsAdmin,
  getSingleGithubRepositoryIssueAsAdmin,
  getSingleGithubRepositoryPullAsAdmin,
} from '../external/github';
import { createScopedLogger } from '../logging';
import { getRepoByName } from '../lib/repos';
import { upsertUser } from '../lib/users';
import { createNewClaimsForRepoContributionHelper } from '../lib/claims';
import { extractMergeCommitSha, upsertGithubPullRequest } from '../lib/pullRequests';
import { upsertGithubIssue } from '../lib/issues';

async function isUserABot(githubId: number): Promise<boolean> {
  const logger = createScopedLogger('isUserABot');

  const userInfo = await getGithubUserByIdAsAdmin(githubId);

  if (userInfo === null) {
    // In this case let's log an error and then pretend they are a bot
    // so they get skipped
    logger.error(`Failed to lookup Github user ID ${githubId}`);
    return true;
  }

  return userInfo.type === 'Bot';
}

export enum BotCreateClaimsErrorType {
  BotUser,
  RepoNotFound,
  GithubRecordNotFound,
}

export async function createClaimsForPR(
  organization: string,
  repo: string,
  pullRequestNumber: number,
  githubId: number,
  wasEarnedByMention: boolean,
): Promise<GithubPullRequest | BotCreateClaimsErrorType> {
  const logger = createScopedLogger('createClaimsForPR');

  if (await isUserABot(githubId)) {
    logger.info(`Skipping creating new claims for bot ID: ${githubId}`);
    return BotCreateClaimsErrorType.BotUser;
  }

  const repoData = await getRepoByName(organization, repo);
  if (repoData === null) {
    logger.warn(`Failed to find repo: "${organization}/${repo}"`);
    return BotCreateClaimsErrorType.RepoNotFound;
  }

  const pull = await getSingleGithubRepositoryPullAsAdmin(organization, repo, pullRequestNumber);
  if (pull === null) {
    logger.error(`Failed to query repo data for "${organization}/${repo}" via GitHub API`);
    return BotCreateClaimsErrorType.GithubRecordNotFound;
  }

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
  githubId: number,
  wasEarnedByMention: boolean,
): Promise<GithubIssue | BotCreateClaimsErrorType> {
  const logger = createScopedLogger('createClaimsForIssue');

  if (await isUserABot(githubId)) {
    logger.info(`Skipping creating new claims for bot ID: ${githubId}`);
    return BotCreateClaimsErrorType.BotUser;
  }

  const repoData = await getRepoByName(organization, repo);
  if (repoData === null) {
    logger.warn(`Failed to find repo: "${organization}/${repo}"`);
    return BotCreateClaimsErrorType.RepoNotFound;
  }

  const issue = await getSingleGithubRepositoryIssueAsAdmin(organization, repo, issueNumber);
  if (issue === null) {
    return BotCreateClaimsErrorType.GithubRecordNotFound;
  }

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
