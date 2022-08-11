import { Router } from 'express';
import { context } from '../../../context';
import { httpRequestDurationSeconds } from '../../../metrics';
import { createScopedLogger } from '../../../logging';

export const poapEventRouter = Router();

poapEventRouter.get('/:poapEventId/is-gitpoap', async function (req, res) {
  const logger = createScopedLogger('GET /v1/poap-event/:poapEventId/is-gitpoap');

  logger.info(
    `Request to check it POAP event id ${req.params.poapEventId} is a GitPOAP project contribution level`,
  );

  const endTimer = httpRequestDurationSeconds.startTimer(
    'GET',
    '/v1/poap-event/:poapEventId/is-gitpoap',
  );

  const gitPOAP = await context.prisma.gitPOAP.findUnique({
    where: {
      poapEventId: parseInt(req.params.poapEventId, 10),
    },
    select: {
      id: true,
    },
  });

  endTimer({ status: 200 });

  logger.debug(
    `Completed request to check it POAP event id ${req.params.poapEventId} is a GitPOAP project contribution level`,
  );

  if (gitPOAP === null) {
    return res.status(200).send({ isGitPOAP: false });
  }

  return res.status(200).send({
    isGitPOAP: true,
    gitPOAPId: gitPOAP.id,
  });
});

poapEventRouter.get('/gitpoap-event-ids', async function (req, res) {
  const logger = createScopedLogger('GET /v1/poap-event/gitpoap-event-ids');

  logger.info('Request for all the POAP Event IDs that are GitPOAPs');

  const endTimer = httpRequestDurationSeconds.startTimer('GET', '/v1/poap-event/gitpoap-event-ids');

  // Note that we don't need to restrict to [APPROVED, REDEEM_REQUEST_PENDING], since
  // UNAPPROVED just means that the codes haven't been approved yet, the event still exists.
  // Presumably we will never run into a case where they don't approve our codes request
  const gitPOAPs = await context.prisma.gitPOAP.findMany({
    select: {
      poapEventId: true,
    },
  });

  const results = gitPOAPs.map(g => g.poapEventId);

  endTimer({ status: 200 });

  logger.debug('Completed request for all the POAP Event IDs that are GitPOAPs');

  return res.status(200).send(results);
});
