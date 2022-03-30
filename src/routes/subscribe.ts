import { PutItemCommand } from '@aws-sdk/client-dynamodb';
import { Router } from 'express';
import jwt from 'express-jwt';
import { dynamoDB, CONTACTS_TABLE_NAME } from '../dynamo';
import { JWT_SECRET } from '../environment';
import { createScopedLogger } from '../logging';
import { httpRequestDurationSeconds } from '../metrics';

export const subscribeRouter = Router();

subscribeRouter.post(
  '/',
  jwt({ secret: JWT_SECRET as string, algorithms: ['HS256'] }),
  async function (req, res) {
    const logger = createScopedLogger('POST /subscribe');

    logger.debug(`Body: ${JSON.stringify(req.body)}`);

    const endTimer = httpRequestDurationSeconds.startTimer('POST', '/subscribe');

    if (!req.user) {
      logger.warn('Token is invalid');
      endTimer({ status: 401 });
      return res.sendStatus(401);
    } else {
      logger.info(`Request to subscribe ${req.body.email}`);

      const params = {
        TableName: CONTACTS_TABLE_NAME,
        Item: {
          email: { S: req.body.email },
          timestamp: { S: new Date().toISOString() },
        },
      };
      await dynamoDB.send(new PutItemCommand(params));

      logger.debug(`Completed request to subscribe ${req.body.email}`);

      endTimer({ status: 200 });

      res.sendStatus(200);
    }
  },
);
