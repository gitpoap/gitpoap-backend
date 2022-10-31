import { Router } from 'express';
import { jwtWithAdminAddress } from '../middleware';
import { runOngoingIssuanceUpdater, updateOngoingIssuanceLastRun } from '../lib/ongoing';
import { httpRequestDurationSeconds } from '../metrics';
import { createScopedLogger } from '../logging';
import { checkForNewPOAPCodes, updateCheckForNewPOAPCodesLastRun } from '../lib/codes';

export const triggersRouter = Router();

triggersRouter.get('/ongoing-issuance', jwtWithAdminAddress(), async (req, res) => {
  const logger = createScopedLogger('GET /triggers/ongoing-issuance');

  const endTimer = httpRequestDurationSeconds.startTimer('GET', '/triggers/ongoing-issuance');

  logger.info('Admin request to start ongoing issuance now');

  // Update the last time ran to now (we do this first so the other instance
  // also doesn't start this process)
  await updateOngoingIssuanceLastRun();

  // Start ongoing issuance process in the background
  void runOngoingIssuanceUpdater();

  logger.debug('Completed admin request to start ongoing issuance now');

  endTimer({ status: 200 });

  return res.status(200).send('STARTED');
});

triggersRouter.get('/check-for-codes', jwtWithAdminAddress(), async (req, res) => {
  const logger = createScopedLogger('GET /triggers/check-for-codes');

  const endTimer = httpRequestDurationSeconds.startTimer('GET', '/triggers/check-for-codes');

  logger.info('Admin request to check for new POAP codes now');

  // Update the last time ran to now (we do this first so the other instance
  // also doesn't start this process)
  await updateCheckForNewPOAPCodesLastRun();

  // Start the code checking process in the background
  void checkForNewPOAPCodes();

  logger.debug('Completed admin request to check for new POAP codes now');

  endTimer({ status: 200 });

  return res.status(200).send('STARTED');
});
