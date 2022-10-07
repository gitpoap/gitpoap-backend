import { UpdateProfileSchema } from '../schemas/profiles';
import { Router } from 'express';
import { context } from '../context';
import { resolveENS } from '../lib/ens';
import { createScopedLogger } from '../logging';
import { httpRequestDurationSeconds } from '../metrics';
import { jwtWithAddress } from '../middleware';
import { getAccessTokenPayload } from '../types/authTokens';

export const profilesRouter = Router();

profilesRouter.post('/', jwtWithAddress(), async function (req, res) {
  const logger = createScopedLogger('POST /profiles');

  logger.debug(`Body: ${JSON.stringify(req.body)}`);

  const endTimer = httpRequestDurationSeconds.startTimer('POST', '/profiles');

  const { addressId, address } = getAccessTokenPayload(req.user);

  const schemaResult = UpdateProfileSchema.safeParse(req.body);
  if (!schemaResult.success) {
    logger.warn(
      `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
    );
    endTimer({ status: 400 });
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  logger.info(`Request to update profile for address: ${address}`);

  await context.prisma.profile.upsert({
    where: {
      addressId,
    },
    update: req.body.data,
    create: {
      address: {
        connect: { id: addressId },
      },
      ...req.body.data,
    },
  });

  logger.debug(`Completed request to update profile for address: ${req.body.address}`);

  endTimer({ status: 200 });

  return res.status(200).send('UPDATED');
});
