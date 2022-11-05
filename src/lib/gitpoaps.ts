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

export const convertGitPOAPRequestToGitPOAP = async (
  gitPOAPRequest: GitPOAPRequest,
  poapInfo: CreatePOAPEventReturnType,
  secretCode: string,
) => {
  return await context.prisma.gitPOAP.create({
    data: {
      type: GitPOAPType.CUSTOM,
      name: gitPOAPRequest.name,
      imageUrl: poapInfo.image_url,
      description: gitPOAPRequest.description,
      year: gitPOAPRequest.year,
      poapEventId: poapInfo.id,
      projectId: gitPOAPRequest.projectId,
      organizationId: gitPOAPRequest.organizationId,
      poapSecret: secretCode,
      ongoing: gitPOAPRequest.ongoing,
      isPRBased: gitPOAPRequest.isPRBased,
      isEnabled: gitPOAPRequest.isEnabled,
      creatorAddressId: gitPOAPRequest.addressId,
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

  return (
    contributors['githubHandles'].length +
    contributors['emails'].length +
    contributors['ethAddresses'].length +
    contributors['ensNames'].length
  );
}
