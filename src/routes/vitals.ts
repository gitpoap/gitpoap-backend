import { Router } from 'express';
import { jwtWithAdminAddress } from '../middleware';
import { httpRequestDurationSeconds } from '../metrics';
import { createScopedLogger } from '../logging';
import { lookupLastOngoingIssuanceRun } from '../lib/ongoing';
import { lookupLastCheckForNewPOAPCodesRun } from '../lib/codes';

export const vitalsRouter = Router();

vitalsRouter.get('/ongoing-issuance', jwtWithAdminAddress(), async (req, res) => {
  const logger = createScopedLogger('GET /vitals/ongoing-issuance');

  const endTimer = httpRequestDurationSeconds.startTimer('GET', '/vitals/ongoing-issuance');

  logger.info('Admin request for ongoing issuance vitals');

  const lastRun = await lookupLastOngoingIssuanceRun();

  logger.debug('Completed admin request for ongoing issuance vitals');

  endTimer({ status: 200 });

  return res.status(200).send({ lastRun });
});

vitalsRouter.get('/check-for-codes', jwtWithAdminAddress(), async (req, res) => {
  const logger = createScopedLogger('GET /vitals/check-for-codes');

  const endTimer = httpRequestDurationSeconds.startTimer('GET', '/vitals/check-for-codes');

  logger.info('Admin request for new code checking vitals');

  const lastRun = await lookupLastCheckForNewPOAPCodesRun();

  logger.debug('Completed admin request for new code checking vitals');

  endTimer({ status: 200 });

  return res.status(200).send({ lastRun });
});
