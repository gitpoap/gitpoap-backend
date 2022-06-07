import { context } from '../context';

export type RepoData = {
  id: number;
  gitPOAPs: {
    id: number;
    year: number;
    threshold: number;
  }[];
};

export async function createNewClaimsForRepoPR(
  user: { id: number },
  repo: RepoData,
  githubPullRequest: { id: number },
) {
  // We assume here that all the ongoing GitPOAPs have the same year
  const prCountData: { count: number }[] = await context.prisma.$queryRaw`
    SELECT COUNT(id)
    FROM "GithubPullRequest"
    WHERE userId = ${user.id} AND repoId = ${repo.id}
      AND date_part('year', githubMergedAt) = ${repo.gitPOAPs[0].year}
  `;
  // There must be a result since we just created a PR
  const prCount = prCountData[0].count;

  for (const gitPOAP of repo.gitPOAPs) {
    // Skip this GitPOAP if the threshold wasn't reached
    if (prCount < gitPOAP.threshold) {
      continue;
    }

    await context.prisma.claim.upsert({
      where: {
        gitPOAPId_userId: {
          gitPOAPId: gitPOAP.id,
          userId: user.id,
        },
      },
      update: {},
      create: {
        gitPOAP: {
          connect: {
            id: gitPOAP.id,
          },
        },
        user: {
          connect: {
            id: user.id,
          },
        },
        pullRequestEarned: {
          connect: {
            id: githubPullRequest.id,
          },
        },
      },
    });
  }
}
