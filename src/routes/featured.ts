import { Router } from 'express';
import { context } from '../context';
import { resolveENS } from '../lib/ens';
import { retrievePOAPTokenInfo } from '../external/poap';
import { createScopedLogger } from '../logging';
import { httpRequestDurationSeconds } from '../metrics';
import { getProfileByAddress, upsertProfile } from '../lib/profiles';
import { jwtWithAddress } from '../middleware';
import { AccessTokenPayload } from '../types/tokens';

export const featuredRouter = Router();

featuredRouter.put('/:poapTokenId', jwtWithAddress(), async function (req, res) {
  const logger = createScopedLogger('PUT /featured');

  logger.debug(`Params: ${JSON.stringify(req.params)}`);

  const endTimer = httpRequestDurationSeconds.startTimer('PUT', '/featured');

  const accessTokenPayload = <AccessTokenPayload>req.user;
  const address = accessTokenPayload.address;
  const poapTokenId = req.params.poapTokenId;

  logger.info(`Request from ${address} for POAP ID: ${poapTokenId}`);

  const profile = await upsertProfile(address);

  const poapData = await retrievePOAPTokenInfo(poapTokenId);
  if (poapData === null) {
    const msg = `Failed to retrieve POAP data (from POAP API) for ID: ${poapTokenId}`;
    logger.error(msg);
    endTimer({ status: 400 });
    return res.status(400).send({ msg });
  }

  if (poapData.owner.toLowerCase() !== address) {
    logger.warn(`Address ${address} attempted to feature unowned POAP`);
    endTimer({ status: 401 });
    return res.status(401).send({ msg: 'Users cannot feature POAPs they do not own' });
  }

  // If the POAP is a GitPOAP and it needs revalidation, don't let it be featured
  const claimData = await context.prisma.claim.findUnique({
    where: {
      poapTokenId: poapTokenId,
    },
    select: {
      needsRevalidation: true,
    },
  });
  if (claimData !== null && claimData.needsRevalidation) {
    logger.warn(`Address ${address} attempted to feature a GitPOAP that needs revalidation`);
    endTimer({ status: 400 });
    return res.status(400).send({
      msg: 'You must revalidate yourself as owner of this GitPOAP before you can feature it',
    });
  }

  await context.prisma.featuredPOAP.upsert({
    where: {
      poapTokenId_profileId: {
        poapTokenId: poapTokenId,
        profileId: profile.id,
      },
    },
    update: {},
    create: {
      poapTokenId: poapTokenId,
      profileId: profile.id,
    },
  });

  logger.debug(`Completed request from ${address} for POAP ID: ${poapTokenId}`);

  endTimer({ status: 200 });

  return res.status(200).send('ADDED');
});

featuredRouter.delete('/:poapTokenId', jwtWithAddress(), async function (req, res) {
  const logger = createScopedLogger('DELETE /featured/:poapTokenId');

  logger.debug(`Params: ${JSON.stringify(req.params)}`);

  const endTimer = httpRequestDurationSeconds.startTimer('DELETE', '/featured/:poapTokenId');

  const accessTokenPayload = <AccessTokenPayload>req.user;
  const address = accessTokenPayload.address;
  const poapTokenId = req.params.poapTokenId;

  logger.info(`Received request from ${address} for POAP ID: ${poapTokenId}`);

  const profile = await getProfileByAddress(address);
  if (profile === null) {
    const msg = `There is no profile for the address ${address}`;
    logger.warn(msg);
    endTimer({ status: 404 });
    return res.status(404).send({ msg });
  }

  try {
    await context.prisma.featuredPOAP.delete({
      where: {
        poapTokenId_profileId: {
          poapTokenId: poapTokenId,
          profileId: profile.id,
        },
      },
    });
  } catch (err) {
    logger.warn(`Tried to delete a FeaturedPOAP that was already deleted: ${err}`);
  }

  logger.debug(`Completed request from ${address} for POAP ID: ${poapTokenId}`);

  endTimer({ status: 200 });

  return res.status(200).send('DELETED');
});
