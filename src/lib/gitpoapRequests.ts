import { context } from '../context';
import { AdminApprovalStatus } from '@prisma/client';
import { convertContributorsFromSchema, countContributors } from './gitpoaps';
import {
  CUSTOM_GITPOAP_CODE_BUFFER,
  CUSTOM_GITPOAP_MINIMUM_CODES,
  CUSTOM_GITPOAP_MAX_STARTING_CODES,
} from '../constants';
import { GitPOAPContributorsSchema } from '../schemas/gitpoaps';
import { z } from 'zod';

export async function deleteGitPOAPRequest(id: number) {
  await context.prisma.gitPOAPRequest.delete({
    where: { id },
  });
}

export async function updateGitPOAPRequestStatus(
  gitPOAPRequestId: number,
  adminApprovalStatus: AdminApprovalStatus,
) {
  return await context.prisma.gitPOAPRequest.update({
    where: { id: gitPOAPRequestId },
    data: { adminApprovalStatus },
  });
}

// We will do our best to choose the number of codes that the requestor
// requires plus a reasonable buffer, but we will constrain the number
// to be less than CUSTOM_GITPOAP_MAX_STARTING_CODES and greater than
// CUSTOM_GITPOAP_MINIMUM_CODES
export function chooseNumberOfRequestedCodes(
  contributors: z.infer<typeof GitPOAPContributorsSchema>,
): number {
  const explicitContributors = convertContributorsFromSchema(contributors);

  const requiredCodes = Math.max(
    CUSTOM_GITPOAP_MINIMUM_CODES,
    CUSTOM_GITPOAP_CODE_BUFFER + countContributors(explicitContributors),
  );

  return Math.min(CUSTOM_GITPOAP_MAX_STARTING_CODES, requiredCodes);
}
