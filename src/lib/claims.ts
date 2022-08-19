import { context } from '../context';
import { createScopedLogger } from '../logging';
import { retrievePOAPEventInfo } from '../external/poap';
import { Claim } from '@generated/type-graphql';

type GitPOAPs = {
  id: number;
  year: number;
  threshold: number;
}[];

export type RepoData = {
  id: number;
  project: {
    gitPOAPs: GitPOAPs;
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

export async function createNewClaimsForRepoPR(
  user: { id: number },
  repo: RepoData,
  githubPullRequest: { id: number },
) {
  const logger = createScopedLogger('createNewClaimsForRepoPR');

  logger.info(
    `Handling creating new claims for PR ID ${githubPullRequest.id} for User ID ${user.id}`,
  );

  let yearlyGitPOAPMap: Record<string, GitPOAPs> = {};
  for (const gitPOAPInfo of repo.project.gitPOAPs) {
    const yearString = gitPOAPInfo.year.toString();

    if (!(yearString in yearlyGitPOAPMap)) {
      yearlyGitPOAPMap[yearString] = [];
    }

    yearlyGitPOAPMap[yearString].push(gitPOAPInfo);
  }

  const years = Object.keys(yearlyGitPOAPMap);

  logger.debug(`Found ${years.length} years with GitPOAPs`);

  let claims = [];
  for (const year of years) {
    const gitPOAPs = yearlyGitPOAPMap[year];

    const prCount = await context.prisma.githubPullRequest.count({
      where: {
        userId: user.id,
        repoId: repo.id,
        githubMergedAt: {
          gte: new Date(gitPOAPs[0].year, 0, 1),
          lt: new Date(gitPOAPs[0].year + 1, 0, 1),
        },
      },
    });

    logger.debug(`User ID ${user.id} has ${prCount} PRs in year ${year}`);

    // Skip if there are no PRs for this year
    if (prCount === 0) {
      continue;
    }

    for (const gitPOAP of repo.project.gitPOAPs) {
      // Skip this GitPOAP if the threshold wasn't reached
      if (prCount < gitPOAP.threshold) {
        logger.info(
          `User ID ${user.id} misses threshold of ${gitPOAP.threshold} for GitPOAP ID ${gitPOAP.id}`,
        );
        continue;
      }

      logger.info(`Upserting claim for User ID ${user.id} for GitPOAP ID ${gitPOAP.id}`);

      claims.push(await upsertClaim(user, gitPOAP, githubPullRequest));
    }
  }

  return claims;
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
