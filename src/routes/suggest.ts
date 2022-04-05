import { PutItemCommand } from '@aws-sdk/client-dynamodb';
import { Router } from 'express';
import jwt from 'express-jwt';
import { dynamoDB, SUGGESTIONS_TABLE_NAME } from '../dynamo';
import { JWT_SECRET } from '../environment';
import { createScopedLogger } from '../logging';
import { httpRequestDurationSeconds } from '../metrics';

type SuggestionFormData = {
  email: string;
  repoUrl: string;
  userType: UserType;
};

enum UserType {
  Contributor = 'Contributor',
  Owner = 'Owner',
}

export const suggestRouter = Router();

suggestRouter.post(
  '/',
  jwt({ secret: JWT_SECRET as string, algorithms: ['HS256'] }),
  async function (req, res) {
    const logger = createScopedLogger('PUT /suggest');

    logger.debug(`Body: ${JSON.stringify(req.body)}`);

    const endTimer = httpRequestDurationSeconds.startTimer('POST', '/suggest');

    if (!req.user) {
      logger.warn('Token is invalid');
      endTimer({ status: 401 });
      return res.sendStatus(401);
    } else {
      logger.info(`Request from ${req.body.email} to make a suggestion`);

      const body = req.body as SuggestionFormData;
      const params = {
        TableName: SUGGESTIONS_TABLE_NAME,
        Item: {
          email: { S: body.email },
          repo_url: { S: body.repoUrl },
          user_type: { S: body.userType },
          timestamp: { S: new Date().toISOString() },
        },
      };
      try {
        await dynamoDB.send(new PutItemCommand(params));
      } catch (err) {
        logger.warn(`Got error from dynamo DB send: ${err}`);
      }

      logger.debug(`Completed request from ${req.body.email} to make a suggestion`);

      endTimer({ status: 200 });

      res.sendStatus(200);
    }
  },
);
