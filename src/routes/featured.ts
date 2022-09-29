import { Router } from 'express';
import { AddFeaturedSchema, RemoveFeaturedSchema } from '../schemas/featured';
import { context } from '../context';
import { resolveENS } from '../lib/ens';
import { isSignatureValid } from '../signatures';
import { retrievePOAPTokenInfo } from '../external/poap';
import { createScopedLogger } from '../logging';
import { httpRequestDurationSeconds } from '../metrics';
import { getProfileByAddress, upsertProfile } from '../lib/profiles';

export const featuredRouter = Router();

featuredRouter.put('/', async function (req, res) {
  const logger = createScopedLogger('PUT /featured');

  logger.debug(`Body: ${JSON.stringify(req.body)}`);

  const endTimer = httpRequestDurationSeconds.startTimer('PUT', '/featured');

  const schemaResult = AddFeaturedSchema.safeParse(req.body);
  if (!schemaResult.success) {
    logger.warn(
      `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
    );
    endTimer({ status: 400 });
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  logger.info(`Request from ${req.body.address} for POAP ID: ${req.body.poapTokenId}`);

  // Resolve ENS if provided
  const resolvedAddress = await resolveENS(req.body.address);
  if (resolvedAddress === null) {
    logger.warn('Request address is invalid');
    endTimer({ status: 400 });
    return res.status(400).send({ msg: `${req.body.address} is not a valid address` });
  }

  if (
    !isSignatureValid(resolvedAddress, 'PUT /featured', req.body.signature, {
      poapTokenId: req.body.poapTokenId,
    })
  ) {
    logger.warn('Request signature is invalid');
    endTimer({ status: 401 });
    return res.status(401).send({ msg: 'The signature is not valid for this address and data' });
  }

  const profile = await upsertProfile(resolvedAddress);

  const poapData = await retrievePOAPTokenInfo(req.body.poapTokenId);
  if (poapData === null) {
    logger.error(`Failed to retrieve POAP data (from POAP API) for ID: ${req.body.poapTokenId}`);
    endTimer({ status: 400 });
    return res.status(400).send({ msg: "Couldn't retrieve info about the POAP from the POAP API" });
  }

  if (poapData.owner.toLowerCase() !== resolvedAddress.toLowerCase()) {
    logger.warn(`Address ${resolvedAddress} attempted to feature unowned POAP`);
    endTimer({ status: 401 });
    return res.status(401).send({ msg: 'Users cannot feature POAPs they do not own' });
  }

  // If the POAP is a GitPOAP and it needs revalidation, don't let it be featured
  const claimData = await context.prisma.claim.findUnique({
    where: {
      poapTokenId: req.body.poapTokenId,
    },
    select: {
      needsRevalidation: true,
    },
  });
  if (claimData !== null && claimData.needsRevalidation) {
    logger.warn(
      `Address ${resolvedAddress} attempted to feature a GitPOAP that needs revalidation`,
    );
    endTimer({ status: 400 });
    return res.status(400).send({
      msg: 'You must revalidate yourself as owner of this GitPOAP before you can feature it',
    });
  }

  await context.prisma.featuredPOAP.upsert({
    where: {
      poapTokenId_profileId: {
        poapTokenId: req.body.poapTokenId,
        profileId: profile.id,
      },
    },
    update: {},
    create: {
      poapTokenId: req.body.poapTokenId,
      profileId: profile.id,
    },
  });

  logger.debug(`Completed request from ${req.body.address} for POAP ID: ${req.body.poapTokenId}`);

  endTimer({ status: 200 });

  return res.status(200).send('ADDED');
});

featuredRouter.delete('/:id', async function (req, res) {
  const logger = createScopedLogger('DELETE /featured/:id');

  logger.debug(`Params: ${JSON.stringify(req.params)} Body: ${JSON.stringify(req.body)}`);

  const endTimer = httpRequestDurationSeconds.startTimer('DELETE', '/featured/:id');

  const schemaResult = RemoveFeaturedSchema.safeParse(req.body);
  if (!schemaResult.success) {
    logger.warn(
      `Missing/invalid body fields in request ${JSON.stringify(schemaResult.error.issues)}`,
    );
    endTimer({ status: 400 });
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  logger.info(`Received request from ${req.body.address} for POAP ID: ${req.params.id}`);

  // Resolve ENS if provided
  const resolvedAddress = await resolveENS(req.body.address);
  if (resolvedAddress === null) {
    logger.warn('Request address is invalid');
    endTimer({ status: 400 });
    return res.status(400).send({ msg: `${req.body.address} is not a valid address` });
  }

  if (
    !isSignatureValid(resolvedAddress, 'DELETE /featured/:id', req.body.signature, {
      poapTokenId: req.params.id,
    })
  ) {
    logger.warn('Request signature is invalid');
    endTimer({ status: 401 });
    return res.status(401).send({ msg: 'The signature is not valid for this address and data' });
  }

  const profile = await getProfileByAddress(resolvedAddress);

  if (profile === null) {
    logger.warn(`No profile for address: ${req.body.address}`);
    endTimer({ status: 404 });
    return res.status(404).send({ msg: `There is no profile for the address ${req.body.address}` });
  }

  try {
    await context.prisma.featuredPOAP.delete({
      where: {
        poapTokenId_profileId: {
          poapTokenId: req.params.id,
          profileId: profile.id,
        },
      },
    });
  } catch (err) {
    logger.warn(`Tried to delete a FeaturedPOAP that was already deleted: ${err}`);
  }

  logger.debug(`Completed request from ${req.body.address} for POAP ID: ${req.params.id}`);

  endTimer({ status: 200 });

  return res.status(200).send('DELETED');
});
