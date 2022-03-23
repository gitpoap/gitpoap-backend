import { UpdateProfileSchema } from '../schemas/profiles';
import { Router } from 'express';
import { context } from '../context';
import { resolveENS } from '../external/ens';
import { utils } from 'ethers';
import { createScopedLogger } from '../logging';

export const profilesRouter = Router();

profilesRouter.post('/', async function (req, res) {
  const logger = createScopedLogger('POST /profiles');

  logger.debug(`Body: ${JSON.stringify(req.body)}`);

  const schemaResult = UpdateProfileSchema.safeParse(req.body);

  if (!schemaResult.success) {
    logger.warn(`Missing/invalid body fields in request: ${schemaResult.error.issues}`);
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  logger.info(`Request to update profile for address: ${req.body.address}`);

  const resolvedAddress = await resolveENS(req.body.address);
  if (resolvedAddress === null) {
    logger.warn('Request address is invalid');
    return res.status(400).send({ msg: `${req.body.address} is not a valid address` });
  }

  // Validate the signature for the updates
  const recoveredAddress = utils.verifyMessage(JSON.stringify(req.body.data), req.body.signature);
  if (recoveredAddress !== resolvedAddress) {
    logger.warn('Request signature is invalid');
    return res.status(401).send({ msg: 'The signature is not valid for this address and data' });
  }

  try {
    await context.prisma.profile.upsert({
      where: {
        address: (<string>resolvedAddress).toLowerCase(),
      },
      update: req.body.data,
      create: {
        ...req.body.data,
        address: (<string>resolvedAddress).toLowerCase(),
      },
    });
  } catch (err) {
    logger.warn(`No profile for address ${req.body.address}`);
    return res.status(404).send({ msg: `No profile found for address: ${req.body.address}` });
  }

  logger.debug(`Completed request to update profile for address: ${req.body.address}`);

  return res.status(200).send('UPDATED');
});
