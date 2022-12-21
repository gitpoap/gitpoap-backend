import { Router } from 'express';
import multer from 'multer';
import { jwtWithAddress } from '../middleware/auth';
import { getRequestLogger } from '../middleware/loggingAndTiming';
import { getS3URL, s3configProfile } from '../external/s3';
import { hasMembership } from '../lib/authTokens';
import { MembershipAcceptanceStatus, MembershipRole } from '@prisma/client';
import { getAccessTokenPayload } from '../types/authTokens';
import { uploadTeamLogoImage } from '../lib/teams';
import { context } from '../context';
import { CreateTeamSchema } from '../schemas/teams';
import { DateTime } from 'luxon';

export const teamsRouter = Router();

const upload = multer();

teamsRouter.post('/', jwtWithAddress(), upload.single('image'), async function (req, res) {
  const logger = getRequestLogger(req);

  const schemaResult = CreateTeamSchema.safeParse(req.body);
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

  const { addressId } = getAccessTokenPayload(req.user);

  logger.info(`Request to create Team "${schemaResult.data.name}" for Address ID ${addressId}`);

  const imageKey = await uploadTeamLogoImage(req.file);
  if (imageKey === null) {
    logger.error('Failed to upload Team logo image to s3');
    return res.status(500).send({ msg: 'Failed to upload image' });
  }

  const teamResult = await context.prisma.team.create({
    data: {
      name: schemaResult.data.name,
      ownerAddress: {
        connect: { id: addressId },
      },
      description: schemaResult.data.description ?? null,
      logoImageUrl: getS3URL(s3configProfile.buckets.teamLogoImages, imageKey),
    },
    select: { id: true },
  });

  await context.prisma.membership.create({
    data: {
      team: {
        connect: { id: teamResult.id },
      },
      address: {
        connect: { id: addressId },
      },
      role: MembershipRole.OWNER,
      acceptanceStatus: MembershipAcceptanceStatus.ACCEPTED,
      joinedOn: DateTime.utc().toJSDate(),
    },
  });

  logger.info(
    `Completed request to create Team "${schemaResult.data.name}" for Address ID ${addressId}`,
  );
});

teamsRouter.patch(
  '/:teamId/logo',
  jwtWithAddress(),
  upload.single('image'),
  async function (req, res) {
    const logger = getRequestLogger(req);

    const teamId = parseInt(req.params.teamId, 10);

    logger.info(`Request to change the logo for Team ID ${teamId}`);

    if (!req.file) {
      const msg = 'Missing/invalid "image" upload in request';
      logger.warn(msg);
      return res.status(400).send({ msg });
    }

    const teamResult = await context.prisma.team.findUnique({
      where: { id: teamId },
    });
    if (teamResult === null) {
      const msg = `Team ID ${teamId} doesn't exist`;
      logger.warn(msg);
      return res.status(404).send({ msg });
    }

    const accessTokenPayload = getAccessTokenPayload(req.user);

    if (!hasMembership(accessTokenPayload, teamId, [MembershipRole.OWNER, MembershipRole.ADMIN])) {
      logger.warn(
        `Non-admin ${accessTokenPayload.address} attempted to change the logo for Team ID ${teamId}`,
      );
      return res.status(401).send({ msg: 'Must be an admin of the team' });
    }

    const imageKey = await uploadTeamLogoImage(req.file);
    if (imageKey === null) {
      logger.error('Failed to upload Team logo image to s3');
      return res.status(500).send({ msg: 'Failed to upload image' });
    }

    await context.prisma.team.update({
      where: { id: teamId },
      data: {
        logoImageUrl: getS3URL(s3configProfile.buckets.teamLogoImages, imageKey),
      },
    });

    logger.debug(`Completed request to change the logo for Team ID ${teamId}`);

    return res.status(200).send('UPDATED');
  },
);
