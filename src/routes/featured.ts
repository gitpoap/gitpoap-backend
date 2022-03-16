import { Router } from 'express';
import { AddFeaturedSchema, RemoveFeaturedSchema } from '../schemas/featured';
import { context } from '../context';
import { resolveENS } from '../util';
import { utils } from 'ethers';
import { retrievePOAPInfo } from '../external/poap';
import { logger } from '../logging';

export const featuredRouter = Router();

featuredRouter.put('/', async function (req, res) {
  logger.debug(`PUT /featured: Body: ${req.body}`);

  const schemaResult = AddFeaturedSchema.safeParse(req.body);

  if (!schemaResult.success) {
    logger.warn(
      `PUT /featured: Missing/invalid body fields in request: ${schemaResult.error.issues}`,
    );
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  logger.info(
    `PUT /featured: Request from ${req.body.address} for POAP ID: ${req.body.poapTokenId}`,
  );

  // Resolve ENS if provided
  const resolvedAddress = await resolveENS(context.provider, req.body.address);
  if (resolvedAddress === null) {
    logger.warn('PUT /featured: Request address is invalid');
    return res.status(400).send({ msg: `${req.body.address} is not a valid address` });
  }

  const recoveredAddress = utils.verifyMessage(
    JSON.stringify({ action: 'add', id: req.body.poapTokenId }),
    req.body.signature,
  );
  if (recoveredAddress !== resolvedAddress) {
    logger.warn('PUT /featured: Request signature is invalid');
    return res.status(401).send({ msg: 'The signature is not valid for this address and data' });
  }

  const profile = await context.prisma.profile.findUnique({
    where: {
      address: resolvedAddress.toLowerCase(),
    },
  });
  if (profile === null) {
    logger.warn(`PUT /featured: No profile for address: ${req.body.address}`);
    return res.status(404).send({ msg: `There is no profile for the address ${req.body.address}` });
  }

  const poapData = await retrievePOAPInfo(req.body.poapTokenId);
  if (poapData === null) {
    logger.error(
      `PUT /featured: Failed to retrieve POAP data (from POAP API) for ID: ${req.body.poapTokenId}`,
    );
    return res.status(400).send({ msg: "Couldn't retrieve info about the POAP from the POAP API" });
  }

  if (poapData.owner.toLowerCase() !== resolvedAddress.toLowerCase()) {
    logger.warn('PUT /featured: Attempt to feature unowned POAP');
    return res.status(401).send({ msg: 'Users cannot feature POAPs they do not own' });
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

  logger.info(
    `PUT /featured: Completed request from ${req.body.address} for POAP ID: ${req.body.poapTokenId}`,
  );

  return res.status(200).send('ADDED');
});

featuredRouter.delete('/:id', async function (req, res) {
  logger.debug(`DELETE /featured/:id: Params: ${req.params} Body: ${req.body}`);

  const schemaResult = RemoveFeaturedSchema.safeParse(req.body);

  if (!schemaResult.success) {
    logger.warn(
      `DELETE /featured/:id: Missing/invalid body fields in request ${schemaResult.error.issues}`,
    );
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  logger.info(
    `DELETE /featured/:id: Received request from ${req.body.address} for POAP ID: ${req.params.id}`,
  );

  // Resolve ENS if provided
  const resolvedAddress = await resolveENS(context.provider, req.body.address);
  if (resolvedAddress === null) {
    logger.warn('DELETE /featured/:id: Request address is invalid');
    return res.status(400).send({ msg: `${req.body.address} is not a valid address` });
  }

  const recoveredAddress = utils.verifyMessage(
    JSON.stringify({ action: 'remove', id: req.params.id }),
    req.body.signature,
  );
  if (recoveredAddress !== resolvedAddress) {
    logger.warn('DELETE /featured/:id: Request signature is invalid');
    return res.status(401).send({ msg: 'The signature is not valid for this address and data' });
  }

  const profile = await context.prisma.profile.findUnique({
    where: {
      address: resolvedAddress.toLowerCase(),
    },
  });
  if (profile === null) {
    logger.warn(`DELETE /featured/:id: No profile for address: ${req.body.address}`);
    return res.status(404).send({ msg: `There is no profile for the address ${req.body.address}` });
  }

  await context.prisma.featuredPOAP.delete({
    where: {
      poapTokenId_profileId: {
        poapTokenId: req.params.id,
        profileId: profile.id,
      },
    },
  });

  logger.info(
    `DELETE /featured/:id: Completed request from ${req.body.address} for POAP ID: ${req.params.id}`,
  );

  return res.status(200).send('DELETED');
});
