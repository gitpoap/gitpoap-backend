import { Router } from 'express';
import { sign } from 'jsonwebtoken';
import { JWT_EXP_TIME } from '../constants';
import { JWT_SECRET } from '../environment';
import { createScopedLogger } from '../logging';

var router = Router();

router.get('/', function (req, res) {
  const logger = createScopedLogger('GET /jwt');

  logger.info('Request to create a new JWT');

  const token = sign({}, JWT_SECRET as string, {
    expiresIn: JWT_EXP_TIME,
  });

  logger.debug('Completed request to create a new JWT');

  return res.json({
    access_token: token,
  });
});

export default router;
