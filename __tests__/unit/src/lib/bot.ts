import 'reflect-metadata';
import { mockedLogger } from '../../../../__mocks__/src/logging';
import { contextMock } from '../../../../__mocks__/src/context';
import {
  BotCreateClaimsErrorType,
  isUserABot,
  createClaimsForPR,
  createClaimsForIssue,
} from '../../../../src/lib/bot';
import {
  getGithubUserByIdAsAdmin,
  getSingleGithubRepositoryPullAsAdmin,
} from '../../../../src/external/github';
import { getRepoByName } from '../../../../src/lib/repos';
import { upsertUser } from '../../../../src/lib/users';
import { upsertGithubPullRequest } from '../../../../src/lib/pullRequests';
import { createNewClaimsForRepoContributionHelper } from '../../../../src/lib/claims';

jest.mock('../../../../src/external/github');
jest.mock('../../../../src/lib/repos');
jest.mock('../../../../src/lib/users');
jest.mock('../../../../src/lib/pullRequests');
jest.mock('../../../../src/lib/claims');

const mockedGetGithubUserByIdAsAdmin = jest.mocked(getGithubUserByIdAsAdmin, true);
const mockedGetSingleGithubRepositoryPullAsAdmin = jest.mocked(getSingleGithubRepositoryPullAsAdmin, true);
const mockedGetRepoByName = jest.mocked(getRepoByName, true);
const mockedUpsertUser = jest.mocked(upsertUser, true);
const mockedUpsertGithubPullRequest = jest.mocked(upsertGithubPullRequest, true);
const mockedCreateNewClaimsForRepoContributionHelper = jest.mocked(createNewClaimsForRepoContributionHelper, true);

const githubId = 234;
const organization = 'foo';
const repo = 'bar';
const repoId = 234232;
const pullRequestNumber = 3;
const issueNumber = 324;
const wasEarnedByMention = false;
const userId = 32422;
const githubPullRequestId = 9995445;

describe('isUserABot', () => {
  it('Returns true if GitHub lookup fails', async () => {
    mockedGetGithubUserByIdAsAdmin.mockResolvedValue(null);

    const result = await isUserABot(githubId);

    expect(result).toEqual(true);

    expect(mockedGetGithubUserByIdAsAdmin).toHaveBeenCalledTimes(1);
    expect(mockedGetGithubUserByIdAsAdmin).toHaveBeenCalledWith(githubId);
  });

  it("Returns true if Github says it's a bot", async () => {
    mockedGetGithubUserByIdAsAdmin.mockResolvedValue({ type: 'Bot' } as any);

    const result = await isUserABot(githubId);

    expect(result).toEqual(true);

    expect(mockedGetGithubUserByIdAsAdmin).toHaveBeenCalledTimes(1);
    expect(mockedGetGithubUserByIdAsAdmin).toHaveBeenCalledWith(githubId);
  });

  it('Returns true if Github says its a user', async () => {
    mockedGetGithubUserByIdAsAdmin.mockResolvedValue({ type: 'User' } as any);

    const result = await isUserABot(githubId);

    expect(result).toEqual(false);

    expect(mockedGetGithubUserByIdAsAdmin).toHaveBeenCalledTimes(1);
    expect(mockedGetGithubUserByIdAsAdmin).toHaveBeenCalledWith(githubId);
  });
});

describe('createClaimsForPR', () => {
  it('Returns with BotUser error if user is a bot', async () => {
    mockedGetGithubUserByIdAsAdmin.mockResolvedValue({ type: 'Bot' } as any);

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
    expect(mockedGetRepoByName).toHaveBeenCalledWith(organization, repo);

    expect(mockedGetSingleGithubRepositoryPullAsAdmin).toHaveBeenCalledTimes(0);
  });

  it('Returns with GithubRecordNotFound error if PR not on GitHub', async () => {
    mockedGetGithubUserByIdAsAdmin.mockResolvedValue({ type: 'User' } as any);
    mockedGetRepoByName.mockResolvedValue({ id: repoId } as any);
    mockedGetSingleGithubRepositoryPullAsAdmin.mockResolvedValue(null);

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
    expect(mockedGetRepoByName).toHaveBeenCalledWith(organization, repo);

    expect(mockedGetSingleGithubRepositoryPullAsAdmin).toHaveBeenCalledTimes(1);
    expect(mockedGetSingleGithubRepositoryPullAsAdmin).toHaveBeenCalledWith(repoId);

    expect(mockedUpsertUser).toHaveBeenCalledTimes(0);
  });

  it('Returns GithubPullRequest on success', async () => {
    const githubHandle = 'burz9001';
    mockedGetGithubUserByIdAsAdmin.mockResolvedValue({
      login: githubHandle,
      type: 'User',
    } as any);
    mockedGetRepoByName.mockResolvedValue({ id: repoId } as any);
    const pullRequest = {
      title: 'foobar',
      merge_commit_sha: 'yeet-2022',
      merged_at: '2022-01-22',
    };
    mockedGetSingleGithubRepositoryPullAsAdmin.mockResolvedValue(pullRequest as any);
    mockedUpsertUser.mockResolvedValue({ id: userId } as any);
    mockedUpsertGithubPullRequest.mockResolvedValue({ id: githubPullRequestId } as any);

    const result = await createClaimsForPR(
      organization,
      repo,
      pullRequestNumber,
      githubId,
      wasEarnedByMention,
    );

    expect(result).toEqual({ id: githubPullRequestId });

    expect(mockedGetGithubUserByIdAsAdmin).toHaveBeenCalledTimes(1);
    expect(mockedGetGithubUserByIdAsAdmin).toHaveBeenCalledWith(githubId);

    expect(mockedGetRepoByName).toHaveBeenCalledTimes(1);
    expect(mockedGetRepoByName).toHaveBeenCalledWith(organization, repo);

    expect(mockedGetSingleGithubRepositoryPullAsAdmin).toHaveBeenCalledTimes(1);
    expect(mockedGetSingleGithubRepositoryPullAsAdmin).toHaveBeenCalledWith(repoId);

    expect(mockedUpsertUser).toHaveBeenCalledTimes(1);
    expect(mockedUpsertUser).toHaveBeenCalledWith(githubId, githubHandle); 

    expect(mockedUpsertGithubPullRequest).toHaveBeenCalledTimes(1);
    expect(mockedUpsertGithubPullRequest).toHaveBeenCalledWith(
      repoId,
      pullRequestNumber,
      pullRequest.title,
      new Date(pullRequest.merged_at),
      pullRequest.merge_commit_sha,
      userId,
    );
  });

  expect(mockedCreateNewClaimsForRepoContributionHelper).toHaveBeenCalledTimes(1);
  expect(mockedCreateNewClaimsForRepoContributionHelper).toHaveBeenCalledWith(
    { id: userId },
    { id: repoId },
    { pullRequest: { id: githubPullRequestId } },
    wasEarnedByMention,
  );
});
