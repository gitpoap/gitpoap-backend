import { Router } from 'express';
import { CreateAccessTokenSchema } from '../schemas/auth';
import { generateNewAuthTokens } from '../lib/authTokens';
import { getRequestLogger } from '../middleware/loggingAndTiming';
import { verifyPrivyToken } from '../lib/privy';

export const authRouter = Router();

authRouter.post('/', async function (req, res) {
  const logger = getRequestLogger(req);

  const schemaResult = CreateAccessTokenSchema.safeParse(req.body);
  if (!schemaResult.success) {
    logger.warn(
      `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
    );
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  const { privyToken } = schemaResult.data;

  logger.info(`Request to create AuthToken`);

  const privyUserData = await verifyPrivyToken(privyToken);
  if (privyUserData === null) {
    logger.error('Failed verify Privy token');
    return res.status(500).send({ msg: 'Login failed, please retry' });
  }

  const userAuthTokens = await generateNewAuthTokens(privyUserData);

  logger.debug('Completed request to create AuthToken');

  return res.status(200).send(userAuthTokens);
});
