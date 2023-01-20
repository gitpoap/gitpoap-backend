import { UpdateProfileSchema } from '../schemas/profiles';
import { Router } from 'express';
import { context } from '../context';
import { jwtWithAddress } from '../middleware/auth';
import { getAccessTokenPayloadWithAddress } from '../types/authTokens';
import { getRequestLogger } from '../middleware/loggingAndTiming';

export const profilesRouter = Router();

profilesRouter.post('/', jwtWithAddress(), async function (req, res) {
  const logger = getRequestLogger(req);

  const { address } = getAccessTokenPayloadWithAddress(req.user);

  const schemaResult = UpdateProfileSchema.safeParse(req.body);
  if (!schemaResult.success) {
    logger.warn(
      `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
    );
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  logger.info(`Request to update profile for address: ${address.ethAddress}`);

  await context.prisma.profile.upsert({
    where: { addressId: address.id },
    update: req.body.data,
    create: {
      address: {
        connect: { id: address.id },
      },
      ...req.body.data,
    },
  });

  logger.debug(`Completed request to update profile for address: ${address.ethAddress}`);

  return res.status(200).send('UPDATED');
});
