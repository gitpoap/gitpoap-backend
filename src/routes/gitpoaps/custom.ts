import {
  CreateCustomGitPOAPSchema,
  DeleteGitPOAPRequestClaimSchema,
  UpdateCustomGitPOAPSchema,
} from '../../schemas/gitpoaps/custom';
import { CreateGitPOAPClaimsSchema, GitPOAPContributorsSchema } from '../../schemas/gitpoaps';
import { Request, Router } from 'express';
import { z } from 'zod';
import { context } from '../../context';
import { createPOAPEvent } from '../../external/poap';
import { jwtWithAdminAddress, jwtWithAddress } from '../../middleware/auth';
import multer from 'multer';
import { generatePOAPSecret } from '../../lib/secrets';
import { DateTime } from 'luxon';
import { AdminApprovalStatus, GitPOAPType, Prisma } from '@prisma/client';
import {
  getImageBufferFromS3URL,
  getKeyFromS3URL,
  getS3URL,
  s3configProfile,
  uploadMulterFile,
} from '../../external/s3';
import { convertGitPOAPRequestToGitPOAP } from '../../lib/gitpoaps';
import { parseJSON } from '../../lib/json';
import { getAccessTokenPayload } from '../../types/authTokens';
import { sentInternalGitPOAPRequestMessage } from '../../external/slack';
import { convertContributorsFromSchema, createClaimsForContributors } from '../../lib/gitpoaps';
import {
  addGitPOAPContributors,
  deleteGitPOAPRequest,
  removeContributorFromGitPOAP,
} from '../../lib/gitpoapRequests';
import { getRequestLogger } from '../../middleware/loggingAndTiming';
import { GITPOAP_ISSUER_EMAIL } from '../../constants';
import { upsertEmail } from '../../lib/emails';
import {
  sendGitPOAPRequestConfirmationEmail,
  sendGitPOAPRequestRejectionEmail,
} from '../../external/postmark';
import { GitPOAPRequestEmailForm } from '../../types/gitpoaps';

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

    /* Validate the contributors object */
    const contributors = parseJSON<z.infer<typeof GitPOAPContributorsSchema>>(
      schemaResult.data.contributors,
    );

    if (contributors === null) {
      const msg = 'Invalid "contributors" JSON in request';
      logger.warn(msg);
      return res.status(400).send({ msg });
    }

    const contributorsSchemaResult = GitPOAPContributorsSchema.safeParse(contributors);

    if (!contributorsSchemaResult.success) {
      logger.warn(
        `Missing/invalid contributors fields in request: ${JSON.stringify(
          contributorsSchemaResult.error.issues,
        )}`,
      );
      return res.status(400).send({ issues: contributorsSchemaResult.error.issues });
    }

    /* Validate the date fields */
    const year = DateTime.fromISO(schemaResult.data.startDate).year;
    const startDate = DateTime.fromISO(schemaResult.data.startDate).toJSDate();
    const endDate = DateTime.fromISO(schemaResult.data.endDate).toJSDate();
    const expiryDate = DateTime.fromISO(schemaResult.data.expiryDate).toJSDate();

    if (
      !year ||
      startDate.toString() === 'Invalid Date' ||
      endDate.toString() === 'Invalid Date' ||
      expiryDate.toString() === 'Invalid Date'
    ) {
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

    logger.info(`Uploading image to S3`);
    const image = req.file;
    let imageKey: string | null = null;
    const timestamp = DateTime.now().toSeconds();
    const bucket = s3configProfile.buckets.gitPOAPRequestImages;

    try {
      imageKey = `${image.originalname}-${timestamp}`;
      await uploadMulterFile(image, bucket, imageKey);
      logger.info(`Uploaded image with imageKey: ${imageKey} to S3 bucket ${bucket}`);
    } catch (err) {
      logger.error(`Received error when uploading image to S3 - ${err}`);
      return res.status(500).send({ msg: 'Failed to upload image to S3' });
    }

    const email = await upsertEmail(schemaResult.data.creatorEmail);

    const { addressId } = getAccessTokenPayload(req.user);
    const gitPOAPRequest = await context.prisma.gitPOAPRequest.create({
      data: {
        name: schemaResult.data.name,
        type: GitPOAPType.CUSTOM,
        imageUrl: getS3URL(bucket, imageKey),
        description: schemaResult.data.description,
        year,
        startDate,
        endDate,
        expiryDate,
        eventUrl: schemaResult.data.eventUrl,
        numRequestedCodes: parseInt(schemaResult.data.numRequestedCodes, 10),
        project: project ? { connect: { id: project?.id } } : undefined,
        organization: organization ? { connect: { id: organization?.id } } : undefined,
        ongoing: true,
        isEnabled: true,
        adminApprovalStatus: AdminApprovalStatus.PENDING,
        contributors: contributors as Prisma.JsonObject,
        isPRBased: false,
        address: {
          connect: { id: addressId },
        },
        creatorEmail: {
          connect: { id: email.id },
        },
      },
    });

    /* Send message to slack */
    void sentInternalGitPOAPRequestMessage(gitPOAPRequest);
    /* Send CG request submission confirmation email */
    const emailForm: GitPOAPRequestEmailForm = {
      id: gitPOAPRequest.id,
      email: gitPOAPRequest.creatorEmail,
      name: gitPOAPRequest.name,
      description: gitPOAPRequest.description,
      imageUrl: gitPOAPRequest.imageUrl,
      organizationId: organization?.id ?? null,
      organizationName: organization?.name ?? null,
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

  const isCustom = gitPOAPRequest.type === GitPOAPType.CUSTOM;
  const isApproved = gitPOAPRequest.adminApprovalStatus === AdminApprovalStatus.APPROVED;

  if (!isCustom) {
    const msg = `GitPOAP Request with ID:${gitPOAPRequestId} is not a custom GitPOAP Request`;
    logger.warn(msg);
    return res.status(400).send({ msg });
  }

  if (isApproved) {
    const msg = `GitPOAP Request with ID:${gitPOAPRequestId} is already approved.`;
    logger.warn(msg);
    return res.status(200).send({ msg });
  }

  /* Update the GitPOAPRequest to APPROVED */
  const updatedGitPOAPRequest = await context.prisma.gitPOAPRequest.update({
    where: { id: gitPOAPRequestId },
    data: {
      adminApprovalStatus: AdminApprovalStatus.APPROVED,
    },
  });

  logger.info(`Marking GitPOAP Request with ID:${gitPOAPRequestId} as APPROVED.`);

  const imageBuffer = await getImageBufferFromS3URL(gitPOAPRequest.imageUrl);

  const secretCode = generatePOAPSecret();
  const poapInfo = await createPOAPEvent({
    name: gitPOAPRequest.name,
    description: gitPOAPRequest.description,
    start_date: DateTime.fromJSDate(gitPOAPRequest.startDate).toFormat('yyyy-MM-dd'),
    end_date: DateTime.fromJSDate(gitPOAPRequest.endDate).toFormat('yyyy-MM-dd'),
    expiry_date: DateTime.fromJSDate(gitPOAPRequest.expiryDate).toFormat('yyyy-MM-dd'),
    event_url: gitPOAPRequest.eventUrl,
    imageName: getKeyFromS3URL(gitPOAPRequest.imageUrl),
    imageBuffer,
    secret_code: secretCode,
    email: GITPOAP_ISSUER_EMAIL,
    num_requested_codes: gitPOAPRequest.numRequestedCodes,
  });

  if (poapInfo == null) {
    logger.error('Failed to create event via POAP API');
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

  /* Delete the GitPOAPRequest */
  await deleteGitPOAPRequest(gitPOAPRequest.id);

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
    },
  });

  logger.info(`Completed admin request to reject GitPOAPRequest ID ${gitPOAPRequest.id}`);

  /* Send CG request rejection email */
  const emailForm: GitPOAPRequestEmailForm = {
    id: gitPOAPRequest.id,
    email: gitPOAPRequest.creatorEmail,
    name: gitPOAPRequest.name,
    description: gitPOAPRequest.description,
    imageUrl: gitPOAPRequest.imageUrl,
    organizationId: updatedGitPOAPRequest.organization?.id ?? null,
    organizationName: updatedGitPOAPRequest.organization?.name ?? null,
  };
  void sendGitPOAPRequestRejectionEmail(emailForm);

  logger.info(
    `Completed admin request to reject Custom GitPOAP with Request ID:${gitPOAPRequest.id}`,
  );

  return res.status(200).send('REJECTED');
});

customGitPOAPsRouter.put('/:gitPOAPRequestId/claims', jwtWithAddress(), async (req, res) => {
  const logger = getRequestLogger(req);

  const gitPOAPRequestId = parseInt(req.params.gitPOAPRequestId, 10);

  logger.info(`Request to create new Claims for custom GitPOAP Request ID ${gitPOAPRequestId}`);

  const schemaResult = CreateGitPOAPClaimsSchema.safeParse(req.body);

  if (!schemaResult.success) {
    logger.warn(
      `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
    );
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  const { contributors } = schemaResult.data;

  const gitPOAPRequest = await context.prisma.gitPOAPRequest.findUnique({
    where: { id: gitPOAPRequestId },
    select: {
      addressId: true,
      adminApprovalStatus: true,
      contributors: true,
    },
  });

  if (gitPOAPRequest === null) {
    logger.warn(
      `User tried to create claims for nonexistant GitPOAPRequest ID ${gitPOAPRequestId}`,
    );
    return res.status(404).send({ msg: "Request doesn't exist" });
  }

  const { addressId } = getAccessTokenPayload(req.user);

  if (gitPOAPRequest.addressId !== addressId) {
    logger.warn(
      `Someone other than its creator tried to add claims to GitPOAPRequest ID ${gitPOAPRequestId}`,
    );
    return res.status(401).send({ msg: 'Not request owner' });
  }

  if (gitPOAPRequest.adminApprovalStatus === AdminApprovalStatus.APPROVED) {
    logger.warn(
      `Creator of GitPOAPRequest ID ${gitPOAPRequestId} tried to create new claims after approval`,
    );
    return res.status(400).send({ msg: 'GitPOAPRequest is already APPROVED' });
  }

  const existingContributors = convertContributorsFromSchema(
    gitPOAPRequest.contributors ? (gitPOAPRequest.contributors as Prisma.JsonObject) : {},
  );

  const newContributors = addGitPOAPContributors(
    existingContributors,
    convertContributorsFromSchema(contributors),
  );

  await context.prisma.gitPOAPRequest.update({
    where: { id: gitPOAPRequestId },
    data: { contributors: newContributors },
  });

  logger.debug(`Completed request to create new Claims for GitPOAPRequest ID ${gitPOAPRequestId}`);

  return res.status(200).send('CREATED');
});

customGitPOAPsRouter.delete('/:gitPOAPRequestId/claim', jwtWithAddress(), async (req, res) => {
  const logger = getRequestLogger(req);

  const gitPOAPRequestId = parseInt(req.params.gitPOAPRequestId, 10);

  const schemaResult = DeleteGitPOAPRequestClaimSchema.safeParse(req.body);

  if (!schemaResult.success) {
    logger.warn(
      `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
    );
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  const { claimType, claimData } = schemaResult.data;

  logger.info(
    `Request to remove ${claimType} "${claimData}" from GitPOAPRequest ID ${gitPOAPRequestId}`,
  );

  const gitPOAPRequest = await context.prisma.gitPOAPRequest.findUnique({
    where: { id: gitPOAPRequestId },
    select: {
      addressId: true,
      adminApprovalStatus: true,
      contributors: true,
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
      `User attempted to delete a Claim for a GitPOAPRequest (ID: ${gitPOAPRequestId}) that they do not own`,
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

  const existingContributors = convertContributorsFromSchema(
    gitPOAPRequest.contributors ? (gitPOAPRequest.contributors as Prisma.JsonObject) : {},
  );

  const newContributors = removeContributorFromGitPOAP(existingContributors, claimType, claimData);

  await context.prisma.gitPOAPRequest.update({
    where: { id: gitPOAPRequestId },
    data: { contributors: newContributors },
  });

  logger.debug(
    `Completed request to remove ${claimType} "${claimData}" from GitPOAPRequest ID ${gitPOAPRequestId}`,
  );

  return res.status(200).send('DELETED');
});

customGitPOAPsRouter.patch('/:gitPOAPRequestId', jwtWithAddress(), async (req, res) => {
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

  const maybeParseDate = (date?: string) => (date ? new Date(date) : undefined);

  // Parse the dates if they are present
  const data = {
    ...schemaResult.data.data,
    startDate: maybeParseDate(schemaResult.data.data.startDate),
    endDate: maybeParseDate(schemaResult.data.data.endDate),
    expiryDate: maybeParseDate(schemaResult.data.data.expiryDate),
  };

  await context.prisma.gitPOAPRequest.update({
    where: { id: gitPOAPRequestId },
    data,
  });

  logger.debug(`Competed request to update GitPOAPRequest ID ${gitPOAPRequestId}`);

  return res.status(200).send('UPDATED');
});
