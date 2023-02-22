import {
  CreateCustomGitPOAPSchema,
  UpdateCustomGitPOAPSchema,
  RejectCustomGitPOAPSchema,
} from '../../schemas/gitpoaps/custom';
import { Request, Router } from 'express';
import { z } from 'zod';
import { context } from '../../context';
import { createPOAPEvent } from '../../external/poap';
import { jwtWithStaffAccess, jwtWithAddress } from '../../middleware/auth';
import multer from 'multer';
import { generatePOAPSecret } from '../../lib/secrets';
import { DateTime } from 'luxon';
import { StaffApprovalStatus, Prisma } from '@prisma/client';
import {
  getImageBufferFromS3URL,
  getKeyFromS3URL,
  getS3URL,
  s3configProfile,
} from '../../external/s3';
import { convertGitPOAPRequestToGitPOAP } from '../../lib/gitpoaps';
import { getAccessTokenPayloadWithAddress } from '../../types/authTokens';
import { sendInternalGitPOAPRequestMessage } from '../../external/slack';
import { convertContributorsFromSchema, createClaimsForContributors } from '../../lib/gitpoaps';
import {
  chooseGitPOAPRequestDates,
  chooseNumberOfRequestedCodes,
  updateGitPOAPRequestStatus,
  uploadGitPOAPRequestImage,
  validateContributorsString,
} from '../../lib/gitpoapRequests';
import { getRequestLogger } from '../../middleware/loggingAndTiming';
import { GITPOAP_ISSUER_EMAIL, GITPOAP_ROOT_URL, POAP_DATE_FORMAT } from '../../constants';
import { upsertEmail } from '../../lib/emails';
import {
  sendGitPOAPRequestConfirmationEmail,
  sendGitPOAPRequestRejectionEmail,
} from '../../external/postmark';
import { GitPOAPRequestEmailForm } from '../../types/gitpoaps';
import { formatDateToReadableString } from './utils';
import { isAddressAStaffMember } from '../../lib/staff';

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
    let team: { id: number; name: string } | null = null;

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

    /* If GitPOAPRequest is tied to a team */
    if (schemaResult.data.teamId) {
      const teamId = parseInt(schemaResult.data.teamId, 10);
      logger.info(
        `Request to create a new GitPOAPRequest "${schemaResult.data.name}" for team ${teamId}`,
      );
      team = await context.prisma.team.findUnique({
        where: { id: teamId },
        select: { id: true, name: true },
      });

      if (team === null) {
        const msg = `Failed to find team with id: ${teamId}`;
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

    if (email === null) {
      logger.error(
        `Failed to upsert email "${schemaResult.data.creatorEmail}" during creation of GitPOAPRequest`,
      );
      return res.status(500).send({ msg: 'Failed to setup email address' });
    }

    const { address } = getAccessTokenPayloadWithAddress(req.user);

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
        team: team ? { connect: { id: team?.id } } : undefined,
        staffApprovalStatus: StaffApprovalStatus.PENDING,
        contributors: contributors as Prisma.JsonObject,
        address: {
          connect: { id: address.id },
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
      startDate: formatDateToReadableString(gitPOAPRequest.startDate),
      endDate: formatDateToReadableString(gitPOAPRequest.endDate),
    };
    void sendGitPOAPRequestConfirmationEmail(emailForm);

    logger.info(
      `Completed request to create a new GitPOAP Request with ID: ${gitPOAPRequest.id} "${schemaResult.data.name}" for project ${project?.id} and team ${team?.id}`,
    );

    return res.status(201).send('CREATED');
  },
);

customGitPOAPsRouter.put('/approve/:id', jwtWithStaffAccess(), async (req, res) => {
  const logger = getRequestLogger(req);

  const gitPOAPRequestId = parseInt(req.params.id, 10);

  logger.info(`Staff request to create GitPOAP from GitPOAPRequest ID ${gitPOAPRequestId}`);

  const gitPOAPRequest = await context.prisma.gitPOAPRequest.findUnique({
    where: { id: gitPOAPRequestId },
  });

  if (gitPOAPRequest === null) {
    const msg = `Failed to find GitPOAP Request with ID:${gitPOAPRequestId}`;
    logger.warn(msg);
    return res.status(404).send({ msg });
  }

  const isApproved = gitPOAPRequest.staffApprovalStatus === StaffApprovalStatus.APPROVED;

  if (isApproved) {
    const msg = `GitPOAP Request with ID:${gitPOAPRequestId} is already approved.`;
    logger.warn(msg);
    return res.status(200).send({ msg });
  }

  const imageBuffer = await getImageBufferFromS3URL(gitPOAPRequest.imageUrl);

  if (imageBuffer === null) {
    const msg = `Unable to fetch the imageBuffer (url: ${gitPOAPRequest.imageUrl}) for GitPOAP Request with ID:${gitPOAPRequestId}`;
    logger.warn(msg);
    return res.status(500).send({ msg });
  }

  /* Update the GitPOAPRequest to APPROVED */
  const updatedGitPOAPRequest = await updateGitPOAPRequestStatus(
    gitPOAPRequestId,
    StaffApprovalStatus.APPROVED,
  );

  logger.info(`Marking GitPOAP Request with ID:${gitPOAPRequestId} as APPROVED.`);

  const { startDate, endDate, expiryDate } = chooseGitPOAPRequestDates();

  const secretCode = generatePOAPSecret();
  const poapInfo = await createPOAPEvent({
    name: gitPOAPRequest.name,
    description: gitPOAPRequest.description,
    start_date: startDate.toFormat(POAP_DATE_FORMAT),
    end_date: endDate.toFormat(POAP_DATE_FORMAT),
    expiry_date: expiryDate.toFormat(POAP_DATE_FORMAT),
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
    await updateGitPOAPRequestStatus(gitPOAPRequestId, StaffApprovalStatus.PENDING);
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
    claimsCount = await createClaimsForContributors(gitPOAP.id, contributors);
  }
  logger.info(`Created ${claimsCount} Claims for GitPOAP Request with ID: ${gitPOAPRequestId}`);

  /* TODO: reenable after POAP fixes their issues with dates
  // Delete the GitPOAPRequest
  await deleteGitPOAPRequest(gitPOAPRequest.id);
  */

  logger.debug(
    `Completed staff request to create GitPOAP from GitPOAPRequest ID ${gitPOAPRequestId}`,
  );

  return res.status(200).send('APPROVED');
});

customGitPOAPsRouter.put('/reject/:id', jwtWithStaffAccess(), async (req, res) => {
  const logger = getRequestLogger(req);

  const gitPOAPRequestId = parseInt(req.params.id, 10);

  const schemaResult = RejectCustomGitPOAPSchema.safeParse(req.body);
  if (!schemaResult.success) {
    logger.warn(
      `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
    );
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  logger.info(
    `Staff request to reject GitPOAP Request with ID: ${gitPOAPRequestId} for reason: ${schemaResult.data.rejectionReason}`,
  );

  const gitPOAPRequest = await context.prisma.gitPOAPRequest.findUnique({
    where: { id: gitPOAPRequestId },
  });

  if (gitPOAPRequest === null) {
    const msg = `Failed to find GitPOAP Request with ID:${gitPOAPRequestId}`;
    logger.warn(msg);
    return res.status(404).send({ msg });
  }

  if (gitPOAPRequest.staffApprovalStatus === StaffApprovalStatus.APPROVED) {
    const msg = `GitPOAP Request with ID:${gitPOAPRequestId} is already approved.`;
    logger.warn(msg);
    return res.status(400).send({ msg });
  }

  if (gitPOAPRequest.staffApprovalStatus === StaffApprovalStatus.REJECTED) {
    const msg = `GitPOAP Request with ID:${gitPOAPRequestId} is already rejected.`;
    logger.warn(msg);
    return res.status(200).send({ msg });
  }

  const updatedGitPOAPRequest = await context.prisma.gitPOAPRequest.update({
    where: { id: gitPOAPRequestId },
    data: {
      staffApprovalStatus: StaffApprovalStatus.REJECTED,
      rejectionReason: schemaResult.data.rejectionReason,
    },
    select: {
      team: {
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
      rejectionReason: true,
    },
  });

  /* Send CG request rejection email */
  const emailForm: GitPOAPRequestEmailForm = {
    id: gitPOAPRequest.id,
    email: updatedGitPOAPRequest.creatorEmail.emailAddress,
    name: gitPOAPRequest.name,
    imageUrl: gitPOAPRequest.imageUrl,
    description: gitPOAPRequest.description,
    rejectionReason: updatedGitPOAPRequest?.rejectionReason ?? '',
    startDate: formatDateToReadableString(gitPOAPRequest.startDate),
    endDate: formatDateToReadableString(gitPOAPRequest.endDate),
  };
  void sendGitPOAPRequestRejectionEmail(emailForm);

  logger.info(
    `Completed staff request to reject Custom GitPOAP with Request ID:${gitPOAPRequest.id}`,
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
        staffApprovalStatus: true,
      },
    });

    if (gitPOAPRequest === null) {
      const msg = `GitPOAPRequest with ID ${gitPOAPRequestId} doesn't exist`;
      logger.warn(msg);
      return res.status(404).send({ msg });
    }

    const { address } = getAccessTokenPayloadWithAddress(req.user);

    if (gitPOAPRequest.addressId !== address.id && !isAddressAStaffMember(address.ethAddress)) {
      logger.warn(
        `Non-staff address ${address.ethAddress} attempted to update a GitPOAPRequest (ID: ${gitPOAPRequestId}) that they do not own`,
      );
      return res.status(401).send({ msg: 'Not GitPOAPRequest creator' });
    }

    // This could happen if the staff approval request is put in around the same time
    // that the creator is trying to add new contributors, i.e. that the conversion
    // from GitPOAPRequest to GitPOAP hasn't completed yet.
    if (gitPOAPRequest.staffApprovalStatus === StaffApprovalStatus.APPROVED) {
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
      staffApprovalStatus: StaffApprovalStatus.PENDING,
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
