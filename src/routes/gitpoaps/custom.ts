import {
  CreateCustomGitPOAPSchema,
  UpdateCustomGitPOAPSchema,
} from '../../schemas/gitpoaps/custom';
import { Request, Router } from 'express';
import { z } from 'zod';
import { context } from '../../context';
import { createPOAPEvent } from '../../external/poap';
import { jwtWithAdminAddress, jwtWithAddress } from '../../middleware/auth';
import multer from 'multer';
import { generatePOAPSecret } from '../../lib/secrets';
import { DateTime } from 'luxon';
import { AdminApprovalStatus, Prisma } from '@prisma/client';
import {
  getImageBufferFromS3URL,
  getKeyFromS3URL,
  getS3URL,
  s3configProfile,
} from '../../external/s3';
import { convertGitPOAPRequestToGitPOAP } from '../../lib/gitpoaps';
import { getAccessTokenPayload } from '../../types/authTokens';
import { sendInternalGitPOAPRequestMessage } from '../../external/slack';
import { convertContributorsFromSchema, createClaimsForContributors } from '../../lib/gitpoaps';
import {
  chooseNumberOfRequestedCodes,
  updateGitPOAPRequestStatus,
  uploadGitPOAPRequestImage,
  validateContributorsString,
} from '../../lib/gitpoapRequests';
import { getRequestLogger } from '../../middleware/loggingAndTiming';
import { GITPOAP_ISSUER_EMAIL, GITPOAP_ROOT_URL } from '../../constants';
import { upsertEmail } from '../../lib/emails';
import {
  sendGitPOAPRequestConfirmationEmail,
  sendGitPOAPRequestRejectionEmail,
} from '../../external/postmark';
import { GitPOAPRequestEmailForm } from '../../types/gitpoaps';
import path from 'path';
import { formatDateToString } from './utils';

export const customGitPOAPsRouter = Router();

type CreateCustomGitPOAPReqBody = z.infer<typeof CreateCustomGitPOAPSchema>;

customGitPOAPsRouter.post(
  '/',
  jwtWithAddress(),
  multer().single('image'),
  async function (req: Request<any, any, CreateCustomGitPOAPReqBody>, res) {
    const logger = getRequestLogger(req);

    const schemaResult = CreateCustomGitPOAPSchema.safeParse(req.body);

    if (!schemaResult.success) {
      logger.warn(
        `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
      );
      return res.status(400).send({ issues: schemaResult.error.issues });
    }

    if (!req.file) {
      const msg = 'Missing/invalid "image" upload in request';
      logger.warn(msg);
      return res.status(400).send({ msg });
    }

    const contributors = validateContributorsString(schemaResult.data.contributors);
    if (contributors === null) {
      const msg = 'Invalid "contributors" JSON in request';
      logger.warn(msg);
      return res.status(400).send({ msg });
    }

    /* Validate the date fields */
    const startDate = DateTime.fromISO(schemaResult.data.startDate).toJSDate();
    const endDate = DateTime.fromISO(schemaResult.data.endDate).toJSDate();
    if (startDate.toString() === 'Invalid Date' || endDate.toString() === 'Invalid Date') {
      logger.error(`Invalid date in the Request`);
      return res.status(400).send({ msg: 'Invalid date in the Request' });
    }

    let project: { id: number } | null = null;
    let organization: { id: number; name: string } | null = null;

    /* If a GitPOAPRequest is tied to project */
    if (schemaResult.data.projectId) {
      const projectId = parseInt(schemaResult.data.projectId, 10);
      logger.info(
        `Request to create a new GitPOAPRequest "${schemaResult.data.name}" for project ${projectId}`,
      );

      project = await context.prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true },
      });

      if (project === null) {
        const msg = `Failed to find project with id: ${projectId}`;
        logger.warn(msg);
        return res.status(404).send({ msg });
      }
    }

    /* If GitPOAPRequest is tied to an organization */
    if (schemaResult.data.organizationId) {
      const organizationId = parseInt(schemaResult.data.organizationId, 10);
      logger.info(
        `Request to create a new GitPOAPRequest "${schemaResult.data.name}" for organization ${organizationId}`,
      );
      organization = await context.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, name: true },
      });

      if (organization === null) {
        const msg = `Failed to find organization with id: ${organizationId}`;
        logger.warn(msg);
        return res.status(404).send({ msg });
      }
    }

    const imageKey = await uploadGitPOAPRequestImage(req.file);
    if (imageKey === null) {
      logger.error('Failed to upload GitPOAPRequest image to s3');
      return res.status(500).send({ msg: 'Failed to upload image' });
    }

    const email = await upsertEmail(schemaResult.data.creatorEmail);

    const { addressId } = getAccessTokenPayload(req.user);

    const gitPOAPRequest = await context.prisma.gitPOAPRequest.create({
      data: {
        startDate,
        endDate,
        creatorEmail: {
          connect: { id: email.id },
        },
        name: schemaResult.data.name,
        numRequestedCodes: chooseNumberOfRequestedCodes(contributors),
        imageUrl: getS3URL(s3configProfile.buckets.gitPOAPRequestImages, imageKey),
        description: schemaResult.data.description,
        project: project ? { connect: { id: project?.id } } : undefined,
        organization: organization ? { connect: { id: organization?.id } } : undefined,
        adminApprovalStatus: AdminApprovalStatus.PENDING,
        contributors: contributors as Prisma.JsonObject,
        address: {
          connect: { id: addressId },
        },
      },
    });

    /* Send message to slack */
    void sendInternalGitPOAPRequestMessage(gitPOAPRequest);
    /* Send CG request submission confirmation email */
    const emailForm: GitPOAPRequestEmailForm = {
      id: gitPOAPRequest.id,
      email: schemaResult.data.creatorEmail,
      name: gitPOAPRequest.name,
      imageUrl: gitPOAPRequest.imageUrl,
      description: gitPOAPRequest.description,
      startDate: formatDateToString(gitPOAPRequest.startDate),
      endDate: formatDateToString(gitPOAPRequest.endDate),
    };
    void sendGitPOAPRequestConfirmationEmail(emailForm);

    logger.info(
      `Completed request to create a new GitPOAP Request with ID: ${gitPOAPRequest.id} "${schemaResult.data.name}" for project ${project?.id} and organization ${organization?.id}`,
    );

    return res.status(201).send('CREATED');
  },
);

customGitPOAPsRouter.put('/approve/:id', jwtWithAdminAddress(), async (req, res) => {
  const logger = getRequestLogger(req);

  const gitPOAPRequestId = parseInt(req.params.id, 10);

  logger.info(`Admin request to create GitPOAP from GitPOAPRequest ID ${gitPOAPRequestId}`);

  const gitPOAPRequest = await context.prisma.gitPOAPRequest.findUnique({
    where: { id: gitPOAPRequestId },
  });

  if (gitPOAPRequest === null) {
    const msg = `Failed to find GitPOAP Request with ID:${gitPOAPRequestId}`;
    logger.warn(msg);
    return res.status(404).send({ msg });
  }

  const isApproved = gitPOAPRequest.adminApprovalStatus === AdminApprovalStatus.APPROVED;

  if (isApproved) {
    const msg = `GitPOAP Request with ID:${gitPOAPRequestId} is already approved.`;
    logger.warn(msg);
    return res.status(200).send({ msg });
  }

  /* Update the GitPOAPRequest to APPROVED */
  const updatedGitPOAPRequest = await updateGitPOAPRequestStatus(
    gitPOAPRequestId,
    AdminApprovalStatus.APPROVED,
  );

  logger.info(`Marking GitPOAP Request with ID:${gitPOAPRequestId} as APPROVED.`);

  const imageBuffer = await getImageBufferFromS3URL(gitPOAPRequest.imageUrl);

  // TODO: switch to using the actual dates from GitPOAPRequest after POAP fixes
  // their date issues
  const startDate = DateTime.now();
  const endDate = startDate.plus({ years: 1 });

  const secretCode = generatePOAPSecret();
  const poapInfo = await createPOAPEvent({
    name: gitPOAPRequest.name,
    description: gitPOAPRequest.description,
    start_date: startDate.toFormat('yyyy-MM-dd'),
    end_date: endDate.toFormat('yyyy-MM-dd'),
    expiry_date: endDate.plus({ years: 1 }).toFormat('yyyy-MM-dd'),
    event_url: GITPOAP_ROOT_URL,
    imageName: getKeyFromS3URL(gitPOAPRequest.imageUrl),
    imageBuffer,
    secret_code: secretCode,
    email: GITPOAP_ISSUER_EMAIL,
    num_requested_codes: gitPOAPRequest.numRequestedCodes,
  });

  if (poapInfo === null) {
    logger.error('Failed to create event via POAP API');
    // Set back to pending so we can possibly re-approve
    await updateGitPOAPRequestStatus(gitPOAPRequestId, AdminApprovalStatus.PENDING);
    return res.status(500).send({ msg: 'Failed to create POAP via API' });
  }

  logger.info(`Created GitPOAP in POAP system: ${JSON.stringify(poapInfo)}`);

  /* Create the GitPOAP from the GitPOAPRequest */
  const gitPOAP = await convertGitPOAPRequestToGitPOAP(gitPOAPRequest, poapInfo, secretCode);

  logger.info(`Created GitPOAP ID ${gitPOAP.id} from GitPOAPRequest ID: ${gitPOAPRequestId}`);

  /* Create the associated Claims */
  let claimsCount = 0;
  if (updatedGitPOAPRequest.contributors) {
    const contributors = convertContributorsFromSchema(
      updatedGitPOAPRequest.contributors as Prisma.JsonObject,
    );
    claimsCount = createClaimsForContributors(gitPOAP.id, contributors);
  }
  logger.info(`Created ${claimsCount} Claims for GitPOAP Request with ID: ${gitPOAPRequestId}`);

  /* TODO: reenable after POAP fixes their issues with dates
  // Delete the GitPOAPRequest
  await deleteGitPOAPRequest(gitPOAPRequest.id);
  */

  logger.debug(
    `Completed admin request to create GitPOAP from GitPOAPRequest ID ${gitPOAPRequestId}`,
  );

  return res.status(200).send('APPROVED');
});

customGitPOAPsRouter.put('/reject/:id', jwtWithAdminAddress(), async (req, res) => {
  const logger = getRequestLogger(req);

  const gitPOAPRequestId = parseInt(req.params.id, 10);

  logger.info(`Admin request to reject GitPOAP Request with ID: ${gitPOAPRequestId}`);

  const gitPOAPRequest = await context.prisma.gitPOAPRequest.findUnique({
    where: { id: gitPOAPRequestId },
  });

  if (gitPOAPRequest === null) {
    const msg = `Failed to find GitPOAP Request with ID:${gitPOAPRequestId}`;
    logger.warn(msg);
    return res.status(404).send({ msg });
  }

  if (gitPOAPRequest.adminApprovalStatus === AdminApprovalStatus.APPROVED) {
    const msg = `GitPOAP Request with ID:${gitPOAPRequestId} is already approved.`;
    logger.warn(msg);
    return res.status(400).send({ msg });
  }

  if (gitPOAPRequest.adminApprovalStatus === AdminApprovalStatus.REJECTED) {
    const msg = `GitPOAP Request with ID:${gitPOAPRequestId} is already rejected.`;
    logger.warn(msg);
    return res.status(200).send({ msg });
  }

  const updatedGitPOAPRequest = await context.prisma.gitPOAPRequest.update({
    where: { id: gitPOAPRequestId },
    data: {
      adminApprovalStatus: AdminApprovalStatus.REJECTED,
    },
    select: {
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
      creatorEmail: {
        select: {
          emailAddress: true,
        },
      },
    },
  });

  /* Send CG request rejection email */
  const emailForm: GitPOAPRequestEmailForm = {
    id: gitPOAPRequest.id,
    email: updatedGitPOAPRequest.creatorEmail.emailAddress,
    name: gitPOAPRequest.name,
    imageUrl: gitPOAPRequest.imageUrl,
    description: gitPOAPRequest.description,
    startDate: formatDateToString(gitPOAPRequest.startDate),
    endDate: formatDateToString(gitPOAPRequest.endDate),
  };
  void sendGitPOAPRequestRejectionEmail(emailForm);

  logger.info(
    `Completed admin request to reject Custom GitPOAP with Request ID:${gitPOAPRequest.id}`,
  );

  return res.status(200).send('REJECTED');
});

customGitPOAPsRouter.patch(
  '/:gitPOAPRequestId',
  jwtWithAddress(),
  multer().single('image'),
  async function (req, res) {
    const logger = getRequestLogger(req);

    const gitPOAPRequestId = parseInt(req.params.gitPOAPRequestId, 10);

    const schemaResult = UpdateCustomGitPOAPSchema.safeParse(req.body);

    if (!schemaResult.success) {
      logger.warn(
        `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
      );
      return res.status(400).send({ issues: schemaResult.error.issues });
    }

    logger.info(`Request to update GitPOAPRequest ID ${gitPOAPRequestId}`);

    const gitPOAPRequest = await context.prisma.gitPOAPRequest.findUnique({
      where: { id: gitPOAPRequestId },
      select: {
        addressId: true,
        adminApprovalStatus: true,
      },
    });

    if (gitPOAPRequest === null) {
      const msg = `GitPOAPRequest with ID ${gitPOAPRequestId} doesn't exist`;
      logger.warn(msg);
      return res.status(404).send({ msg });
    }

    const { addressId } = getAccessTokenPayload(req.user);

    if (gitPOAPRequest.addressId !== addressId) {
      logger.warn(
        `User attempted to update a GitPOAPRequest (ID: ${gitPOAPRequestId}) that they do not own`,
      );
      return res.status(401).send({ msg: 'Not GitPOAPRequest creator' });
    }

    // This could happen if the admin approval request is put in around the same time
    // that the creator is trying to add new contributors, i.e. that the conversion
    // from GitPOAPRequest to GitPOAP hasn't completed yet.
    if (gitPOAPRequest.adminApprovalStatus === AdminApprovalStatus.APPROVED) {
      const msg = `GitPOAPRequest with ID ${gitPOAPRequestId} is already APPROVED`;
      logger.warn(msg);
      return res.status(400).send({ msg });
    }

    let contributors;
    let numRequestedCodes;
    if (schemaResult.data.contributors !== undefined) {
      const contributorsResult = validateContributorsString(schemaResult.data.contributors);
      if (contributorsResult === null) {
        const msg = 'Invalid "contributors" JSON in request';
        logger.warn(msg);
        return res.status(400).send({ msg });
      }
      contributors = contributorsResult as Prisma.JsonObject;
      numRequestedCodes = chooseNumberOfRequestedCodes(contributorsResult);
    }

    const maybeParseDate = (date?: string) => (date ? new Date(date) : undefined);

    let imageUrl;
    if (req.file) {
      const imageKey = await uploadGitPOAPRequestImage(req.file);
      if (imageKey === null) {
        logger.error('Failed to upload GitPOAPRequest image to s3');
        return res.status(500).send({ msg: 'Failed to upload image' });
      }
      imageUrl = getS3URL(s3configProfile.buckets.gitPOAPRequestImages, imageKey);
    }

    // Parse the dates if they are present
    const data = {
      ...schemaResult.data,
      startDate: maybeParseDate(schemaResult.data.startDate),
      endDate: maybeParseDate(schemaResult.data.endDate),
      contributors,
      numRequestedCodes,
      adminApprovalStatus: AdminApprovalStatus.PENDING,
      imageUrl,
    };

    await context.prisma.gitPOAPRequest.update({
      where: { id: gitPOAPRequestId },
      data,
    });

    logger.debug(`Competed request to update GitPOAPRequest ID ${gitPOAPRequestId}`);

    return res.status(200).send('UPDATED');
  },
);
