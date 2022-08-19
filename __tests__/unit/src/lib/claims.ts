import { contextMock } from '../../../../__mocks__/src/context';
import { createNewClaimsForRepoPR, RepoData } from '../../../../src/lib/claims';

const user = { id: 4 };
const pr = { id: 32 };

function fillInUpsert(userId: number, gitPOAPId: number, prId: number) {
  return {
    where: {
      gitPOAPId_userId: {
        gitPOAPId: gitPOAPId,
        userId: userId,
      },
    },
    update: {},
    create: {
      gitPOAP: {
        connect: {
          id: gitPOAPId,
        },
      },
      user: {
        connect: {
          id: userId,
        },
      },
      pullRequestEarned: {
        connect: {
          id: prId,
        },
      },
    },
  };
}

describe('createNewClaimsForRepoPR', () => {
  it('Does nothing when threshold is not met', async () => {
    contextMock.prisma.githubPullRequest.count.mockResolvedValue(1);

    const repo: RepoData = {
      id: 43,
      project: {
        gitPOAPs: [
          {
            id: 2,
            year: 9001,
            threshold: 2,
          },
        ],
      },
    };

    await createNewClaimsForRepoPR(user, repo, pr);

    expect(contextMock.prisma.githubPullRequest.count).toHaveBeenCalledTimes(1);

    expect(contextMock.prisma.claim.upsert).toHaveBeenCalledTimes(0);
  });

  it('Creates claim when threshold is met', async () => {
    contextMock.prisma.githubPullRequest.count.mockResolvedValue(1);

    const repo: RepoData = {
      id: 43,
      project: {
        gitPOAPs: [
          {
            id: 2,
            year: 9001,
            threshold: 1,
          },
        ],
      },
    };

    await createNewClaimsForRepoPR(user, repo, pr);

    expect(contextMock.prisma.githubPullRequest.count).toHaveBeenCalledTimes(1);

    expect(contextMock.prisma.claim.upsert).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.claim.upsert).toHaveBeenCalledWith(
      fillInUpsert(user.id, repo.project.gitPOAPs[0].id, pr.id),
    );
  });

  it('Creates multiple claims when thresholds are met', async () => {
    contextMock.prisma.githubPullRequest.count.mockResolvedValue(4);

    const repo: RepoData = {
      id: 43,
      project: {
        gitPOAPs: [
          {
            id: 2,
            year: 9001,
            threshold: 1,
          },
          {
            id: 3,
            year: 9001,
            threshold: 3,
          },
          {
            id: 5,
            year: 9001,
            threshold: 5,
          },
        ],
      },
    };

    await createNewClaimsForRepoPR(user, repo, pr);

    expect(contextMock.prisma.githubPullRequest.count).toHaveBeenCalledTimes(1);

    expect(contextMock.prisma.claim.upsert).toHaveBeenCalledTimes(2);
    expect(contextMock.prisma.claim.upsert).toHaveBeenCalledWith(
      fillInUpsert(user.id, repo.project.gitPOAPs[0].id, pr.id),
    );
    expect(contextMock.prisma.claim.upsert).toHaveBeenCalledWith(
      fillInUpsert(user.id, repo.project.gitPOAPs[1].id, pr.id),
    );
  });

  it('Creates multiple claims when there are multple GitPOAPs with same threshold', async () => {
    contextMock.prisma.githubPullRequest.count.mockResolvedValue(1);

    const repo: RepoData = {
      id: 43,
      project: {
        gitPOAPs: [
          {
            id: 2,
            year: 9001,
            threshold: 1,
          },
          {
            id: 3,
            year: 9001,
            threshold: 1,
          },
        ],
      },
    };

    await createNewClaimsForRepoPR(user, repo, pr);

    expect(contextMock.prisma.githubPullRequest.count).toHaveBeenCalledTimes(1);

    expect(contextMock.prisma.claim.upsert).toHaveBeenCalledTimes(2);
    expect(contextMock.prisma.claim.upsert).toHaveBeenCalledWith(
      fillInUpsert(user.id, repo.project.gitPOAPs[0].id, pr.id),
    );
    expect(contextMock.prisma.claim.upsert).toHaveBeenCalledWith(
      fillInUpsert(user.id, repo.project.gitPOAPs[1].id, pr.id),
    );
  });
});
