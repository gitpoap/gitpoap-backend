import 'reflect-metadata';
import '../../../../__mocks__/src/logging';
import {
  BotCreateClaimsErrorType,
  createClaimsForPR,
  createClaimsForIssue,
} from '../../../../src/lib/bot';
import {
  getGithubUserByIdAsAdmin,
  getSingleGithubRepositoryIssueAsAdmin,
  getSingleGithubRepositoryPullAsAdmin,
} from '../../../../src/external/github';
import { getRepoByName } from '../../../../src/lib/repos';
import { upsertGithubUser } from '../../../../src/lib/githubUsers';
import { upsertGithubPullRequest } from '../../../../src/lib/pullRequests';
import { createNewClaimsForRepoContributionHelper } from '../../../../src/lib/claims';
import { upsertGithubIssue } from '../../../../src/lib/issues';
import { upsertGithubMention } from '../../../../src/lib/mentions';

jest.mock('../../../../src/logging');
jest.mock('../../../../src/external/github');
jest.mock('../../../../src/lib/repos');
jest.mock('../../../../src/lib/githubUsers');
jest.mock('../../../../src/lib/pullRequests', () => ({
  __esModule: true,
  ...(<any>jest.requireActual('../../../../src/lib/pullRequests')),
  upsertGithubPullRequest: jest.fn(),
}));
jest.mock('../../../../src/lib/claims');
jest.mock('../../../../src/lib/issues');
jest.mock('../../../../src/lib/mentions');

const mockedGetGithubUserByIdAsAdmin = jest.mocked(getGithubUserByIdAsAdmin, true);
const mockedGetSingleGithubRepositoryPullAsAdmin = jest.mocked(
  getSingleGithubRepositoryPullAsAdmin,
  true,
);
const mockedGetSingleGithubRepositoryIssueAsAdmin = jest.mocked(
  getSingleGithubRepositoryIssueAsAdmin,
  true,
);
const mockedGetRepoByName = jest.mocked(getRepoByName, true);
const mockedUpsertUser = jest.mocked(upsertGithubUser, true);
const mockedUpsertGithubPullRequest = jest.mocked(upsertGithubPullRequest, true);
const mockedCreateNewClaimsForRepoContributionHelper = jest.mocked(
  createNewClaimsForRepoContributionHelper,
  true,
);
const mockedUpsertGithubIssue = jest.mocked(upsertGithubIssue, true);
const mockedUpsertGithubMention = jest.mocked(upsertGithubMention, true);

const githubId = 234;
const organization = 'foo';
const repo = 'bar';
const repoId = 234232;
const githubUserId = 32422;

describe('createClaimsForPR', () => {
  const pullRequestNumber = 3;

  it('Returns with BotUser error if user failed lookup on Github', async () => {
    mockedGetGithubUserByIdAsAdmin.mockResolvedValue(null);
    const wasEarnedByMention = false;

    const result = await createClaimsForPR(
      organization,
      repo,
      pullRequestNumber,
      githubId,
      wasEarnedByMention,
    );

    expect(result).toEqual(BotCreateClaimsErrorType.BotUser);

    expect(mockedGetGithubUserByIdAsAdmin).toHaveBeenCalledTimes(1);
    expect(mockedGetGithubUserByIdAsAdmin).toHaveBeenCalledWith(githubId);

    expect(mockedGetRepoByName).toHaveBeenCalledTimes(0);
  });

  it('Returns with BotUser error if user is a bot', async () => {
    mockedGetGithubUserByIdAsAdmin.mockResolvedValue({ type: 'Bot' } as any);
    const wasEarnedByMention = false;

    const result = await createClaimsForPR(
      organization,
      repo,
      pullRequestNumber,
      githubId,
      wasEarnedByMention,
    );

    expect(result).toEqual(BotCreateClaimsErrorType.BotUser);

    expect(mockedGetGithubUserByIdAsAdmin).toHaveBeenCalledTimes(1);
    expect(mockedGetGithubUserByIdAsAdmin).toHaveBeenCalledWith(githubId);

    expect(mockedGetRepoByName).toHaveBeenCalledTimes(0);
  });

  it('Returns with RepoNotFound error if repo not in DB', async () => {
    mockedGetGithubUserByIdAsAdmin.mockResolvedValue({ type: 'User' } as any);
    mockedGetRepoByName.mockResolvedValue(null);
    const wasEarnedByMention = false;

    const result = await createClaimsForPR(
      organization,
      repo,
      pullRequestNumber,
      githubId,
      wasEarnedByMention,
    );

    expect(result).toEqual(BotCreateClaimsErrorType.RepoNotFound);

    expect(mockedGetGithubUserByIdAsAdmin).toHaveBeenCalledTimes(1);
    expect(mockedGetGithubUserByIdAsAdmin).toHaveBeenCalledWith(githubId);

    expect(mockedGetRepoByName).toHaveBeenCalledTimes(1);
    expect(mockedGetRepoByName).toHaveBeenCalledWith(organization, repo, true);

    expect(mockedGetSingleGithubRepositoryPullAsAdmin).toHaveBeenCalledTimes(0);
  });

  it('Returns with GithubRecordNotFound error if PR not on GitHub', async () => {
    mockedGetGithubUserByIdAsAdmin.mockResolvedValue({ type: 'User' } as any);
    mockedGetRepoByName.mockResolvedValue({ id: repoId } as any);
    mockedGetSingleGithubRepositoryPullAsAdmin.mockResolvedValue(null);
    const wasEarnedByMention = false;

    const result = await createClaimsForPR(
      organization,
      repo,
      pullRequestNumber,
      githubId,
      wasEarnedByMention,
    );

    expect(result).toEqual(BotCreateClaimsErrorType.GithubRecordNotFound);

    expect(mockedGetGithubUserByIdAsAdmin).toHaveBeenCalledTimes(1);
    expect(mockedGetGithubUserByIdAsAdmin).toHaveBeenCalledWith(githubId);

    expect(mockedGetRepoByName).toHaveBeenCalledTimes(1);
    expect(mockedGetRepoByName).toHaveBeenCalledWith(organization, repo, true);

    expect(mockedGetSingleGithubRepositoryPullAsAdmin).toHaveBeenCalledTimes(1);
    expect(mockedGetSingleGithubRepositoryPullAsAdmin).toHaveBeenCalledWith(
      organization,
      repo,
      pullRequestNumber,
    );

    expect(mockedUpsertUser).toHaveBeenCalledTimes(0);
  });

  it('Returns GithubPullRequest on success - without mention', async () => {
    const githubHandle = 'burz9001';
    mockedGetGithubUserByIdAsAdmin.mockResolvedValue({
      id: githubId,
      login: githubHandle,
      type: 'User',
    } as any);
    mockedGetRepoByName.mockResolvedValue({ id: repoId } as any);
    const pullRequest = {
      title: 'foobar',
      merge_commit_sha: 'yeet-2022',
      created_at: '2022-01-16',
      merged_at: '2022-01-22',
    };
    mockedGetSingleGithubRepositoryPullAsAdmin.mockResolvedValue(pullRequest as any);
    mockedUpsertUser.mockResolvedValue({ id: githubUserId } as any);
    const githubPullRequestId = 9995445;
    mockedUpsertGithubPullRequest.mockResolvedValue({ id: githubPullRequestId } as any);
    const wasEarnedByMention = false;

    const result = await createClaimsForPR(
      organization,
      repo,
      pullRequestNumber,
      githubId,
      wasEarnedByMention,
    );

    expect(result).toEqual({ pullRequest: { id: githubPullRequestId } });

    expect(mockedGetGithubUserByIdAsAdmin).toHaveBeenCalledTimes(1);
    expect(mockedGetGithubUserByIdAsAdmin).toHaveBeenCalledWith(githubId);

    expect(mockedGetRepoByName).toHaveBeenCalledTimes(1);
    expect(mockedGetRepoByName).toHaveBeenCalledWith(organization, repo, true);

    expect(mockedGetSingleGithubRepositoryPullAsAdmin).toHaveBeenCalledTimes(1);
    expect(mockedGetSingleGithubRepositoryPullAsAdmin).toHaveBeenCalledWith(
      organization,
      repo,
      pullRequestNumber,
    );

    expect(mockedUpsertUser).toHaveBeenCalledTimes(1);
    expect(mockedUpsertUser).toHaveBeenCalledWith(githubId, githubHandle);

    expect(mockedUpsertGithubPullRequest).toHaveBeenCalledTimes(1);
    expect(mockedUpsertGithubPullRequest).toHaveBeenCalledWith(
      repoId,
      pullRequestNumber,
      pullRequest.title,
      new Date(pullRequest.created_at),
      new Date(pullRequest.merged_at),
      pullRequest.merge_commit_sha,
      githubUserId,
    );

    expect(mockedUpsertGithubMention).toHaveBeenCalledTimes(0);

    expect(mockedCreateNewClaimsForRepoContributionHelper).toHaveBeenCalledTimes(1);
    expect(mockedCreateNewClaimsForRepoContributionHelper).toHaveBeenCalledWith(
      { id: githubUserId },
      { id: repoId },
      { pullRequest: { id: githubPullRequestId } },
    );
  });

  it('Returns GithubMention on success - with mention', async () => {
    const githubHandle = 'burz9001';
    mockedGetGithubUserByIdAsAdmin.mockResolvedValue({
      id: githubId,
      login: githubHandle,
      type: 'User',
    } as any);
    mockedGetRepoByName.mockResolvedValue({ id: repoId } as any);
    const pullRequest = {
      title: 'foobar',
      merge_commit_sha: 'yeet-2022',
      created_at: '2022-01-16',
      merged_at: '2022-01-22',
    };
    mockedGetSingleGithubRepositoryPullAsAdmin.mockResolvedValue(pullRequest as any);
    mockedUpsertUser.mockResolvedValue({ id: githubUserId } as any);
    const githubPullRequestId = 9995445;
    mockedUpsertGithubPullRequest.mockResolvedValue({ id: githubPullRequestId } as any);
    const githubMentionId = 42342;
    mockedUpsertGithubMention.mockResolvedValue({ id: githubMentionId } as any);
    const wasEarnedByMention = true;

    const result = await createClaimsForPR(
      organization,
      repo,
      pullRequestNumber,
      githubId,
      wasEarnedByMention,
    );

    expect(result).toEqual({ mention: { id: githubMentionId } });

    expect(mockedGetGithubUserByIdAsAdmin).toHaveBeenCalledTimes(1);
    expect(mockedGetGithubUserByIdAsAdmin).toHaveBeenCalledWith(githubId);

    expect(mockedGetRepoByName).toHaveBeenCalledTimes(1);
    expect(mockedGetRepoByName).toHaveBeenCalledWith(organization, repo, undefined);

    expect(mockedGetSingleGithubRepositoryPullAsAdmin).toHaveBeenCalledTimes(1);
    expect(mockedGetSingleGithubRepositoryPullAsAdmin).toHaveBeenCalledWith(
      organization,
      repo,
      pullRequestNumber,
    );

    expect(mockedUpsertUser).toHaveBeenCalledTimes(1);
    expect(mockedUpsertUser).toHaveBeenCalledWith(githubId, githubHandle);

    expect(mockedUpsertGithubPullRequest).toHaveBeenCalledTimes(1);
    expect(mockedUpsertGithubPullRequest).toHaveBeenCalledWith(
      repoId,
      pullRequestNumber,
      pullRequest.title,
      new Date(pullRequest.created_at),
      new Date(pullRequest.merged_at),
      pullRequest.merge_commit_sha,
      githubUserId,
    );

    expect(mockedUpsertGithubMention).toHaveBeenCalledTimes(1);
    expect(mockedUpsertGithubMention).toHaveBeenCalledWith(
      repoId,
      { pullRequest: { id: githubPullRequestId } },
      githubUserId,
    );

    expect(mockedCreateNewClaimsForRepoContributionHelper).toHaveBeenCalledTimes(1);
    expect(mockedCreateNewClaimsForRepoContributionHelper).toHaveBeenCalledWith(
      { id: githubUserId },
      { id: repoId },
      { mention: { id: githubMentionId } },
    );
  });
});

describe('createClaimsForIssue', () => {
  const issueNumber = 324;

  it('Returns with BotUser error if user failed lookup on Github', async () => {
    mockedGetGithubUserByIdAsAdmin.mockResolvedValue(null);

    const result = await createClaimsForIssue(organization, repo, issueNumber, githubId);

    expect(result).toEqual(BotCreateClaimsErrorType.BotUser);

    expect(mockedGetGithubUserByIdAsAdmin).toHaveBeenCalledTimes(1);
    expect(mockedGetGithubUserByIdAsAdmin).toHaveBeenCalledWith(githubId);

    expect(mockedGetRepoByName).toHaveBeenCalledTimes(0);
  });

  it('Returns with BotUser error if user is a bot', async () => {
    mockedGetGithubUserByIdAsAdmin.mockResolvedValue({ type: 'Bot' } as any);

    const result = await createClaimsForIssue(organization, repo, issueNumber, githubId);

    expect(result).toEqual(BotCreateClaimsErrorType.BotUser);

    expect(mockedGetGithubUserByIdAsAdmin).toHaveBeenCalledTimes(1);
    expect(mockedGetGithubUserByIdAsAdmin).toHaveBeenCalledWith(githubId);

    expect(mockedGetRepoByName).toHaveBeenCalledTimes(0);
  });

  it('Returns with RepoNotFound error if repo not in DB', async () => {
    mockedGetGithubUserByIdAsAdmin.mockResolvedValue({ type: 'User' } as any);
    mockedGetRepoByName.mockResolvedValue(null);

    const result = await createClaimsForIssue(organization, repo, issueNumber, githubId);

    expect(result).toEqual(BotCreateClaimsErrorType.RepoNotFound);

    expect(mockedGetGithubUserByIdAsAdmin).toHaveBeenCalledTimes(1);
    expect(mockedGetGithubUserByIdAsAdmin).toHaveBeenCalledWith(githubId);

    expect(mockedGetRepoByName).toHaveBeenCalledTimes(1);
    expect(mockedGetRepoByName).toHaveBeenCalledWith(organization, repo);

    expect(mockedGetSingleGithubRepositoryIssueAsAdmin).toHaveBeenCalledTimes(0);
  });

  it('Returns with GithubRecordNotFound error if Issue not on GitHub', async () => {
    mockedGetGithubUserByIdAsAdmin.mockResolvedValue({ type: 'User' } as any);
    mockedGetRepoByName.mockResolvedValue({ id: repoId } as any);
    mockedGetSingleGithubRepositoryIssueAsAdmin.mockResolvedValue(null);

    const result = await createClaimsForIssue(organization, repo, issueNumber, githubId);

    expect(result).toEqual(BotCreateClaimsErrorType.GithubRecordNotFound);

    expect(mockedGetGithubUserByIdAsAdmin).toHaveBeenCalledTimes(1);
    expect(mockedGetGithubUserByIdAsAdmin).toHaveBeenCalledWith(githubId);

    expect(mockedGetRepoByName).toHaveBeenCalledTimes(1);
    expect(mockedGetRepoByName).toHaveBeenCalledWith(organization, repo);

    expect(mockedGetSingleGithubRepositoryIssueAsAdmin).toHaveBeenCalledTimes(1);
    expect(mockedGetSingleGithubRepositoryIssueAsAdmin).toHaveBeenCalledWith(
      organization,
      repo,
      issueNumber,
    );

    expect(mockedUpsertUser).toHaveBeenCalledTimes(0);
  });

  it('Returns GithubMention on success - with mention', async () => {
    const githubHandle = 'burz9001';
    mockedGetGithubUserByIdAsAdmin.mockResolvedValue({
      id: githubId,
      login: githubHandle,
      type: 'User',
    } as any);
    mockedGetRepoByName.mockResolvedValue({ id: repoId } as any);
    const issue = {
      title: 'barfoo',
      created_at: '2022-01-16',
      closed_at: '2022-01-22',
    };
    mockedGetSingleGithubRepositoryIssueAsAdmin.mockResolvedValue(issue as any);
    mockedUpsertUser.mockResolvedValue({ id: githubUserId } as any);
    const githubIssueId = 349999;
    mockedUpsertGithubIssue.mockResolvedValue({ id: githubIssueId } as any);
    const githubMentionId = 94234;
    mockedUpsertGithubMention.mockResolvedValue({ id: githubMentionId } as any);

    const result = await createClaimsForIssue(organization, repo, issueNumber, githubId);

    expect(result).toEqual({ mention: { id: githubMentionId } });

    expect(mockedGetGithubUserByIdAsAdmin).toHaveBeenCalledTimes(1);
    expect(mockedGetGithubUserByIdAsAdmin).toHaveBeenCalledWith(githubId);

    expect(mockedGetRepoByName).toHaveBeenCalledTimes(1);
    expect(mockedGetRepoByName).toHaveBeenCalledWith(organization, repo);

    expect(mockedGetSingleGithubRepositoryIssueAsAdmin).toHaveBeenCalledTimes(1);
    expect(mockedGetSingleGithubRepositoryIssueAsAdmin).toHaveBeenCalledWith(
      organization,
      repo,
      issueNumber,
    );

    expect(mockedUpsertUser).toHaveBeenCalledTimes(1);
    expect(mockedUpsertUser).toHaveBeenCalledWith(githubId, githubHandle);

    expect(mockedUpsertGithubIssue).toHaveBeenCalledTimes(1);
    expect(mockedUpsertGithubIssue).toHaveBeenCalledWith(
      repoId,
      issueNumber,
      issue.title,
      new Date(issue.created_at),
      new Date(issue.closed_at),
      githubUserId,
    );

    expect(mockedUpsertGithubMention).toHaveBeenCalledTimes(1);
    expect(mockedUpsertGithubMention).toHaveBeenCalledWith(
      repoId,
      { issue: { id: githubIssueId } },
      githubUserId,
    );

    expect(mockedCreateNewClaimsForRepoContributionHelper).toHaveBeenCalledTimes(1);
    expect(mockedCreateNewClaimsForRepoContributionHelper).toHaveBeenCalledWith(
      { id: githubUserId },
      { id: repoId },
      { mention: { id: githubMentionId } },
    );
  });
});
