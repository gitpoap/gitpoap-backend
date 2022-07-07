import { jest } from '@jest/globals';
import { contextMock } from '../../../../__mocks__/src/context';
import { handleNewPull, RepoReturnType } from '../../../../src/lib/ongoing';
import { GithubPullRequestData } from '../../../../src/external/github';
import { upsertUser } from '../../../../src/lib/users';
import { upsertGithubPullRequest } from '../../../../src/lib/pullRequests';
import { User } from '@generated/type-graphql';
import { createNewClaimsForRepoPR } from '../../../../src/lib/claims';

jest.mock('../../../../src/lib/users');

const mockedLogger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

jest.mock('../../../../src/logging', () => ({
  __esModule: true,
  createScopedLogger: () => mockedLogger,
}));

jest.mock('../../../../src/lib/pullRequests', () => ({
  __esModule: true,
  ...(<any>jest.requireActual('../../../../src/lib/pullRequests')),
  upsertGithubPullRequest: jest.fn(),
}));

jest.mock('../../../../src/lib/claims');

const mockedUpsertUser = jest.mocked(upsertUser, true);
const mockedUpsertGithubPullRequest = jest.mocked(upsertGithubPullRequest, true);

const user: User = {
  id: 32423,
  githubId: 43532,
  githubHandle: 'some-user',
  createdAt: new Date('2020-01-01'),
  updatedAt: new Date('2022-05-03'),
};

const repo: RepoReturnType = {
  id: 5,
  name: 'repo',
  lastPRUpdatedAt: new Date('2022-06-10'),
  project: {
    gitPOAPs: [
      {
        id: 50,
        year: 2022,
        threshold: 1,
      },
    ],
  },
  organization: {
    name: 'org',
  },
};

describe('handleNewPull', () => {
  it('Skips unmerged PRs', async () => {
    const pull: GithubPullRequestData = {
      number: 4,
      title: 'Some unmerged PR',
      user: {
        id: user.githubId,
        login: user.githubHandle,
      },
      merged_at: null,
      updated_at: '2022-06-13',
      merge_commit_sha: 'lkjsdlkfjalskjfdlkajs',
      head: {
        sha: 'kjsldfkssakjsl',
      },
    };

    const result = await handleNewPull(repo, pull);

    expect(result.finished).toEqual(false);
    expect(result.updatedAt).toEqual(new Date(pull.updated_at));

    expect(upsertUser).toHaveBeenCalledTimes(0);
  });

  it('Stops after updatedAt is less than lastUpdatedAt', async () => {
    const pull: GithubPullRequestData = {
      number: 2,
      title: 'Some older PR',
      user: {
        id: user.githubId,
        login: user.githubHandle,
      },
      merged_at: '2022-06-09',
      updated_at: '2022-06-09',
      merge_commit_sha: 'lkdlk324fjalskjfdlkajs',
      head: {
        sha: 'kjsldfkssakjsl333',
      },
    };

    const result = await handleNewPull(repo, pull);

    expect(result.finished).toEqual(true);
    expect(result.updatedAt).toEqual(new Date(pull.updated_at));

    expect(upsertUser).toHaveBeenCalledTimes(0);
  });

  it('Logs error without creating claims if newer year found', async () => {
    mockedUpsertUser.mockResolvedValue(user);

    const pull: GithubPullRequestData = {
      number: 20034,
      title: 'Some newer PR',
      user: {
        id: user.githubId,
        login: user.githubHandle,
      },
      merged_at: '2023-06-09',
      updated_at: '2023-06-09',
      merge_commit_sha: 'lk324fjalskjfdlkajs',
      head: {
        sha: 'kjsldfksssl333',
      },
    };

    const result = await handleNewPull(repo, pull);

    expect(result.finished).toEqual(false);
    expect(result.updatedAt).toEqual(new Date(pull.updated_at));

    expect(upsertUser).toHaveBeenCalledTimes(1);
    expect(upsertUser).toHaveBeenCalledWith(pull.user.id, pull.user.login);

    expect(upsertGithubPullRequest).toHaveBeenCalledTimes(1);
    expect(upsertGithubPullRequest).toHaveBeenCalledWith(
      repo.id,
      pull.number,
      pull.title,
      new Date(<string>pull.merged_at),
      pull.merge_commit_sha,
      user.id,
    );

    expect(mockedLogger.error).toHaveBeenCalledTimes(1);

    expect(createNewClaimsForRepoPR).toHaveBeenCalledTimes(0);
  });

  it("Doesn't try to create claims for older years", async () => {
    mockedUpsertUser.mockResolvedValue(user);

    const pull: GithubPullRequestData = {
      number: 204,
      title: 'Some older merged PR',
      user: {
        id: user.githubId,
        login: user.githubHandle,
      },
      merged_at: '2021-04-19',
      updated_at: '2022-06-13',
      merge_commit_sha: 'aaaa4fjalskjfdlkajs',
      head: {
        sha: 'kqqqqdfksssl333',
      },
    };

    const result = await handleNewPull(repo, pull);

    expect(result.finished).toEqual(false);
    expect(result.updatedAt).toEqual(new Date(pull.updated_at));

    expect(upsertUser).toHaveBeenCalledTimes(1);
    expect(upsertUser).toHaveBeenCalledWith(pull.user.id, pull.user.login);

    expect(upsertGithubPullRequest).toHaveBeenCalledTimes(1);
    expect(upsertGithubPullRequest).toHaveBeenCalledWith(
      repo.id,
      pull.number,
      pull.title,
      new Date(<string>pull.merged_at),
      pull.merge_commit_sha,
      user.id,
    );

    expect(mockedLogger.error).toHaveBeenCalledTimes(0);

    expect(createNewClaimsForRepoPR).toHaveBeenCalledTimes(0);
  });

  it('Creates claims for this year', async () => {
    mockedUpsertUser.mockResolvedValue(user);

    const pull: GithubPullRequestData = {
      number: 29004,
      title: 'Some just merged PR',
      user: {
        id: user.githubId,
        login: user.githubHandle,
      },
      merged_at: '2022-06-13',
      updated_at: '2022-06-13',
      merge_commit_sha: '444aaaa4fjalskjfdlkajs',
      head: {
        sha: 'kq555555555l333',
      },
    };

    const pr = {
      id: 233,
      createdAt: new Date('2022-06-13'),
      updatedAt: new Date('2022-06-13'),
      githubPullNumber: pull.number,
      githubTitle: pull.title,
      githubMergedAt: new Date(<string>pull.merged_at),
      githubMergeCommitSha: pull.merge_commit_sha,
      repoId: repo.id,
      userId: user.id,
    };

    mockedUpsertGithubPullRequest.mockResolvedValue(pr);

    const result = await handleNewPull(repo, pull);

    expect(result.finished).toEqual(false);
    expect(result.updatedAt).toEqual(new Date(pull.updated_at));

    expect(upsertUser).toHaveBeenCalledTimes(1);
    expect(upsertUser).toHaveBeenCalledWith(pull.user.id, pull.user.login);

    expect(upsertGithubPullRequest).toHaveBeenCalledTimes(1);
    expect(upsertGithubPullRequest).toHaveBeenCalledWith(
      repo.id,
      pull.number,
      pull.title,
      new Date(<string>pull.merged_at),
      pull.merge_commit_sha,
      user.id,
    );

    expect(createNewClaimsForRepoPR).toHaveBeenCalledTimes(1);
    expect(createNewClaimsForRepoPR).toHaveBeenCalledWith(user, repo, pr);
  });
});
