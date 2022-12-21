import { Router } from 'express';
import multer from 'multer';
import { jwtWithAddress } from '../middleware/auth';
import { getRequestLogger } from '../middleware/loggingAndTiming';
import { getS3URL, s3configProfile } from '../external/s3';
import { hasMembership } from '../lib/authTokens';
import { MembershipRole } from '@prisma/client';
import { getAccessTokenPayload } from '../types/authTokens';
import { uploadTeamLogoImage } from '../lib/teams';
import { context } from '../context';

export const teamsRouter = Router();

teamsRouter.patch(
  '/:teamId/logo',
  jwtWithAddress(),
  multer().single('image'),
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

    if (!hasMembership(accessTokenPayload, teamId, MembershipRole.ADMIN)) {
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
