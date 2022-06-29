import { Router } from 'express';
import { jwtWithAdminOAuth } from '../middleware';
import { runOngoingIssuanceUpdater, updateOngoingIssuanceLastRun } from '../lib/ongoing';
import { httpRequestDurationSeconds } from '../metrics';
import { createScopedLogger } from '../logging';

export const triggersRouter = Router();

triggersRouter.get('/ongoing-issuance', jwtWithAdminOAuth(), async (req, res) => {
  const logger = createScopedLogger('GET /triggers/ongoing-issuance');

  const endTimer = httpRequestDurationSeconds.startTimer('GET', '/triggers/ongoing-issuance');

  // Update the last time ran to now (we do this first so the other instance
  // also doesn't start this process)
  await updateOngoingIssuanceLastRun();

  // Start ongoing issuance process in the background
  runOngoingIssuanceUpdater();

  endTimer({ status: 200 });

  return res.status(200).send('STARTED');
});
