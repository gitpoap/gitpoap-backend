import { GitPOAPRequest, GitPOAPType } from '@prisma/client';
import { context } from '../context';
import { CreatePOAPEventReturnType } from '../external/poap';
import {
  createClaimForEmail,
  createClaimForEnsName,
  createClaimForEthAddress,
  createClaimForGithubHandle,
} from './claims';
import { GitPOAPContributorsSchema } from '../schemas/gitpoaps';
import { GitPOAPContributors } from '../types/gitpoaps';
import { z } from 'zod';
import { DateTime } from 'luxon';

export const convertGitPOAPRequestToGitPOAP = async (
  gitPOAPRequest: GitPOAPRequest,
  poapInfo: CreatePOAPEventReturnType,
  secretCode: string,
) => {
  let project;
  if (gitPOAPRequest.projectId) {
    project = {
      connect: { id: gitPOAPRequest.projectId },
    };
  }
  let team;
  if (gitPOAPRequest.teamId) {
    team = {
      connect: { id: gitPOAPRequest.teamId },
    };
  }

  return await context.prisma.gitPOAP.create({
    data: {
      type: GitPOAPType.CUSTOM,
      name: gitPOAPRequest.name,
      imageUrl: poapInfo.image_url,
      description: gitPOAPRequest.description,
      year: gitPOAPRequest.startDate.getFullYear(),
      poapEventId: poapInfo.id,
      project,
      team,
      poapSecret: secretCode,
      canRequestMoreCodes: true,
      isEnabled: true,
      creatorAddress: {
        connect: { id: gitPOAPRequest.addressId },
      },
      creatorEmail: {
        connect: { id: gitPOAPRequest.creatorEmailId },
      },
      gitPOAPRequest: {
        connect: { id: gitPOAPRequest.id },
      },
    },
  });
};

export function convertContributorsFromSchema(
  contributors: z.infer<typeof GitPOAPContributorsSchema>,
): GitPOAPContributors {
  return {
    githubHandles: contributors.githubHandles ?? [],
    emails: contributors.emails ?? [],
    ethAddresses: contributors.ethAddresses ?? [],
    ensNames: contributors.ensNames ?? [],
  };
}

export function countContributors(contributors: GitPOAPContributors): number {
  return (
    contributors.githubHandles.length +
    contributors.emails.length +
    contributors.ethAddresses.length +
    contributors.ensNames.length
  );
}

export function createClaimsForContributors(
  gitPOAPId: number,
  contributors: GitPOAPContributors,
): number {
  for (const githubHandle of contributors.githubHandles) {
    void createClaimForGithubHandle(githubHandle, gitPOAPId);
  }

  for (const email of contributors.emails) {
    void createClaimForEmail(email, gitPOAPId);
  }

  for (const ethAddress of contributors.ethAddresses) {
    void createClaimForEthAddress(ethAddress, gitPOAPId);
  }

  for (const ensName of contributors.ensNames) {
    void createClaimForEnsName(ensName, gitPOAPId);
  }

  return countContributors(contributors);
}

export function chooseGitPOAPDates(year: number) {
  if (DateTime.utc().year === year) {
    return {
      startDate: DateTime.utc(year, 1, 1),
      endDate: DateTime.utc(year, 12, 31),
      expiryDate: DateTime.utc(year + 1, 12, 31),
    };
  } else {
    // TODO: switch to using the actual dates for year
    // after POAP fixes their date issues!
    //
    // In the meantime let's just use the dates that allow
    // for the expiry furthest into the future
    const startDate = DateTime.utc();
    return {
      startDate,
      endDate: startDate.plus({ years: 1 }),
      expiryDate: startDate.plus({ years: 2 }),
    };
  }
}
