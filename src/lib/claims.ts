import { Claim, ClaimStatus, GitPOAPStatus } from '@prisma/client';
import { utils } from 'ethers';
import { context } from '../context';
import { createScopedLogger } from '../logging';
import { RestrictedContribution, countContributionsForClaim } from './contributions';
import { getGithubUserAsAdmin } from '../external/github';
import { resolveENS, upsertENSNameInDB } from './ens';
import { upsertGithubUser } from './githubUsers';
import { upsertAddress } from './addresses';
import { MINIMUM_REMAINING_REDEEM_CODES, REDEEM_CODE_STEP_SIZE } from '../constants';
import { requestPOAPCodes } from '../external/poap';
import { upsertEmail } from './emails';
import { sleep } from '../lib/sleep';
import { retrieveClaimInfo } from '../external/poap';

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

export async function upsertClaim(
  githubUser: { id: number },
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
      gitPOAPId_githubUserId: {
        gitPOAPId: gitPOAP.id,
        githubUserId: githubUser.id,
      },
    },
    update: {},
    create: {
      gitPOAP: {
        connect: {
          id: gitPOAP.id,
        },
      },
      githubUser: {
        connect: {
          id: githubUser.id,
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
  mintedAddressId: number | null,
): Promise<Claim> {
  let mintedAddress = undefined;
  if (mintedAddressId !== null) {
    mintedAddress = {
      connect: {
        id: mintedAddressId,
      },
    };
  }

  return await context.prisma.claim.update({
    where: {
      id: claimId,
    },
    data: {
      status,
      mintedAddress,
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
  githubUser: { id: number },
  repos: { id: number }[],
  yearlyGitPOAPsMap: YearlyGitPOAPsMap,
  contribution: RestrictedContribution,
): Promise<Claim[]> {
  const logger = createScopedLogger('createNewClaimsForRepoContribution');

  if ('pullRequest' in contribution) {
    logger.info(
      `Handling creating new claims for PR ID ${contribution.pullRequest.id} for User ID ${githubUser.id}`,
    );
  } else {
    // 'mention' in contribution
    logger.info(
      `Handling creating new claims for Mention ID ${contribution.mention.id} for User ID ${githubUser.id}`,
    );
  }

  const years = Object.keys(yearlyGitPOAPsMap);

  logger.debug(`Found ${years.length} years with GitPOAPs`);

  const claims = [];
  for (const year of years) {
    const gitPOAPs = yearlyGitPOAPsMap[year];

    const contributionCount = await countContributionsForClaim(githubUser, repos, gitPOAPs[0]);

    logger.debug(
      `GithubUser ID ${githubUser.id} has ${contributionCount} Contributions in year ${year}`,
    );

    // Skip if there are no PRs for this year
    if (contributionCount === 0) {
      continue;
    }

    for (const gitPOAP of gitPOAPs) {
      // Skip this GitPOAP if the threshold wasn't reached
      if (contributionCount < gitPOAP.threshold) {
        logger.info(
          `GithubUser ID ${githubUser.id} misses threshold of ${gitPOAP.threshold} for GitPOAP ID ${gitPOAP.id}`,
        );
        continue;
      }

      logger.info(
        `Upserting claim for GithubUser ID ${githubUser.id} for GitPOAP ID ${gitPOAP.id}`,
      );

      claims.push(await upsertClaim(githubUser, gitPOAP, contribution));
    }
  }

  return claims;
}

export async function createNewClaimsForRepoContributionHelper(
  githubUser: { id: number },
  repo: RepoData,
  contribution: RestrictedContribution,
): Promise<Claim[]> {
  return await createNewClaimsForRepoContribution(
    githubUser,
    repo.project.repos,
    createYearlyGitPOAPsMap(repo.project.gitPOAPs),
    contribution,
  );
}

export async function retrieveClaimsCreatedByPR(pullRequestId: number) {
  const logger = createScopedLogger('retrieveClaimsCreatedByPR');

  const pullRequestData = await context.prisma.githubPullRequest.findUnique({
    where: {
      id: pullRequestId,
    },
    select: {
      githubMergedAt: true,
      repo: {
        select: {
          projectId: true,
        },
      },
      githubUserId: true,
    },
  });

  if (pullRequestData === null) {
    logger.error(`Failed to lookup GitHubPullRequest with ID ${pullRequestId}`);
    return [];
  }
  if (pullRequestData.githubMergedAt === null) {
    logger.error(`GithubPullRequest ID ${pullRequestId} is not merged yet!`);
    return [];
  }

  // Retrieve any new claims created by this PR.
  // Also return any claims that are UNCLAIMED but are in the same Project
  // as this GithubPullRequest's Repo
  //
  // No need to filter out DEPRECATED since the claims aren't created
  // for DEPRECATED GitPOAPs
  const claims = await context.prisma.claim.findMany({
    where: {
      OR: [
        {
          pullRequestEarnedId: pullRequestId,
        },
        {
          gitPOAP: {
            projectId: pullRequestData.repo.projectId,
            year: pullRequestData.githubMergedAt.getFullYear(),
          },
          githubUserId: pullRequestData.githubUserId,
          status: ClaimStatus.UNCLAIMED,
        },
      ],
      gitPOAP: {
        isEnabled: true,
      },
    },
    select: {
      id: true,
      githubUser: {
        select: {
          githubId: true,
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

export async function retrieveClaimsCreatedByMention(mentionId: number) {
  const logger = createScopedLogger('retrieveClaimsCreatedByMention');

  const mentionData = await context.prisma.githubMention.findUnique({
    where: {
      id: mentionId,
    },
    select: {
      githubUserId: true,
      repo: {
        select: {
          projectId: true,
        },
      },
      pullRequest: {
        select: {
          githubCreatedAt: true,
        },
      },
      issue: {
        select: {
          githubCreatedAt: true,
        },
      },
    },
  });

  if (mentionData === null) {
    logger.error(`Failed to lookup GitHubMention with ID ${mentionId}`);
    return [];
  }

  let year: number;
  if (mentionData.pullRequest !== null) {
    year = mentionData.pullRequest.githubCreatedAt.getFullYear();
  } else if (mentionData.issue !== null) {
    year = mentionData.issue.githubCreatedAt.getFullYear();
  } else {
    logger.error(`GithubMention ID ${mentionId} does not have a linked PR or Issue`);
    return [];
  }

  // Retrieve any new claims created by this Mention.
  // Also return any claims that are UNCLAIMED but are in
  // the same project as this mention's Repo.
  //
  // No need to filter out DEPRECATED since the claims aren't
  // created for DEPRECATED GitPOAPs
  const claims = await context.prisma.claim.findMany({
    where: {
      OR: [
        {
          mentionEarnedId: mentionId,
        },
        {
          gitPOAP: {
            projectId: mentionData.repo.projectId,
            year,
          },
          githubUserId: mentionData.githubUserId,
          status: ClaimStatus.UNCLAIMED,
        },
      ],
      gitPOAP: {
        isEnabled: true,
      },
    },
    select: {
      id: true,
      githubUser: {
        select: {
          githubId: true,
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

    // Default to mentionedAt
    return claim.mentionEarned.githubMentionedAt;
  }

  // Default to createdAt (e.g. for hackathon GitPOAPs)
  return claim.createdAt;
}

export const createClaimForGithubHandle = async (githubHandle: string, gitPOAPId: number) => {
  const logger = createScopedLogger('createClaimForGithubHandle');

  /* Use octokit to get a githubHandles githubId */
  const githubInfo = await getGithubUserAsAdmin(githubHandle);

  if (githubInfo === null) {
    logger.error(`Failed to lookup GitHub user ${githubHandle}`);
    return null;
  }

  const githubUser = await upsertGithubUser(githubInfo.id, githubHandle);

  const gitPOAP = await context.prisma.gitPOAP.findUnique({
    where: { id: gitPOAPId },
    select: { id: true },
  });

  if (gitPOAP === null) {
    logger.error(`Failed to lookup GitPOAP with ID ${gitPOAPId}`);
    return null;
  }

  return await context.prisma.claim.upsert({
    where: {
      gitPOAPId_githubUserId: {
        gitPOAPId,
        githubUserId: githubUser.id,
      },
    },
    update: {},
    create: {
      githubUserId: githubUser.id,
      gitPOAPId,
      status: ClaimStatus.UNCLAIMED,
    },
  });
};

export const createClaimForEmail = async (emailAddress: string, gitPOAPId: number) => {
  const logger = createScopedLogger('createClaimForEmail');

  const email = await upsertEmail(emailAddress);

  if (email === null) {
    logger.error(`Failed to a claim for GitPOAP ID ${gitPOAPId} for email "${emailAddress}"`);
    return;
  }

  const gitPOAP = await context.prisma.gitPOAP.findUnique({
    where: { id: gitPOAPId },
    select: { id: true },
  });

  if (gitPOAP === null) {
    logger.error(`Failed to lookup GitPOAP with ID ${gitPOAPId}`);
    return null;
  }

  return await context.prisma.claim.upsert({
    where: {
      gitPOAPId_emailId: {
        gitPOAPId,
        emailId: email.id,
      },
    },
    update: {},
    create: {
      emailId: email.id,
      gitPOAPId,
      status: ClaimStatus.UNCLAIMED,
    },
  });
};

export async function createClaimForEthAddress(ethAddress: string, gitPOAPId: number) {
  const logger = createScopedLogger('createClaimForEthAddress');

  if (!utils.isAddress(ethAddress)) {
    logger.error(`Invalid Ethereum address ${ethAddress}`);
    return null;
  }

  const address = await upsertAddress(ethAddress);

  if (address === null) {
    logger.error(`Failed to upsert address: ${ethAddress}`);
    return null;
  }

  const gitPOAP = await context.prisma.gitPOAP.findUnique({
    where: { id: gitPOAPId },
  });

  if (gitPOAP === null) {
    logger.error(`Failed to lookup GitPOAP with ID ${gitPOAPId}`);
    return null;
  }

  return await context.prisma.claim.upsert({
    where: {
      gitPOAPId_issuedAddressId: {
        gitPOAPId,
        issuedAddressId: address.id,
      },
    },
    update: {},
    create: {
      issuedAddressId: address.id,
      gitPOAPId,
      status: ClaimStatus.UNCLAIMED,
    },
  });
}

export const createClaimForEnsName = async (ensName: string, gitPOAPId: number) => {
  const logger = createScopedLogger('createClaimForEnsName');

  if (!ensName.endsWith('.eth')) {
    logger.error(`Invalid ENS name ${ensName}`);
    return null;
  }

  const ethAddress = await resolveENS(ensName, { synchronous: true });

  if (ethAddress === null) {
    logger.error(`Failed to resolve ENS name ${ensName}`);
    return null;
  }

  const address = await upsertENSNameInDB(ethAddress, ensName);

  if (address === null) {
    logger.error(`Failed to upsert ENS name ${ensName} in DB`);
    return null;
  }

  const gitPOAP = await context.prisma.gitPOAP.findUnique({
    where: { id: gitPOAPId },
  });

  if (gitPOAP === null) {
    logger.error(`Failed to lookup GitPOAP with ID ${gitPOAPId}`);
    return null;
  }

  return await context.prisma.claim.upsert({
    where: {
      gitPOAPId_issuedAddressId: {
        gitPOAPId,
        issuedAddressId: address.id,
      },
    },
    update: {},
    create: {
      issuedAddressId: address.id,
      gitPOAPId,
      status: ClaimStatus.UNCLAIMED,
    },
  });
};

type MinimalGitPOAPForRedeemCheck = {
  id: number;
  isOngoing: boolean;
  poapApprovalStatus: GitPOAPStatus;
  poapEventId: number;
  poapSecret: string;
};

// Ensure that we still have enough codes left for a GitPOAP after a claim
export async function ensureRedeemCodeThreshold(gitPOAP: MinimalGitPOAPForRedeemCheck) {
  // If the distribution is not ongoing then we don't need to do anything
  if (!gitPOAP.isOngoing || gitPOAP.poapApprovalStatus === GitPOAPStatus.DEPRECATED) {
    return;
  }

  const logger = createScopedLogger('ensureRedeemCodeThreshold');

  if (gitPOAP.poapApprovalStatus === GitPOAPStatus.REDEEM_REQUEST_PENDING) {
    logger.info(`Redeem request is already pending for GitPOAP ID: ${gitPOAP.id}`);

    return;
  }

  const codeCount = await context.prisma.redeemCode.count({
    where: {
      gitPOAPId: gitPOAP.id,
    },
  });

  logger.debug(`GitPOAP ID ${gitPOAP.id} has ${codeCount} remaining redeem codes`);

  if (codeCount < MINIMUM_REMAINING_REDEEM_CODES) {
    await context.prisma.gitPOAP.update({
      where: {
        id: gitPOAP.id,
      },
      data: {
        poapApprovalStatus: GitPOAPStatus.REDEEM_REQUEST_PENDING,
      },
    });

    logger.info(`Requesting additional codes for GitPOAP ID: ${gitPOAP.id}`);

    // Note that this function does not return any codes.
    // Instead we need to wait for them with our background process for checking
    // for new codes, so while waiting we have marked the GitPOAP's status
    // as REDEEM_REQUEST_PENDING
    const poapResponse = await requestPOAPCodes(
      gitPOAP.poapEventId,
      gitPOAP.poapSecret,
      REDEEM_CODE_STEP_SIZE,
    );
    if (poapResponse === null) {
      // In this case, the request to POAP has failed for some reason, so we
      // move the GitPOAP's state back into ACCEPTED so that it will attempt
      // to make another request after the next claim (it will see we are
      // below the threshold again
      await context.prisma.gitPOAP.update({
        where: {
          id: gitPOAP.id,
        },
        data: {
          poapApprovalStatus: GitPOAPStatus.REDEEM_REQUEST_PENDING,
        },
      });

      const msg = `Failed to request additional redeem codes for GitPOAP ID: ${gitPOAP.id}`;
      logger.error(msg);
      return;
    }
  }
}

export async function runClaimsPostProcessing(claimIds: number[], qrHashes: string[]) {
  const logger = createScopedLogger('runClaimsPostProcessing');

  while (claimIds.length > 0) {
    logger.info(`Waiting for ${claimIds.length} claim transactions to process`);

    // Wait for 5 seconds
    await sleep(5);

    // Helper function to remove a claim from postprocessing
    const removeAtIndex = (i: number) => {
      claimIds.splice(i, 1);
      qrHashes.splice(i, 1);
    };

    for (let i = 0; i < claimIds.length; ++i) {
      const poapData = await retrieveClaimInfo(qrHashes[i]);
      if (poapData === null) {
        logger.error(`Failed to retrieve claim info for Claim ID: ${claimIds[i]}`);
        removeAtIndex(i);
        break;
      }

      if (poapData.tx_status === 'passed') {
        if (!('token' in poapData.result)) {
          logger.error("No 'token' field in POAP response for Claim after tx_status='passed'");
          removeAtIndex(i);
          break;
        }

        // Set the new poapTokenId now that the TX is finalized
        await context.prisma.claim.update({
          where: {
            id: claimIds[i],
          },
          data: {
            status: ClaimStatus.CLAIMED,
            poapTokenId: poapData.result.token.toString(),
            mintedAt: new Date(),
          },
        });

        removeAtIndex(i);
      }
    }
  }

  logger.info('Finished claims post processing');
}
