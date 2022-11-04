import { Router } from 'express';
import { context } from '../../../context';
import { ClaimStatus, GitPOAPStatus } from '@generated/type-graphql';
import { getRequestLogger } from '../../../middleware/loggingAndTiming';

export const poapRouter = Router();

poapRouter.get('/:poapTokenId/is-gitpoap', async function (req, res) {
  const logger = getRequestLogger(req);

  logger.info(`Request to check it POAP token id ${req.params.poapTokenId} is a GitPOAP`);

  const claim = await context.prisma.claim.findUnique({
    where: {
      poapTokenId: req.params.poapTokenId,
    },
    select: {
      gitPOAP: {
        select: {
          id: true,
          poapApprovalStatus: true,
        },
      },
    },
  });

  logger.debug(
    `Completed request to check it POAP token id ${req.params.poapTokenId} is a GitPOAP`,
  );

  if (claim === null) {
    return res.status(200).send({ isGitPOAP: false });
  }

  return res.status(200).send({
    isGitPOAP: true,
    gitPOAPId: claim.gitPOAP.id,
    isDeprecated: claim.gitPOAP.poapApprovalStatus === GitPOAPStatus.DEPRECATED,
  });
});

poapRouter.get('/gitpoap-ids', async function (req, res) {
  const logger = getRequestLogger(req);

  logger.info('Request for all the POAP Token IDs that are GitPOAPs');

  const claims = await context.prisma.claim.findMany({
    where: {
      status: ClaimStatus.CLAIMED,
    },
    select: {
      poapTokenId: true,
    },
  });

  const results = claims.map(c => c.poapTokenId);

  logger.info('Completed request for all the POAP Token IDs that are GitPOAPs');

  return res.status(200).send({ poapTokenIds: results });
});
