import { ClaimStatus } from '@prisma/client';
import { Claim } from '@generated/type-graphql';
import { context } from '../context';
import { createScopedLogger } from '../logging';
import { RestrictedContribution, countContributionsForClaim } from './contributions';

type GitPOAPs = {
  id: number;
  year: number;
  threshold: number;
  isPRBased: boolean;
}[];

export type YearlyGitPOAPsMap = Record<string, GitPOAPs>;

export type RepoData = {
  id: number;
  project: {
    gitPOAPs: GitPOAPs;
    repos: { id: number }[];
  };
};

export type ClaimData = {
  id: number;
  user: {
    githubHandle: string;
  };
  gitPOAP: {
    id: number;
    name: string;
    imageUrl: string;
    description: string;
    threshold: number;
  };
};

export async function upsertClaim(
  user: { id: number },
  gitPOAP: { id: number },
  contribution: RestrictedContribution,
): Promise<Claim> {
  let pullRequestEarned = undefined;
  let mentionEarned = undefined;

  if ('pullRequest' in contribution) {
    pullRequestEarned = {
      connect: {
        id: contribution.pullRequest.id,
      },
    };
  } else {
    // 'mention' in contribution
    mentionEarned = {
      connect: {
        id: contribution.mention.id,
      },
    };
  }

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
      pullRequestEarned,
      mentionEarned,
    },
  });
}

export async function updateClaimStatusById(
  claimId: number,
  status: ClaimStatus,
  mintedAddress: string | null,
): Promise<Claim> {
  const mintedAddressData = mintedAddress
    ? {
        connectOrCreate: {
          where: {
            ethAddress: mintedAddress?.toLowerCase(),
          },
          create: {
            ethAddress: mintedAddress?.toLowerCase(),
          },
        },
      }
    : undefined;

  return await context.prisma.claim.update({
    where: {
      id: claimId,
    },
    data: {
      status,
      mintedAddress: mintedAddressData,
    },
  });
}

export function createYearlyGitPOAPsMap(gitPOAPs: GitPOAPs): YearlyGitPOAPsMap {
  const yearlyGitPOAPsMap: YearlyGitPOAPsMap = {};

  for (const gitPOAP of gitPOAPs) {
    const yearString = gitPOAP.year.toString();

    if (!(yearString in yearlyGitPOAPsMap)) {
      yearlyGitPOAPsMap[yearString] = [];
    }

    yearlyGitPOAPsMap[yearString].push(gitPOAP);
  }

  return yearlyGitPOAPsMap;
}

export async function createNewClaimsForRepoContribution(
  user: { id: number },
  repos: { id: number }[],
  yearlyGitPOAPsMap: YearlyGitPOAPsMap,
  contribution: RestrictedContribution,
): Promise<Claim[]> {
  const logger = createScopedLogger('createNewClaimsForRepoContribution');

  if ('pullRequest' in contribution) {
    logger.info(
      `Handling creating new claims for PR ID ${contribution.pullRequest.id} for User ID ${user.id}`,
    );
  } else {
    // 'mention' in contribution
    logger.info(
      `Handling creating new claims for Mention ID ${contribution.mention.id} for User ID ${user.id}`,
    );
  }

  const years = Object.keys(yearlyGitPOAPsMap);

  logger.debug(`Found ${years.length} years with GitPOAPs`);

  const claims = [];
  for (const year of years) {
    const gitPOAPs = yearlyGitPOAPsMap[year];

    const contributionCount = await countContributionsForClaim(user, repos, gitPOAPs[0]);

    logger.debug(`User ID ${user.id} has ${contributionCount} Contributions in year ${year}`);

    // Skip if there are no PRs for this year
    if (contributionCount === 0) {
      continue;
    }

    for (const gitPOAP of gitPOAPs) {
      // Skip this GitPOAP if the threshold wasn't reached
      if (contributionCount < gitPOAP.threshold) {
        logger.info(
          `User ID ${user.id} misses threshold of ${gitPOAP.threshold} for GitPOAP ID ${gitPOAP.id}`,
        );
        continue;
      }

      logger.info(`Upserting claim for User ID ${user.id} for GitPOAP ID ${gitPOAP.id}`);

      claims.push(await upsertClaim(user, gitPOAP, contribution));
    }
  }

  return claims;
}

export async function createNewClaimsForRepoContributionHelper(
  user: { id: number },
  repo: RepoData,
  contribution: RestrictedContribution,
): Promise<Claim[]> {
  return await createNewClaimsForRepoContribution(
    user,
    repo.project.repos,
    createYearlyGitPOAPsMap(repo.project.gitPOAPs),
    contribution,
  );
}

export async function retrieveClaimsCreatedByPR(pullRequestId: number): Promise<ClaimData[]> {
  // Retrieve any new claims created by this PR
  // No need to filter out DEPRECATED since the claims aren't created for DEPRECATED GitPOAPs
  const claims: ClaimData[] = await context.prisma.claim.findMany({
    where: {
      pullRequestEarnedId: pullRequestId,
      gitPOAP: {
        isEnabled: true,
      },
    },
    select: {
      id: true,
      user: {
        select: {
          githubHandle: true,
        },
      },
      gitPOAP: {
        select: {
          id: true,
          name: true,
          imageUrl: true,
          description: true,
          threshold: true,
        },
      },
    },
  });

  return claims;
}

export async function retrieveClaimsCreatedByMention(mentionId: number): Promise<ClaimData[]> {
  // Retrieve any new claims created by this Mention
  // No need to filter out DEPRECATED since the claims aren't created for DEPRECATED GitPOAPs
  const claims: ClaimData[] = await context.prisma.claim.findMany({
    where: {
      mentionEarnedId: mentionId,
      gitPOAP: {
        isEnabled: true,
      },
    },
    select: {
      id: true,
      user: {
        select: {
          githubHandle: true,
        },
      },
      gitPOAP: {
        select: {
          id: true,
          name: true,
          imageUrl: true,
          description: true,
          threshold: true,
        },
      },
    },
  });

  return claims;
}

type EarnedAtClaimData = {
  id: number;
  pullRequestEarned: {
    githubMergedAt: Date | null;
  } | null;
  mentionEarned: {
    pullRequest: {
      githubCreatedAt: Date;
    } | null;
    issue: {
      githubCreatedAt: Date;
    } | null;
    githubMentionedAt: Date;
  } | null;
  createdAt: Date;
};

export function getEarnedAt(claim: EarnedAtClaimData): Date {
  const logger = createScopedLogger('getEarnedAt');

  if (claim.pullRequestEarned !== null) {
    if (claim.pullRequestEarned.githubMergedAt === null) {
      logger.error(
        `Claim ID ${claim.id} was not earned by mention and has pullRequestEarned set with null githubMergedAt`,
      );
    } else {
      return claim.pullRequestEarned.githubMergedAt;
    }
  } else if (claim.mentionEarned !== null) {
    if (claim.mentionEarned.pullRequest !== null) {
      return claim.mentionEarned.pullRequest.githubCreatedAt;
    } else if (claim.mentionEarned.issue !== null) {
      return claim.mentionEarned.issue.githubCreatedAt;
    }

    logger.error(
      `Claim ID ${claim.id} was earned by mention but bot pullRequest and issue on the mention are null`,
    );

    // Default to metionedAt
    return claim.mentionEarned.githubMentionedAt;
  }

  // Default to createdAt (e.g. for hackathon GitPOAPs)
  return claim.createdAt;
}
