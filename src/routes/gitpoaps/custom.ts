import {
  CreateCustomGitPOAPSchema,
  CustomGitPOAPContributorsSchema,
} from '../../schemas/gitpoaps/custom';
import { Request, Router } from 'express';
import { z } from 'zod';
import { context } from '../../context';
import { createPOAPEvent } from '../../external/poap';
import { createScopedLogger } from '../../logging';
import { jwtWithOAuth, jwtWithAdminOAuth } from '../../middleware';
import multer from 'multer';
import { GitPOAPType, AdminApprovalStatus } from '@generated/type-graphql';
import { httpRequestDurationSeconds } from '../../metrics';
import { generatePOAPSecret } from '../../lib/secrets';
import { DateTime } from 'luxon';
import { Prisma } from '@prisma/client';
import { getImageBufferFromS3, s3configProfile, uploadMulterFile } from '../../external/s3';
import { convertGitPOAPRequestToGitPOAP } from '../../lib/gitpoap';
import { GitPOAPRequestContributors } from '../../types/gitpoap-request';
import {
  createClaimForEmail,
  createClaimForEnsName,
  createClaimForEthAddress,
  createClaimForGithubHandle,
} from '../../lib/claims';

export const customGitpoapsRouter = Router();

const upload = multer();

type CreateCustomGitPOAPReqBody = z.infer<typeof CreateCustomGitPOAPSchema>;

customGitpoapsRouter.post(
  '/',
  jwtWithOAuth(),
  upload.single('image'),
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
    const contributors: z.infer<typeof CustomGitPOAPContributorsSchema> = JSON.parse(
      req.body.contributors,
    );
    const contributorsSchemaResult = CustomGitPOAPContributorsSchema.safeParse(
      req.body.contributors,
    );

    if (!contributorsSchemaResult.success) {
      logger.warn(
        `Missing/invalid contributors fields in request: ${JSON.stringify(
          contributorsSchemaResult.error.issues,
        )}`,
      );
      endTimer({ status: 400 });

      return res.status(400).send({ issues: contributorsSchemaResult.error.issues });
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
        where: { id: projectId },
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
        where: { id: organizationId },
        select: { id: true },
      });

      if (organization === null) {
        const msg = `Failed to find organization with id: ${organizationId}`;
        logger.warn(msg);
        endTimer({ status: 404 });

        return res.status(404).send({ msg });
      }
    }

    const year = DateTime.fromISO(req.body.startDate).year;

    const gitPOAPRequest = await context.prisma.gitPOAPRequest.create({
      data: {
        name: req.body.name,
        type: GitPOAPType.CUSTOM,
        imageKey: '', // will be set immediately after this request
        description: req.body.description,
        year: year,
        startDate: DateTime.fromISO(req.body.startDate).toJSDate(),
        endDate: DateTime.fromISO(req.body.endDate).toJSDate(),
        expiryDate: DateTime.fromISO(req.body.expiryDate).toJSDate(),
        eventUrl: req.body.eventUrl,
        email: req.body.email,
        numRequestedCodes: req.body.numRequestedCodes,
        project: { connect: { id: project?.id } },
        organization: { connect: { id: organization?.id } },
        ongoing: req.body.ongoing === 'true',
        isEnabled: req.body.isEnabled !== 'false',
        adminApprovalStatus: AdminApprovalStatus.PENDING,
        contributors: contributors as Prisma.JsonObject,
      },
    });

    logger.info(`Uploading image to S3`);
    const image = req.file;
    try {
      const key = `${image.originalname}-${gitPOAPRequest.id}`;
      await uploadMulterFile(image, s3configProfile.buckets.gitPOAPRequest, key);
      logger.info(
        `Uploaded image with key: ${key} to S3 bucket ${s3configProfile.buckets.gitPOAPRequest}`,
      );

      /* Update the gitPOAPRequest with the s3 asset key */
      await context.prisma.gitPOAPRequest.update({
        where: { id: gitPOAPRequest.id },
        data: { imageKey: key },
      });
    } catch (err) {
      logger.error(`Received error when uploading image to S3 - ${err}`);
      endTimer({ status: 500 });
      return res.status(500).send({ msg: 'Failed to upload assets to S3' });
    }

    logger.debug(
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
    endTimer({ status: 400 });

    return res.status(400).send({ msg });
  }

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
    imageBuffer: imageBuffer,
    secret_code: secretCode,
    email: gitPOAPRequest.email,
    num_requested_codes: parseInt(req.body.numRequestedCodes, 10),
  });
  if (poapInfo == null) {
    logger.error('Failed to create event via POAP API');
    endTimer({ status: 500 });

    return res.status(500).send({ msg: 'Failed to create POAP via API' });
  }

  logger.debug(`Created Custom GitPOAP in POAP system: ${JSON.stringify(poapInfo)}`);

  /* Create the GitPOAP */
  const gitPOAP = await convertGitPOAPRequestToGitPOAP(gitPOAPRequest, poapInfo, secretCode);

  /* Update the GitPOAPRequest */
  const updatedGitPOAPRequest = await context.prisma.gitPOAPRequest.update({
    where: { id: gitPOAPRequestId },
    data: {
      adminApprovalStatus: AdminApprovalStatus.APPROVED,
      gitPOAP: {
        connect: { id: gitPOAP.id },
      },
    },
  });

  logger.debug(`Created Custom GitPOAP Request with ID: ${gitPOAPRequest.id}`);

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

  logger.debug(`Completed admin request to approve Custom GitPOAP with ID:${gitPOAP.id}`);
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

  await context.prisma.gitPOAPRequest.update({
    where: { id: gitPOAPRequestId },
    data: {
      adminApprovalStatus: AdminApprovalStatus.REJECTED,
    },
  });

  logger.debug(
    `Completed admin request to reject Custom GitPOAP with Request ID:${gitPOAPRequest.id}`,
  );
  endTimer({ status: 200 });

  return res.status(200).send(`${req.body.status}`);
});
