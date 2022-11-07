import '../../../../__mocks__/src/logging';
import { contextMock } from '../../../../__mocks__/src/context';
import { RepoData, createNewClaimsForRepoContributionHelper } from '../../../../src/lib/claims';
import { countContributionsForClaim } from '../../../../src/lib/contributions';
import { Contribution } from '../../../../src/lib/contributions';

jest.mock('../../../../src/logging');
jest.mock('../../../../src/lib/contributions');

const mockedCountContributionsForClaim = jest.mocked(countContributionsForClaim, true);

const githubUser = { id: 4 };

function fillInUpsert(githubUserId: number, gitPOAPId: number, contribution: Contribution) {
  let pullRequestEarned = undefined;
  let issueEarned = undefined;
  let mentionEarned = undefined;
  if ('pullRequest' in contribution) {
    pullRequestEarned = {
      connect: contribution.pullRequest,
    };
  } else if ('issue' in contribution) {
    issueEarned = {
      connect: contribution.issue,
    };
  } else {
    // 'mention' in contribution
    mentionEarned = {
      connect: contribution.mention,
    };
  }

  return {
    where: {
      gitPOAPId_githubUserId: {
        gitPOAPId,
        githubUserId,
      },
    },
    update: {},
    create: {
      gitPOAP: {
        connect: {
          id: gitPOAPId,
        },
      },
      githubUser: {
        connect: {
          id: githubUserId,
        },
      },
      pullRequestEarned,
      issueEarned,
      mentionEarned,
    },
  };
}

describe('createNewClaimsForRepoContribution', () => {
  const pr = { id: 32 };

  it('Does nothing when threshold is not met', async () => {
    mockedCountContributionsForClaim.mockResolvedValue(1);

    const repo: RepoData = {
      id: 43,
      project: {
        gitPOAPs: [
          {
            id: 2,
            year: 9001,
            threshold: 2,
            isPRBased: true,
          },
        ],
        repos: [{ id: 43 }],
      },
    };

    await createNewClaimsForRepoContributionHelper(githubUser, repo, { pullRequest: pr });

    expect(mockedCountContributionsForClaim).toHaveBeenCalledTimes(1);

    expect(contextMock.prisma.claim.upsert).toHaveBeenCalledTimes(0);
  });

  it('Creates claim when threshold is met', async () => {
    mockedCountContributionsForClaim.mockResolvedValue(1);

    const repo: RepoData = {
      id: 43,
      project: {
        gitPOAPs: [
          {
            id: 2,
            year: 9001,
            threshold: 1,
            isPRBased: true,
          },
        ],
        repos: [{ id: 43 }],
      },
    };

    await createNewClaimsForRepoContributionHelper(githubUser, repo, { pullRequest: pr });

    expect(mockedCountContributionsForClaim).toHaveBeenCalledTimes(1);

    expect(contextMock.prisma.claim.upsert).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.claim.upsert).toHaveBeenCalledWith(
      fillInUpsert(githubUser.id, repo.project.gitPOAPs[0].id, { pullRequest: pr }),
    );
  });

  it('Creates multiple claims when thresholds are met', async () => {
    mockedCountContributionsForClaim.mockResolvedValue(4);

    const repo: RepoData = {
      id: 43,
      project: {
        gitPOAPs: [
          {
            id: 2,
            year: 9001,
            threshold: 1,
            isPRBased: true,
          },
          {
            id: 3,
            year: 9001,
            threshold: 3,
            isPRBased: true,
          },
          {
            id: 5,
            year: 9001,
            threshold: 5,
            isPRBased: true,
          },
        ],
        repos: [{ id: 43 }],
      },
    };

    await createNewClaimsForRepoContributionHelper(githubUser, repo, { pullRequest: pr });

    expect(mockedCountContributionsForClaim).toHaveBeenCalledTimes(1);

    expect(contextMock.prisma.claim.upsert).toHaveBeenCalledTimes(2);
    expect(contextMock.prisma.claim.upsert).toHaveBeenCalledWith(
      fillInUpsert(githubUser.id, repo.project.gitPOAPs[0].id, { pullRequest: pr }),
    );
    expect(contextMock.prisma.claim.upsert).toHaveBeenCalledWith(
      fillInUpsert(githubUser.id, repo.project.gitPOAPs[1].id, { pullRequest: pr }),
    );
  });

  it('Creates multiple claims when there are multple GitPOAPs with same threshold', async () => {
    mockedCountContributionsForClaim.mockResolvedValue(1);

    const repo: RepoData = {
      id: 43,
      project: {
        gitPOAPs: [
          {
            id: 2,
            year: 9001,
            threshold: 1,
            isPRBased: true,
          },
          {
            id: 3,
            year: 9001,
            threshold: 1,
            isPRBased: true,
          },
        ],
        repos: [{ id: 43 }],
      },
    };

    await createNewClaimsForRepoContributionHelper(githubUser, repo, { pullRequest: pr });

    expect(mockedCountContributionsForClaim).toHaveBeenCalledTimes(1);

    expect(contextMock.prisma.claim.upsert).toHaveBeenCalledTimes(2);
    expect(contextMock.prisma.claim.upsert).toHaveBeenCalledWith(
      fillInUpsert(githubUser.id, repo.project.gitPOAPs[0].id, { pullRequest: pr }),
    );
    expect(contextMock.prisma.claim.upsert).toHaveBeenCalledWith(
      fillInUpsert(githubUser.id, repo.project.gitPOAPs[1].id, { pullRequest: pr }),
    );
  });
});
