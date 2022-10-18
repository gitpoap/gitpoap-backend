import {
  CreateCustomGitPOAPSchema,
  CustomGitPOAPContributorsSchema,
} from '../../schemas/gitpoaps/custom';
import { Request, Router } from 'express';
import { z } from 'zod';
import { context } from '../../context';
import { createPOAPEvent } from '../../external/poap';
import { createScopedLogger } from '../../logging';
import { jwtWithAdminOAuth, jwtWithAddress } from '../../middleware';
import multer from 'multer';
import { GitPOAPType, AdminApprovalStatus } from '@generated/type-graphql';
import { httpRequestDurationSeconds } from '../../metrics';
import { generatePOAPSecret } from '../../lib/secrets';
import { DateTime } from 'luxon';
import { Prisma } from '@prisma/client';
import { getImageBufferFromS3, s3configProfile, uploadMulterFile } from '../../external/s3';
import { convertGitPOAPRequestToGitPOAP } from '../../lib/gitpoap';
import { GitPOAPRequestContributors } from '../../types/gitpoapRequest';
import {
  createClaimForEmail,
  createClaimForEnsName,
  createClaimForEthAddress,
  createClaimForGithubHandle,
} from '../../lib/claims';
import { deleteGitPOAPRequest } from '../../lib/gitpoapRequest';

export const customGitpoapsRouter = Router();

type CreateCustomGitPOAPReqBody = z.infer<typeof CreateCustomGitPOAPSchema>;

customGitpoapsRouter.post(
  '/',
  jwtWithAddress(),
  multer().single('image'),
  async function (req: Request<any, any, CreateCustomGitPOAPReqBody>, res) {
    const logger = createScopedLogger('POST /gitpoap/custom');
    logger.debug(`Body: ${JSON.stringify(req.body)}`);
    const endTimer = httpRequestDurationSeconds.startTimer('POST', '/gitpoap/custom');

    const schemaResult = CreateCustomGitPOAPSchema.safeParse(req.body);

    if (!schemaResult.success) {
      logger.warn(
        `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
      );
      endTimer({ status: 400 });

      return res.status(400).send({ issues: schemaResult.error.issues });
    }

    if (!req.file) {
      const msg = 'Missing/invalid "image" upload in request';
      logger.warn(msg);
      endTimer({ status: 400 });

      return res.status(400).send({ msg });
    }

    /* Validate the contributors object */
    let contributors: z.infer<typeof CustomGitPOAPContributorsSchema> = {};
    try {
      contributors = JSON.parse(req.body.contributors);
    } catch (err) {
      logger.warn(`JSON parse error for contributors: ${(err as Error).message ?? ''}`);
      endTimer({ status: 400 });

      return res.status(400).send({ issues: err });
    }

    const contributorsSchemaResult = CustomGitPOAPContributorsSchema.safeParse(contributors);

    if (!contributorsSchemaResult.success) {
      logger.warn(
        `Missing/invalid contributors fields in request: ${JSON.stringify(
          contributorsSchemaResult.error.issues,
        )}`,
      );
      endTimer({ status: 400 });

      return res.status(400).send({ issues: contributorsSchemaResult.error.issues });
    }

    /* Validate the date fields */
    const year = DateTime.fromISO(req.body.startDate).year;
    const startDate = DateTime.fromISO(req.body.startDate).toJSDate();
    const endDate = DateTime.fromISO(req.body.endDate).toJSDate();
    const expiryDate = DateTime.fromISO(req.body.expiryDate).toJSDate();

    if (
      !year ||
      startDate.toString() === 'Invalid Date' ||
      endDate.toString() === 'Invalid Date' ||
      expiryDate.toString() === 'Invalid Date'
    ) {
      logger.error(`Invalid date in the Request`);
      endTimer({ status: 400 });
      return res.status(400).send({ msg: 'Invalid date in the Request' });
    }

    let project: { id: number } | null = null;
    let organization: { id: number } | null = null;

    /* If a Custom GitPOAP Request is tied to project */
    if (req.body.projectId) {
      const projectId = req.body.projectId;
      logger.info(
        `Request to create a new Custom GitPOAP "${req.body.name}" for project ${projectId}`,
      );

      project = await context.prisma.project.findUnique({
        where: { id: +projectId },
        select: { id: true },
      });

      if (project === null) {
        const msg = `Failed to find project with id: ${projectId}`;
        logger.warn(msg);
        endTimer({ status: 404 });

        return res.status(404).send({ msg });
      }
    }

    /* If Custom GitPOAP Request is tied to an organization */
    if (req.body.organizationId) {
      const organizationId = req.body.organizationId;
      logger.info(
        `Request to create a new Custom GitPOAP "${req.body.name}" for organization ${organizationId}`,
      );
      organization = await context.prisma.organization.findUnique({
        where: { id: +organizationId },
        select: { id: true },
      });

      if (organization === null) {
        const msg = `Failed to find organization with id: ${organizationId}`;
        logger.warn(msg);
        endTimer({ status: 404 });

        return res.status(404).send({ msg });
      }
    }

    logger.info(`Uploading image to S3`);
    const image = req.file;
    let imageKey: string | null = null;
    const timestamp = DateTime.now().toSeconds();

    try {
      imageKey = `${image.originalname}-${timestamp}`;
      await uploadMulterFile(image, s3configProfile.buckets.gitPOAPRequest, imageKey);
      logger.info(
        `Uploaded image with imageKey: ${imageKey} to S3 bucket ${s3configProfile.buckets.gitPOAPRequest}`,
      );
    } catch (err) {
      logger.error(`Received error when uploading image to S3 - ${err}`);
      endTimer({ status: 500 });
      return res.status(500).send({ msg: 'Failed to upload assets to S3' });
    }

    const gitPOAPRequest = await context.prisma.gitPOAPRequest.create({
      data: {
        name: req.body.name,
        type: GitPOAPType.CUSTOM,
        imageKey,
        description: req.body.description,
        year,
        startDate,
        endDate,
        expiryDate,
        eventUrl: req.body.eventUrl,
        email: req.body.email,
        numRequestedCodes: +req.body.numRequestedCodes,
        project: project ? { connect: { id: project?.id } } : undefined,
        organization: organization ? { connect: { id: organization?.id } } : undefined,
        ongoing: req.body.ongoing === 'true',
        isEnabled: req.body.isEnabled !== 'false',
        adminApprovalStatus: AdminApprovalStatus.PENDING,
        contributors: contributors as Prisma.JsonObject,
        isPRBased: false,
      },
    });

    logger.info(
      `Completed request to create a new GitPOAP Request with ID: ${gitPOAPRequest.id} "${req.body.name}" for project ${project?.id} and organization ${organization?.id}`,
    );
    endTimer({ status: 201 });

    return res.status(201).send('CREATED');
  },
);

customGitpoapsRouter.put('/approve/:id', jwtWithAdminOAuth(), async (req, res) => {
  const logger = createScopedLogger('PUT /gitpoap/custom/approve/:id');
  logger.debug(`Body: ${JSON.stringify(req.body)}`);
  const endTimer = httpRequestDurationSeconds.startTimer('PUT', '/gitpoap/custom/approve/:id');

  const gitPOAPRequestId = parseInt(req.params.id, 10);
  logger.info(`Admin request to approve GitPOAP Request with ID:${gitPOAPRequestId}`);

  const gitPOAPRequest = await context.prisma.gitPOAPRequest.findUnique({
    where: { id: gitPOAPRequestId },
  });

  if (gitPOAPRequest === null) {
    const msg = `Failed to find GitPOAP Request with ID:${gitPOAPRequestId}`;
    logger.warn(msg);
    endTimer({ status: 404 });

    return res.status(404).send({ msg });
  }

  const isCustom = gitPOAPRequest.type === GitPOAPType.CUSTOM;
  const isApproved = gitPOAPRequest.adminApprovalStatus === AdminApprovalStatus.APPROVED;

  if (!isCustom) {
    const msg = `GitPOAP Request with ID:${gitPOAPRequestId} is not a custom GitPOAP Request`;
    logger.warn(msg);
    endTimer({ status: 400 });

    return res.status(400).send({ msg });
  }

  if (isApproved) {
    const msg = `GitPOAP Request with ID:${gitPOAPRequestId} is already approved.`;
    logger.warn(msg);
    endTimer({ status: 200 });

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

  const imageBuffer = await getImageBufferFromS3(
    s3configProfile.buckets.gitPOAPRequest,
    gitPOAPRequest.imageKey,
  );

  const secretCode = generatePOAPSecret();
  const poapInfo = await createPOAPEvent({
    name: gitPOAPRequest.name,
    description: gitPOAPRequest.description,
    start_date: DateTime.fromJSDate(gitPOAPRequest.startDate).toFormat('yyyy-MM-dd'),
    end_date: DateTime.fromJSDate(gitPOAPRequest.endDate).toFormat('yyyy-MM-dd'),
    expiry_date: DateTime.fromJSDate(gitPOAPRequest.expiryDate).toFormat('yyyy-MM-dd'),
    event_url: gitPOAPRequest.eventUrl,
    imageName: gitPOAPRequest.imageKey,
    imageBuffer,
    secret_code: secretCode,
    email: gitPOAPRequest.email,
    num_requested_codes: parseInt(req.body.numRequestedCodes, 10),
  });

  if (poapInfo == null) {
    logger.error('Failed to create event via POAP API');
    endTimer({ status: 500 });

    return res.status(500).send({ msg: 'Failed to create POAP via API' });
  }

  logger.info(`Created Custom GitPOAP in POAP system: ${JSON.stringify(poapInfo)}`);

  /* Create the GitPOAP from the GitPOAPRequest */
  const gitPOAP = await convertGitPOAPRequestToGitPOAP(gitPOAPRequest, poapInfo, secretCode);

  logger.info(`Created Custom GitPOAP Request with ID: ${gitPOAPRequest.id}`);

  /* Create the associated Claims */
  if (updatedGitPOAPRequest.contributors) {
    const contributors = updatedGitPOAPRequest.contributors as GitPOAPRequestContributors;

    for (const githubHandle of contributors['githubHandles']) {
      createClaimForGithubHandle(githubHandle, gitPOAP.id);
    }

    for (const email of contributors['emails']) {
      createClaimForEmail(email, gitPOAP.id);
    }

    for (const ethAddress of contributors['ethAddresses']) {
      createClaimForEthAddress(ethAddress, gitPOAP.id);
    }

    for (const ensName of contributors['ensNames']) {
      createClaimForEnsName(ensName, gitPOAP.id);
    }
  }

  logger.info(`Created Claims for GitPOAP Request with ID: ${gitPOAPRequest.id}`);

  /* Delete the GitPOAPRequest */
  await deleteGitPOAPRequest(gitPOAPRequest.id);

  logger.info(`Completed admin request to create Custom GitPOAP with ID:${gitPOAP.id}`);
  endTimer({ status: 200 });

  return res.status(200).send(`${req.body.status}`);
});

customGitpoapsRouter.put('/reject/:id', jwtWithAdminOAuth(), async (req, res) => {
  const logger = createScopedLogger('PUT /gitpoap/custom/reject/:id');
  logger.debug(`Body: ${JSON.stringify(req.body)}`);
  const endTimer = httpRequestDurationSeconds.startTimer('PUT', '/gitpoap/custom/reject/:id');

  const gitPOAPRequestId = parseInt(req.params.id, 10);
  logger.info(`Admin request to reject GitPOAP Request with ID:${gitPOAPRequestId}`);

  const gitPOAPRequest = await context.prisma.gitPOAPRequest.findUnique({
    where: { id: gitPOAPRequestId },
  });

  if (gitPOAPRequest === null) {
    const msg = `Failed to find GitPOAP Request with ID:${gitPOAPRequestId}`;
    logger.warn(msg);
    endTimer({ status: 404 });

    return res.status(404).send({ msg });
  }

  if (gitPOAPRequest.adminApprovalStatus === AdminApprovalStatus.APPROVED) {
    const msg = `GitPOAP Request with ID:${gitPOAPRequestId} is already approved.`;
    logger.warn(msg);
    endTimer({ status: 400 });

    return res.status(400).send({ msg });
  }

  if (gitPOAPRequest.adminApprovalStatus === AdminApprovalStatus.REJECTED) {
    const msg = `GitPOAP Request with ID:${gitPOAPRequestId} is already rejected.`;
    logger.warn(msg);
    endTimer({ status: 200 });

    return res.status(200).send({ msg });
  }

  await context.prisma.gitPOAPRequest.update({
    where: { id: gitPOAPRequestId },
    data: {
      adminApprovalStatus: AdminApprovalStatus.REJECTED,
    },
  });

  logger.info(
    `Completed admin request to reject Custom GitPOAP with Request ID:${gitPOAPRequest.id}`,
  );
  endTimer({ status: 200 });

  return res.status(200).send(`${req.body.status}`);
});
