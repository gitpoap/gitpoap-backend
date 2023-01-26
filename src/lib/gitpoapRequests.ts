import { context } from '../context';
import { StaffApprovalStatus } from '@prisma/client';
import { convertContributorsFromSchema, countContributors } from './gitpoaps';
import {
  CUSTOM_GITPOAP_CODE_BUFFER,
  CUSTOM_GITPOAP_MINIMUM_CODES,
  CUSTOM_GITPOAP_MAX_STARTING_CODES,
} from '../constants';
import { GitPOAPContributorsSchema } from '../schemas/gitpoaps';
import { z } from 'zod';
import { s3configProfile } from '../external/s3';
import { createScopedLogger } from '../logging';
import { DateTime } from 'luxon';
import { parseJSON } from './json';
import { safelyUploadImageBuffer } from './images';

export async function deleteGitPOAPRequest(id: number) {
  await context.prisma.gitPOAPRequest.delete({
    where: { id },
  });
}

export async function updateGitPOAPRequestStatus(
  gitPOAPRequestId: number,
  staffApprovalStatus: StaffApprovalStatus,
) {
  return await context.prisma.gitPOAPRequest.update({
    where: { id: gitPOAPRequestId },
    data: { staffApprovalStatus },
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

export async function uploadGitPOAPRequestImage(
  image: Express.Multer.File,
): Promise<string | null> {
  return await safelyUploadImageBuffer(
    s3configProfile.buckets.gitPOAPRequestImages,
    image.originalname,
    image.mimetype,
    image.buffer,
  );
}

export function dedupeContributors(contributors: z.infer<typeof GitPOAPContributorsSchema>) {
  const dedupedContributors: z.infer<typeof GitPOAPContributorsSchema> = {};

  if (contributors.githubHandles !== undefined) {
    const handles = new Set<string>(contributors.githubHandles);
    dedupedContributors.githubHandles = Array.from(handles);
  }
  if (contributors.ethAddresses !== undefined) {
    const addresses = new Set<string>();
    contributors.ethAddresses.forEach(a => addresses.add(a.toLowerCase()));
    dedupedContributors.ethAddresses = Array.from(addresses);
  }
  if (contributors.ensNames !== undefined) {
    const names = new Set<string>();
    contributors.ensNames.forEach(n => names.add(n.toLowerCase()));
    dedupedContributors.ensNames = Array.from(names);
  }
  if (contributors.emails !== undefined) {
    const emails = new Set<string>();
    contributors.emails.forEach(e => emails.add(e.toLowerCase()));
    dedupedContributors.emails = Array.from(emails);
  }

  return dedupedContributors;
}

export function validateContributorsString(contributorsString: string) {
  const logger = createScopedLogger('validateContributorsString');

  const contributors = parseJSON<z.infer<typeof GitPOAPContributorsSchema>>(contributorsString);

  if (contributors === null) {
    return null;
  }

  const contributorsSchemaResult = GitPOAPContributorsSchema.safeParse(contributors);

  if (!contributorsSchemaResult.success) {
    logger.warn(
      `Missing/invalid contributors fields in request: ${JSON.stringify(
        contributorsSchemaResult.error.issues,
      )}`,
    );
    return null;
  }

  return dedupeContributors(contributors);
}

export function chooseGitPOAPRequestDates() {
  // TODO: switch to using the actual dates from GitPOAPRequest
  // after POAP fixes their date issues
  const startDate = DateTime.utc();
  return {
    startDate,
    endDate: startDate.plus({ years: 1 }),
    expiryDate: startDate.plus({ years: 2 }),
  };
}
