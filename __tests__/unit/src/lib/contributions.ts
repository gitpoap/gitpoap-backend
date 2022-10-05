import { contextMock } from '../../../../__mocks__/src/context';
import { countContributionsForClaim } from '../../../../src/lib/contributions';

const user = { id: 4 };

describe('countContributionsForClaim', () => {
  const repoIds = [5, 6];
  const repos = [{ id: repoIds[0] }, { id: repoIds[1] }];

  const basedGitPOAP = {
    year: 2022,
    isPRBased: true,
  };
  const nonBasedGitPOAP = {
    year: 2022,
    isPRBased: false,
  };
  const dateRange = {
    gte: new Date(basedGitPOAP.year, 0, 1),
    lt: new Date(basedGitPOAP.year + 1, 0, 1),
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

    const result = await countContributionsForClaim(user, repos, basedGitPOAP);

    expect(result).toEqual(0);

    expect(contextMock.prisma.githubPullRequest.count).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.githubPullRequest.count).toHaveBeenCalledWith(pullRequestCountArgObj);

    expect(contextMock.prisma.githubMention.count).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.githubMention.count).toHaveBeenCalledWith(mentionCountArgObj);
  });

  it('Returns PR count when there are no Mention contributions', async () => {
    contextMock.prisma.githubPullRequest.count.mockResolvedValue(4);
    contextMock.prisma.githubMention.count.mockResolvedValue(0);

    const result = await countContributionsForClaim(user, repos, basedGitPOAP);

    expect(result).toEqual(4);

    expect(contextMock.prisma.githubPullRequest.count).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.githubPullRequest.count).toHaveBeenCalledWith(pullRequestCountArgObj);

    expect(contextMock.prisma.githubMention.count).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.githubMention.count).toHaveBeenCalledWith(mentionCountArgObj);
  });

  it('Returns Mention count when there are no PR contributions', async () => {
    contextMock.prisma.githubPullRequest.count.mockResolvedValue(0);
    contextMock.prisma.githubMention.count.mockResolvedValue(7);

    const result = await countContributionsForClaim(user, repos, basedGitPOAP);

    expect(result).toEqual(7);

    expect(contextMock.prisma.githubPullRequest.count).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.githubPullRequest.count).toHaveBeenCalledWith(pullRequestCountArgObj);

    expect(contextMock.prisma.githubMention.count).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.githubMention.count).toHaveBeenCalledWith(mentionCountArgObj);
  });

  it('Returns sum of contributions', async () => {
    contextMock.prisma.githubPullRequest.count.mockResolvedValue(3);
    contextMock.prisma.githubMention.count.mockResolvedValue(7);

    const result = await countContributionsForClaim(user, repos, basedGitPOAP);

    expect(result).toEqual(10);

    expect(contextMock.prisma.githubPullRequest.count).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.githubPullRequest.count).toHaveBeenCalledWith(pullRequestCountArgObj);

    expect(contextMock.prisma.githubMention.count).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.githubMention.count).toHaveBeenCalledWith(mentionCountArgObj);
  });

  it('isPRBased=false - Returns 0 when there are no mentions', async () => {
    contextMock.prisma.githubPullRequest.count.mockResolvedValue(3);
    contextMock.prisma.githubMention.count.mockResolvedValue(0);

    const result = await countContributionsForClaim(user, repos, nonBasedGitPOAP);

    expect(result).toEqual(0);

    expect(contextMock.prisma.githubPullRequest.count).toHaveBeenCalledTimes(0);

    expect(contextMock.prisma.githubMention.count).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.githubMention.count).toHaveBeenCalledWith(mentionCountArgObj);
  });

  it('isPRBased=false - Returns mentionCount only when there are mentions', async () => {
    contextMock.prisma.githubPullRequest.count.mockResolvedValue(9001);
    contextMock.prisma.githubMention.count.mockResolvedValue(6);

    const result = await countContributionsForClaim(user, repos, nonBasedGitPOAP);

    expect(result).toEqual(6);

    expect(contextMock.prisma.githubPullRequest.count).toHaveBeenCalledTimes(0);

    expect(contextMock.prisma.githubMention.count).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.githubMention.count).toHaveBeenCalledWith(mentionCountArgObj);
  });
});
