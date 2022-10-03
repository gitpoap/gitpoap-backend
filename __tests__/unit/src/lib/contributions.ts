import { contextMock } from '../../../../__mocks__/src/context';
import { countContributionsForClaim } from '../../../../src/lib/contributions';

const user = { id: 4 };

describe('countContributionsForClaim', () => {
  const repoIds = [5, 6];
  const repos = [{ id: repoIds[0] }, { id: repoIds[1] }];
  const gitPOAP = {
    year: 2022,
    isPRBased: true,
  };
  const dateRange = {
    gte: new Date(gitPOAP.year, 0, 1),
    lt: new Date(gitPOAP.year + 1, 0, 1),
  };
  const pullRequestCountArgObj = {
    where: {
      userId: user.id,
      repoId: { in: repoIds },
      githubMergedAt: dateRange,
    },
  };
  const mentionCountArgObj = {
    where: {
      userId: user.id,
      repoId: { in: repoIds },
      OR: [
        { pullRequest: { githubCreatedAt: dateRange } },
        { issue: { githubCreatedAt: dateRange } },
      ],
    },
  };

  it('Returns 0 when there are no contributions', async () => {
    contextMock.prisma.githubPullRequest.count.mockResolvedValue(0);
    contextMock.prisma.githubMention.count.mockResolvedValue(0);

    const result = await countContributionsForClaim(user, repos, gitPOAP);

    expect(result).toEqual(0);

    expect(contextMock.prisma.githubPullRequest.count).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.githubPullRequest.count).toHaveBeenCalledWith(pullRequestCountArgObj);

    expect(contextMock.prisma.githubMention.count).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.githubMention.count).toHaveBeenCalledWith(mentionCountArgObj);
  });

  it('Returns PR count when there are no Issue contributions', async () => {
    contextMock.prisma.githubPullRequest.count.mockResolvedValue(4);
    contextMock.prisma.githubMention.count.mockResolvedValue(0);

    const result = await countContributionsForClaim(user, repos, gitPOAP);

    expect(result).toEqual(4);

    expect(contextMock.prisma.githubPullRequest.count).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.githubPullRequest.count).toHaveBeenCalledWith(pullRequestCountArgObj);

    expect(contextMock.prisma.githubMention.count).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.githubMention.count).toHaveBeenCalledWith(mentionCountArgObj);
  });

  it('Returns Issue count when there are no PR contributions', async () => {
    contextMock.prisma.githubPullRequest.count.mockResolvedValue(0);
    contextMock.prisma.githubMention.count.mockResolvedValue(7);

    const result = await countContributionsForClaim(user, repos, gitPOAP);

    expect(result).toEqual(7);

    expect(contextMock.prisma.githubPullRequest.count).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.githubPullRequest.count).toHaveBeenCalledWith(pullRequestCountArgObj);

    expect(contextMock.prisma.githubMention.count).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.githubMention.count).toHaveBeenCalledWith(mentionCountArgObj);
  });

  it('Returns sum of contributions', async () => {
    contextMock.prisma.githubPullRequest.count.mockResolvedValue(3);
    contextMock.prisma.githubMention.count.mockResolvedValue(7);

    const result = await countContributionsForClaim(user, repos, gitPOAP);

    expect(result).toEqual(10);

    expect(contextMock.prisma.githubPullRequest.count).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.githubPullRequest.count).toHaveBeenCalledWith(pullRequestCountArgObj);

    expect(contextMock.prisma.githubMention.count).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.githubMention.count).toHaveBeenCalledWith(mentionCountArgObj);
  });
});
