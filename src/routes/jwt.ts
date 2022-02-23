import { Router } from 'express';
import { sign } from 'jsonwebtoken';
import { JWT_EXP_TIME } from '../constants';

var router = Router();

router.get('/', function (req, res) {
  const token = sign({}, process.env.JWT_SECRET as string, {
    expiresIn: JWT_EXP_TIME,
  });

  console.log('Issuing a token: ' + token);

  res.json({
    access_token: token,
  });
});

export default router;
