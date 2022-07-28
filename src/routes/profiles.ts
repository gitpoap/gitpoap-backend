import { UpdateProfileSchema } from '../schemas/profiles';
import { Router } from 'express';
import { context } from '../context';
import { resolveENS } from '../external/ens';
import { isSignatureValid } from '../signatures';
import { createScopedLogger } from '../logging';
import { httpRequestDurationSeconds } from '../metrics';

export const profilesRouter = Router();

profilesRouter.post('/', async function (req, res) {
  const logger = createScopedLogger('POST /profiles');

  logger.debug(`Body: ${JSON.stringify(req.body)}`);

  const endTimer = httpRequestDurationSeconds.startTimer('POST', '/profiles');

  const schemaResult = UpdateProfileSchema.safeParse(req.body);
  if (!schemaResult.success) {
    logger.warn(
      `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
    );
    endTimer({ status: 400 });
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  logger.info(`Request to update profile for address: ${req.body.address}`);

  const resolvedAddress = await resolveENS(req.body.address);
  if (resolvedAddress === null) {
    logger.warn('Request address is invalid');
    endTimer({ status: 400 });
    return res.status(400).send({ msg: `${req.body.address} is not a valid address` });
  }

  // Validate the signature for the updates
  if (
    !isSignatureValid(resolvedAddress, 'POST /profiles', req.body.signature, {
      data: req.body.data,
    })
  ) {
    logger.warn('Request signature is invalid');
    endTimer({ status: 401 });
    return res.status(401).send({ msg: 'The signature is not valid for this address and data' });
  }

  const address = resolvedAddress.toLowerCase();

  await context.prisma.profile.upsert({
    where: { address },
    update: req.body.data,
    create: {
      address,
      ...req.body.data,
    },
  });

  logger.debug(`Completed request to update profile for address: ${req.body.address}`);

  endTimer({ status: 200 });

  return res.status(200).send('UPDATED');
});
