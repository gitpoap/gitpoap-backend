import { context } from '../context';
import { createScopedLogger } from '../logging';
import { retrievePOAPEventInfo } from '../external/poap';

export type RepoData = {
  id: number;
  gitPOAPs: {
    id: number;
    year: number;
    threshold: number;
  }[];
};

export type ClaimData = {
  id: number;
  gitPOAP: { id: number; poapEventId: number; threshold: number };
  name: string;
  imageUrl: string;
  description: string;
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
    WHERE "userId" = ${user.id} AND "repoId" = ${repo.id}
      AND date_part('year', "githubMergedAt") = ${repo.gitPOAPs[0].year}
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

export async function retrieveClaimsCreatedByPR(pullRequestId: number): Promise<ClaimData[]> {
  const logger = createScopedLogger('retrieveClaimsCreatedByPR');

  // Retrieve any new claims created by this new PR
  const newClaims = await context.prisma.claim.findMany({
    where: {
      pullRequestEarnedId: pullRequestId,
    },
    select: {
      id: true,
      gitPOAP: {
        select: {
          id: true,
          poapEventId: true,
          threshold: true,
        },
      },
    },
  });

  let claimsData: ClaimData[] = [];
  for (const claim of newClaims) {
    const poapEvent = await retrievePOAPEventInfo(claim.gitPOAP.poapEventId);
    if (poapEvent === null) {
      logger.error(
        `Failed to lookup POAP event (${claim.gitPOAP.poapEventId}) for GitPOAP id ${claim.gitPOAP.id}`,
      );
      // Just skip this Claim if we caught an error, and we can investigate afterwards
      continue;
    }

    claimsData.push({
      name: poapEvent.name,
      imageUrl: poapEvent.image_url,
      description: poapEvent.description,
      ...claim,
    });
  }

  return claimsData;
}
