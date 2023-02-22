import { Router } from 'express';
import { jwtWithStaffAccess } from '../middleware/auth';
import { runOngoingIssuanceUpdater, updateOngoingIssuanceLastRun } from '../lib/ongoing';
import { checkForNewPOAPCodes, updateCheckForNewPOAPCodesLastRun } from '../lib/codes';
import { getRequestLogger } from '../middleware/loggingAndTiming';

export const triggersRouter = Router();

triggersRouter.post('/ongoing-issuance', jwtWithStaffAccess(), async (req, res) => {
  const logger = getRequestLogger(req);

  logger.info('Staff request to start ongoing issuance now');

  // Update the last time ran to now (we do this first so the other instance
  // also doesn't start this process)
  await updateOngoingIssuanceLastRun();

  // Start ongoing issuance process in the background
  void runOngoingIssuanceUpdater();

  logger.debug('Completed staff request to start ongoing issuance now');

  return res.status(200).send('STARTED');
});

triggersRouter.post('/check-for-codes', jwtWithStaffAccess(), async (req, res) => {
  const logger = getRequestLogger(req);

  logger.info('Staff request to check for new POAP codes now');

  // Update the last time ran to now (we do this first so the other instance
  // also doesn't start this process)
  await updateCheckForNewPOAPCodesLastRun();

  // Start the code checking process in the background
  void checkForNewPOAPCodes();

  logger.debug('Completed staff request to check for new POAP codes now');

  return res.status(200).send('STARTED');
});
