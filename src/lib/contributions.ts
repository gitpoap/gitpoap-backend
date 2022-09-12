import { context } from '../context';

export async function countContributionsForClaim(
  user: { id: number },
  repos: { id: number }[],
  gitPOAP: { year: number },
): Promise<number> {
  const repoIds: number[] = repos.map(r => r.id);

  const dateRange = {
    gte: new Date(gitPOAP.year, 0, 1),
    lt: new Date(gitPOAP.year + 1, 0, 1),
  };

  const [prCount, issueCount] = await Promise.all([
    context.prisma.githubPullRequest.count({
      where: {
        userId: user.id,
        repoId: {
          in: repoIds,
        },
        githubMergedAt: dateRange,
      },
    }),
    context.prisma.githubIssue.count({
      where: {
        userId: user.id,
        repoId: {
          in: repoIds,
        },
        githubClosedAt: dateRange,
      },
    }),
  ]);

  return prCount + issueCount;
}