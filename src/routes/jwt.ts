import { Router } from 'express';
import { sign } from 'jsonwebtoken';
import { JWT_EXP_TIME_SECONDS } from '../constants';
import { JWT_SECRET } from '../environment';
import { getRequestLogger } from '../middleware/loggingAndTiming';

const router = Router();

router.get('/', function (req, res) {
  const logger = getRequestLogger(req);

  logger.info('Request to create a new JWT');

  const token = sign({}, JWT_SECRET as string, {
    expiresIn: JWT_EXP_TIME_SECONDS,
  });

  logger.debug('Completed request to create a new JWT');

  return res.json({
    access_token: token,
  });
});

export default router;
