import { GithubPullRequest } from '@prisma/client';
import { DateTime } from 'luxon';
import { retrievePOAPInfo } from '../../external/poap';
import { createScopedLogger } from '../../logging';
import { GitPOAPResultType } from './types';

type Claim = {
  poapTokenId: string | null;
  gitPOAP: {
    id: number;
    poapEventId: number;
    project: {
      repos: {
        name: string;
        organization: {
          name: string;
        };
      }[];
    };
    year: number;
  };
  pullRequestEarned: GithubPullRequest | null;
  id: number;
  createdAt: Date;
  mintedAt: Date | null;
};

export const mapsClaimsToGitPOAPResults = async (
  claims: Claim[],
): Promise<GitPOAPResultType[] | null> => {
  const logger = createScopedLogger('mapsClaimsToGitPOAPResults');
  logger.info(`Getting POAP data for ${claims.length} claims`);

  const results: GitPOAPResultType[] = [];

  for (const claim of claims) {
    const poapData = await retrievePOAPInfo(<string>claim.poapTokenId);

    if (poapData === null) {
      const msg = `Failed to query POAP ID "${claim.gitPOAP.poapEventId}" data from POAP API`;
      logger.error(msg);

      return null;
    }

    const repositories = claim.gitPOAP.project.repos.map(repo => {
      return `${repo.organization.name}/${repo.name}`;
    });

    // Default to created at time of the Claim (e.g. for hackathons)
    const earnedAt = claim.pullRequestEarned
      ? claim.pullRequestEarned.githubMergedAt
      : claim.createdAt;

    results.push({
      gitPoapId: claim.id,
      gitPoapEventId: claim.gitPOAP.id,
      poapTokenId: <string>claim.poapTokenId,
      poapEventId: claim.gitPOAP.poapEventId,
      name: poapData.event.name,
      year: claim.gitPOAP.year,
      description: poapData.event.description,
      imageUrl: poapData.event.image_url,
      repositories,
      earnedAt: DateTime.fromJSDate(earnedAt).toFormat('yyyy-MM-dd'),
      mintedAt: DateTime.fromJSDate(<Date>claim.mintedAt).toFormat('yyyy-MM-dd'),
    });
  }

  return results;
};