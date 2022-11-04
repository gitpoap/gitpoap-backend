import { Router } from 'express';
import { sign } from 'jsonwebtoken';
import { JWT_EXP_TIME_SECONDS } from '../constants';
import { JWT_SECRET } from '../environment';
import { createScopedLogger } from '../logging';
import { httpRequestDurationSeconds } from '../metrics';

const router = Router();

router.get('/', function (req, res) {
  const logger = createScopedLogger('GET /jwt');

  logger.info('Request to create a new JWT');

  const endTimer = httpRequestDurationSeconds.startTimer('GET', '/jwt');

  const token = sign({}, JWT_SECRET as string, {
    expiresIn: JWT_EXP_TIME_SECONDS,
  });

  logger.debug('Completed request to create a new JWT');

  endTimer({ status: 200 });

  return res.json({
    access_token: token,
  });
});

export default router;
