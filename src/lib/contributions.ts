import { context } from '../context';

export type PullRequestContribution = { pullRequest: { id: number } };
export type IssueContribution = { issue: { id: number } };
export type MentionContribution = { mention: { id: number } };

export type RestrictedContribution = PullRequestContribution | MentionContribution;

export type Contribution = RestrictedContribution | IssueContribution;

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

  const [prCount, mentionedCount] = await Promise.all([
    // Count all PRs that this user has had merged into the
    // repos
    context.prisma.githubPullRequest.count({
      where: {
        userId: user.id,
        repoId: {
          in: repoIds,
        },
        githubMergedAt: dateRange,
      },
    }),
    // Count all (already existing) claims that the user
    // got from mentions. Note that these can be UNCLAIMED
    context.prisma.githubMention.count({
      where: {
        userId: user.id,
        repoId: {
          in: repoIds,
        },
        mentionedAt: dateRange,
      },
    }),
  ]);

  return prCount + mentionedCount;
}
