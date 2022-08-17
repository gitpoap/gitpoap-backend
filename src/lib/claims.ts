import { context } from '../context';
import { createScopedLogger } from '../logging';
import { retrievePOAPEventInfo } from '../external/poap';
import { Claim } from '@generated/type-graphql';

export type RepoData = {
  id: number;
  project: {
    gitPOAPs: {
      id: number;
      year: number;
      threshold: number;
    }[];
  };
};

export type ClaimData = {
  id: number;
  gitPOAP: { id: number; poapEventId: number; threshold: number };
  name: string;
  imageUrl: string;
  description: string;
};

export async function upsertClaim(
  user: { id: number },
  gitPOAP: { id: number },
  githubPullRequest: { id: number },
): Promise<Claim> {
  return await context.prisma.claim.upsert({
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

// This should only be used for PRs from the current year!
export async function createNewClaimsForRepoPR(
  user: { id: number },
  repo: RepoData,
  githubPullRequest: { id: number },
) {
  // We assume here that all the ongoing GitPOAPs have the same year
  const prCount = await context.prisma.githubPullRequest.count({
    where: {
      userId: user.id,
      repoId: repo.id,
      githubMergedAt: {
        gte: new Date(repo.project.gitPOAPs[0].year, 0, 1),
        lt: new Date(repo.project.gitPOAPs[0].year + 1, 0, 1),
      },
    },
  });

  for (const gitPOAP of repo.project.gitPOAPs) {
    // Skip this GitPOAP if the threshold wasn't reached
    if (prCount < gitPOAP.threshold) {
      continue;
    }

    await upsertClaim(user, gitPOAP, githubPullRequest);
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
          isEnabled: true,
        },
      },
    },
  });

  let claimsData: ClaimData[] = [];
  for (const claim of newClaims) {
    if (!claim.gitPOAP.isEnabled) {
      logger.info(`Skipping returning claim for non-enabled GitPOAP ID: ${claim.gitPOAP.id}`);
      continue;
    }

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
