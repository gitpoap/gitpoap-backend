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
import { s3configProfile, uploadMulterFile } from '../external/s3';
import path from 'path';
import { createScopedLogger } from '../logging';
import { DateTime } from 'luxon';

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

export async function uploadGitPOAPRequestImage(
  image: Express.Multer.File,
): Promise<string | null> {
  const logger = createScopedLogger('uploadGitPOAPRequestImage');

  logger.info(`Uploading image "${image.originalname}" to S3`);

  try {
    const extension = path.extname(image.originalname);
    const originalName = path.basename(image.originalname, extension);
    const imageKey = `${originalName}-${DateTime.now().toSeconds()}${extension}`;
    await uploadMulterFile(image, s3configProfile.buckets.gitPOAPRequestImages, imageKey);
    logger.info(
      `Uploaded image with imageKey: ${imageKey} to S3 bucket ${s3configProfile.buckets.gitPOAPRequestImages}`,
    );
    return imageKey;
  } catch (err) {
    logger.error(`Received error when uploading image to S3: ${err}`);
    return null;
  }
}
