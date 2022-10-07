import { GitPOAP, GitPOAPRequest, GitPOAPType } from '@prisma/client';
import { context } from '../context';
import { CreatePOAPEventReturnType } from '../external/poap';

export const convertGitPOAPRequestToGitPOAP = async (
  gitPOAPRequest: GitPOAPRequest,
  poapInfo: CreatePOAPEventReturnType,
  secretCode: string,
): Promise<GitPOAP> => {
  const gitPOAP = await context.prisma.gitPOAP.create({
    data: {
      type: GitPOAPType.CUSTOM,
      name: gitPOAPRequest.name,
      imageUrl: poapInfo.image_url,
      description: gitPOAPRequest.description,
      year: gitPOAPRequest.year,
      poapEventId: poapInfo.id,
      project: {
        connect: {
          id: gitPOAPRequest.projectId ?? undefined,
        },
      },
      organization: {
        connect: {
          id: gitPOAPRequest.organizationId ?? undefined,
        },
      },
      poapSecret: secretCode,
      ongoing: gitPOAPRequest.ongoing,
      isPRBased: gitPOAPRequest.isPRBased,
      isEnabled: gitPOAPRequest.isEnabled,
    },
  });

  return gitPOAP;
};
