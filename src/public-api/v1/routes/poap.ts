import { Router } from 'express';
import { context } from '../../../context';
import { httpRequestDurationSeconds } from '../../../metrics';
import { createScopedLogger } from '../../../logging';
import { ClaimStatus } from '@generated/type-graphql';

export const poapRouter = Router();

poapRouter.get('/:poapTokenId/is-gitpoap', async function (req, res) {
  const logger = createScopedLogger('GET /v1/poap/:poapTokenId/is-gitpoap');

  logger.info(`Request to check it POAP token id ${req.params.poapTokenId} is a GitPOAP`);

  const endTimer = httpRequestDurationSeconds.startTimer('GET', '/v1/poap/:poapTokenId/is-gitpoap');

  const gitPOAP = await context.prisma.claim.findUnique({
    where: {
      poapTokenId: req.params.poapTokenId,
    },
    select: {
      gitPOAPId: true,
    },
  });

  endTimer({ status: 200 });

  logger.debug(
    `Completed request to check it POAP token id ${req.params.poapTokenId} is a GitPOAP`,
  );

  if (gitPOAP === null) {
    return res.status(200).send({ isGitPOAP: false });
  }

  return res.status(200).send({
    isGitPOAP: true,
    gitPOAPId: gitPOAP.gitPOAPId,
  });
});

poapRouter.get('/gitpoap-ids', async function (req, res) {
  const logger = createScopedLogger('GET /v1/poap/gitpoap-ids');

  logger.info('Request for all the POAP Token IDs that are GitPOAPs');

  const endTimer = httpRequestDurationSeconds.startTimer('GET', '/v1/poap/gitpoap-ids');

  const claims = await context.prisma.claim.findMany({
    where: {
      status: ClaimStatus.CLAIMED,
    },
    select: {
      poapTokenId: true,
    },
  });

  const results = claims.map(c => c.poapTokenId);

  endTimer({ status: 200 });

  logger.info('Completed request for all the POAP Token IDs that are GitPOAPs');

  return res.status(200).send(results);
});