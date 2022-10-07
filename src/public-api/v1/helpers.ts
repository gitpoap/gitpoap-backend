import { GitPOAPStatus } from '@prisma/client';
import { DateTime } from 'luxon';
import { retrievePOAPEventInfo } from '../../external/poap';
import { createScopedLogger } from '../../logging';
import { GitPOAPResultType, GitPOAPEventResultType } from './types';
import { getEarnedAt } from '../../lib/claims';

type Claim = {
  poapTokenId: string | null;
  gitPOAP: {
    id: number;
    poapApprovalStatus: GitPOAPStatus;
    poapEventId: number;
    project: {
      repos: {
        name: string;
        organization: {
          name: string;
        };
      }[];
    } | null;
  };
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
  id: number;
  createdAt: Date;
  mintedAt: Date | null;
  needsRevalidation: boolean;
};

type GitPOAP = {
  id: number;
  poapApprovalStatus: GitPOAPStatus;
  poapEventId: number;
  project: {
    repos: {
      name: string;
      organization: {
        name: string;
      };
    }[];
  } | null;
  claims: {
    id: number;
  }[];
};

export const mapClaimsToGitPOAPResults = async (
  claims: Claim[],
): Promise<GitPOAPResultType[] | null> => {
  const logger = createScopedLogger('mapClaimsToGitPOAPResults');
  logger.info(`Getting POAP data for ${claims.length} claims`);

  const results: GitPOAPResultType[] = [];

  for (const claim of claims) {
    const poapEventData = await retrievePOAPEventInfo(claim.gitPOAP.poapEventId);

    if (poapEventData === null) {
      const msg = `Failed to query POAP ID "${claim.gitPOAP.poapEventId}" data from POAP API`;
      logger.error(msg);

      return null;
    }

    const repositories = claim.gitPOAP.project?.repos.map(repo => {
      return `${repo.organization.name}/${repo.name}`;
    });

    results.push({
      gitPoapId: claim.id,
      gitPoapEventId: claim.gitPOAP.id,
      poapTokenId: <string>claim.poapTokenId,
      poapEventId: claim.gitPOAP.poapEventId,
      poapEventFancyId: poapEventData.fancy_id,
      name: poapEventData.name,
      year: poapEventData.year,
      description: poapEventData.description,
      imageUrl: poapEventData.image_url,
      repositories: repositories ?? [],
      earnedAt: DateTime.fromJSDate(getEarnedAt(claim)).toFormat('yyyy-MM-dd'),
      mintedAt: claim.mintedAt ? DateTime.fromJSDate(claim.mintedAt).toFormat('yyyy-MM-dd') : null,
      needsRevalidation: claim.needsRevalidation,
      isDeprecated: claim.gitPOAP.poapApprovalStatus === GitPOAPStatus.DEPRECATED,
    });
  }

  return results;
};

export async function mapGitPOAPsToGitPOAPResults(
  gitPOAPs: GitPOAP[],
): Promise<GitPOAPEventResultType[] | null> {
  const logger = createScopedLogger('mapGitPOAPsToGitPOAPResults');

  const results: GitPOAPEventResultType[] = [];

  for (const gitPOAP of gitPOAPs) {
    const poapEventData = await retrievePOAPEventInfo(gitPOAP.poapEventId);
    if (poapEventData === null) {
      logger.error(
        `Failed to retrieve POAP Event (ID: ${gitPOAP.poapEventId}) for GitPOAP ID ${gitPOAP.id}`,
      );
      return null;
    }

    results.push({
      gitPoapEventId: gitPOAP.id,
      poapEventId: gitPOAP.poapEventId,
      poapEventFancyId: poapEventData.fancy_id,
      name: poapEventData.name,
      year: poapEventData.year,
      description: poapEventData.description,
      imageUrl: poapEventData.image_url,
      repositories: gitPOAP.project?.repos.map(r => `${r.organization.name}/${r.name}`) ?? [],
      mintedCount: gitPOAP.claims.length,
      isDeprecated: gitPOAP.poapApprovalStatus === GitPOAPStatus.DEPRECATED,
    });
  }

  return results;
}
