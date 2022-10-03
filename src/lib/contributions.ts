import { context } from '../context';

export type PullRequestContribution = { pullRequest: { id: number } };
export type IssueContribution = { issue: { id: number } };
export type MentionContribution = { mention: { id: number } };

export type RestrictedContribution = PullRequestContribution | MentionContribution;

export type Contribution = RestrictedContribution | IssueContribution;

export async function countContributionsForClaim(
  user: { id: number },
  repos: { id: number }[],
  gitPOAP: { year: number; isPRBased: boolean },
): Promise<number> {
  const repoIds: number[] = repos.map(r => r.id);

  const dateRange = {
    gte: new Date(gitPOAP.year, 0, 1),
    lt: new Date(gitPOAP.year + 1, 0, 1),
  };

  // Count all (already existing) claims that the user
  // got from mentions. We consider the earned at time
  // to be when the related PR/Issue was created
  // Note that these can be UNCLAIMED
  const mentionedCount = await context.prisma.githubMention.count({
    where: {
      userId: user.id,
      repoId: {
        in: repoIds,
      },
      OR: [
        {
          pullRequest: {
            githubCreatedAt: dateRange,
          },
        },
        {
          issue: {
            githubCreatedAt: dateRange,
          },
        },
      ],
    },
  });

  // Note that if the GitPOAP is not PR-based, then we do not include
  // the count of PRs that the user has had merged into the repos
  if (gitPOAP.isPRBased) {
    const prCount = await context.prisma.githubPullRequest.count({
      where: {
        userId: user.id,
        repoId: {
          in: repoIds,
        },
        githubMergedAt: dateRange,
      },
    });

    return prCount + mentionedCount;
  }

  return mentionedCount;
}
