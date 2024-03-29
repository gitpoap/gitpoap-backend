import { Router } from 'express';
import { context } from '../context';
import { retrievePOAPTokenInfo } from '../external/poap';
import { getProfileByAddress, upsertProfileForAddressId } from '../lib/profiles';
import { jwtWithAddress } from '../middleware/auth';
import { getAccessTokenPayloadWithAddress } from '../types/authTokens';
import { getRequestLogger } from '../middleware/loggingAndTiming';

export const featuredRouter = Router();

featuredRouter.put('/:poapTokenId', jwtWithAddress(), async function (req, res) {
  const logger = getRequestLogger(req);

  const { address } = getAccessTokenPayloadWithAddress(req.user);
  const poapTokenId = req.params.poapTokenId;

  logger.info(`Request from ${address.ethAddress} for POAP ID: ${poapTokenId}`);

  const profile = await upsertProfileForAddressId(address.id);

  if (profile === null) {
    logger.error(`Failed to upsert profile for address: ${address.ethAddress}`);
    return res.status(500).send({ msg: 'Failed to create profile for address' });
  }

  const poapData = await retrievePOAPTokenInfo(poapTokenId);
  if (poapData === null) {
    const msg = `Failed to retrieve POAP data (from POAP API) for ID: ${poapTokenId}`;
    logger.error(msg);
    return res.status(400).send({ msg });
  }

  if (poapData.owner.toLowerCase() !== address.ethAddress) {
    logger.warn(`Address ${address.ethAddress} attempted to feature unowned POAP`);
    return res.status(401).send({ msg: 'Users cannot feature POAPs they do not own' });
  }

  // If the POAP is a GitPOAP and it needs revalidation, don't let it be featured
  const claimData = await context.prisma.claim.findUnique({
    where: { poapTokenId },
    select: { needsRevalidation: true },
  });
  if (claimData?.needsRevalidation) {
    logger.warn(
      `Address ${address.ethAddress} attempted to feature a GitPOAP that needs revalidation`,
    );
    return res.status(400).send({
      msg: 'You must revalidate yourself as owner of this GitPOAP before you can feature it',
    });
  }

  await context.prisma.featuredPOAP.upsert({
    where: {
      poapTokenId_profileId: {
        poapTokenId,
        profileId: profile.id,
      },
    },
    update: {},
    create: {
      poapTokenId,
      profileId: profile.id,
    },
  });

  logger.debug(`Completed request from ${address.ethAddress} for POAP ID: ${poapTokenId}`);

  return res.status(200).send('ADDED');
});

featuredRouter.delete('/:poapTokenId', jwtWithAddress(), async function (req, res) {
  const logger = getRequestLogger(req);

  const {
    address: { ethAddress },
  } = getAccessTokenPayloadWithAddress(req.user);
  const poapTokenId = req.params.poapTokenId;

  logger.info(`Received request from ${ethAddress} for POAP ID: ${poapTokenId}`);

  const profile = await getProfileByAddress(ethAddress);
  if (profile === null) {
    const msg = `There is no profile for the address ${ethAddress}`;
    logger.warn(msg);
    return res.status(404).send({ msg });
  }

  try {
    await context.prisma.featuredPOAP.delete({
      where: {
        poapTokenId_profileId: {
          poapTokenId,
          profileId: profile.id,
        },
      },
    });
  } catch (err) {
    logger.warn(`Tried to delete a FeaturedPOAP that was already deleted: ${err}`);
  }

  logger.debug(`Completed request from ${ethAddress} for POAP ID: ${poapTokenId}`);

  return res.status(200).send('DELETED');
});
