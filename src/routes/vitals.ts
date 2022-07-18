import { Router } from 'express';
import { jwtWithAdminOAuth } from '../middleware';
import { httpRequestDurationSeconds } from '../metrics';
import { createScopedLogger } from '../logging';
import { context } from '../context';
import { lookupLastOngoingIssuanceRun } from '../lib/ongoing';

export const vitalsRouter = Router();

vitalsRouter.get('/ongoing-issuance', jwtWithAdminOAuth(), async (req, res) => {
  const logger = createScopedLogger('GET /vitals/ongoing-issuance');

  const endTimer = httpRequestDurationSeconds.startTimer('GET', '/vitals/ongoing-issuance');

  logger.info('Admin request for ongoing issuance vitals');

  const lastRun = await lookupLastOngoingIssuanceRun();

  endTimer({ status: 200 });

  return res.status(200).send({ lastRun });
});
