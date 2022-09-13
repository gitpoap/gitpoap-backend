import {
  getGithubUserByIdAsAdmin,
  getSingleGithubRepositoryIssueAsAdmin,
  getSingleGithubRepositoryPullAsAdmin,
} from '../external/github';
import { createScopedLogger } from '../logging';
import { getRepoByName } from './repos';
import { upsertUser } from './users';
import { Contribution, createNewClaimsForRepoContributionHelper } from './claims';
import { extractMergeCommitSha, upsertGithubPullRequest } from './pullRequests';
import { upsertGithubIssue } from './issues';
import { upsertGithubMention } from './mentions';

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
): Promise<Contribution | BotCreateClaimsErrorType> {
  const logger = createScopedLogger('createClaimsForPR');

  const userInfo = await getGithubUserByIdAsAdmin(githubId);
  if (userInfo === null) {
    // In this case let's log an error and then pretend they are a bot
    // so they get skipped
    logger.error(`Failed to lookup Github user ID ${githubId}`);
    return BotCreateClaimsErrorType.BotUser;
  }
  if (userInfo.type === 'Bot') {
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
  const user = await upsertUser(userInfo.id, userInfo.login);

  const githubPullRequest = await upsertGithubPullRequest(
    repoData.id,
    pullRequestNumber,
    pull.title,
    pull.merged_at === null ? null : new Date(pull.merged_at),
    extractMergeCommitSha(pull),
    user.id,
  );

  let contribution: Contribution = { pullRequest: githubPullRequest };
  if (wasEarnedByMention) {
    const githubMention = await upsertGithubMention(repoData.id, contribution, user.id);

    contribution = { mention: githubMention };
  }

  // Create any new claims (if they haven't been already)
  await createNewClaimsForRepoContributionHelper(user, repoData, contribution);

  return contribution;
}

export async function createClaimsForIssue(
  organization: string,
  repo: string,
  issueNumber: number,
  githubId: number,
  wasEarnedByMention: boolean,
): Promise<Contribution | BotCreateClaimsErrorType> {
  const logger = createScopedLogger('createClaimsForIssue');

  const userInfo = await getGithubUserByIdAsAdmin(githubId);
  if (userInfo === null) {
    // In this case let's log an error and then pretend they are a bot
    // so they get skipped
    logger.error(`Failed to lookup Github user ID ${githubId}`);
    return BotCreateClaimsErrorType.BotUser;
  }
  if (userInfo.type === 'Bot') {
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
  const user = await upsertUser(userInfo.id, userInfo.login);

  const githubIssue = await upsertGithubIssue(
    repoData.id,
    issueNumber,
    issue.title,
    issue.closed_at === null ? null : new Date(issue.closed_at),
    user.id,
  );

  let contribution: Contribution = { issue: githubIssue };
  if (wasEarnedByMention) {
    const githubMention = await upsertGithubMention(repoData.id, contribution, user.id);

    contribution = { mention: githubMention };
  }

  await createNewClaimsForRepoContributionHelper(user, repoData, contribution);

  return contribution;
}
