import { Router } from 'express';
import { sign } from 'jsonwebtoken';
import { JWT_EXP_TIME } from '../constants';
import { JWT_SECRET } from '../environment';
import { logger } from '../logging';

var router = Router();

router.get('/', function (req, res) {
  const token = sign({}, JWT_SECRET as string, {
    expiresIn: JWT_EXP_TIME,
  });

  logger.debug(`Issuing a token: ${token}`);

  res.json({
    access_token: token,
  });
});

export default router;
